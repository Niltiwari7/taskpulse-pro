<!--
  Board page at /boards/:boardId. For now an empty shell: header with the
  board's title (loaded from GET /boards/:id) and a placeholder canvas where
  lists will go (W06).

  The server answers 404 both for a missing board and one the user may not see,
  so the page shows the same "not found" state for both.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AddListComposer from "@/components/list/AddListComposer.vue";
import ListColumn from "@/components/list/ListColumn.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoardQuery } from "@/composables/useBoards";
import { useListsQuery, useMoveList } from "@/composables/useLists";
import { BOARD_VISIBILITY } from "@/lib/board-display";
import { ApiError } from "@/services/http";
import { useWorkspaceStore } from "@/stores/workspace";
import { AlertCircle, ArrowLeft } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { VueDraggable } from "vue-draggable-plus";
import type { Card, List } from "@taskpulse/shared-types";
import { moveItem } from "@/lib/reorder";
import { useBoardCards } from "@/composables/useCards";

const props = defineProps<{ boardId: string }>();

const workspaceStore = useWorkspaceStore();
const { data: board, isPending, error, refetch, isFetching } = useBoardQuery(() => props.boardId);
const {data: lists, isPending: listsPending, isError: listsIsError, isFetching:listsFetching} = useListsQuery(() => props.boardId);
const {mutate : moveListMutation} = useMoveList(()=> props.boardId);
const {data:cards} = useBoardCards(()=>props.boardId);
const localLists = ref<List[]>([]);


const isNotFound = computed(() => error.value instanceof ApiError && error.value.status === 404);
const visibility = computed(() => (board.value ? BOARD_VISIBILITY[board.value.visibility] : null));

function onDragEnd(e: { oldIndex?: number; newIndex?: number }) {
  if (e.oldIndex == null || e.newIndex == null || e.oldIndex === e.newIndex) return;
  // Compute from the query data, not localLists, which the library may have already reordered.
  const { items, beforeId, afterId } = moveItem(lists.value!, e.oldIndex, e.newIndex);
  moveListMutation({ listId: items[e.newIndex].id, beforeId, afterId, optimistic: items });
}


const cardsByList = computed(() => {
  const map = new Map<string, Card[]>();

  for(const card of cards.value??[]){
    const bucket = map.get(card.listId);
    if(bucket)bucket.push(card);
    else map.set(card.listId,[card]);
  }
  return map;
})
// Opening a board from a link should also switch the header to its workspace
watch(
  () => board.value?.workspaceId,
  (id) => {
    if (id) workspaceStore.select(id);
  },
  { immediate: true },
);

watch(lists, (v) => {localLists.value = v ? [...v]:[];},{immediate: true})
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center gap-3 border-b px-6 py-4">
      <Button as-child variant="ghost" size="icon" aria-label="Back to dashboard">
        <RouterLink :to="{ name: 'dashboard' }"><ArrowLeft /></RouterLink>
      </Button>

      <Skeleton v-if="isPending" class="h-7 w-48" />
      <template v-else-if="board">
        <h1 class="truncate text-xl font-bold tracking-tight">{{ board.name }}</h1>
        <span v-if="visibility" class="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
          <component :is="visibility.icon" class="size-3.5" />
          {{ visibility.label }}
        </span>
      </template>
    </header>

    <template v-if="listsPending">
      <Skeleton class="h-64 w-72 rounded-xl" />
    </template>

    <div
      v-else-if="listsIsError"
      role="alert"
      class="m-6 flex flex-col items-center rounded-xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center"
    >
      <AlertCircle class="size-8 text-destructive" />
      <p class="mt-3 font-medium">{{ isNotFound ? "Board not found" : "Couldn't load this board" }}</p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ isNotFound ? "It may have been deleted, or you don't have access to it." : error?.message }}
      </p>
      <Button v-if="isNotFound" as-child variant="outline" class="mt-4">
        <RouterLink :to="{ name: 'dashboard' }">Back to dashboard</RouterLink>
      </Button>
      <Button v-else variant="outline" class="mt-4" :disabled="isFetching" @click="refetch()">
        {{ listsFetching  ? "Retrying..." : "Try again" }}
      </Button>
    </div>

    <!-- Board canvas: only this area scrolls sideways, the header stays put -->
    <template v-else>
      <div class="flex h-full w-max items-start gap-3 p-6">
        <template v-if="listsPending">
          <Skeleton v-for="n in 3" :key="n" class="h-32 w-72 shrink-0 rounded-xl" />
        </template>
        <template v-else>
          <div
            v-if="localLists.length === 0"
            class="flex w-72 shrink-0 flex-col justify-center rounded-xl border border-dashed px-4 py-8 text-center"
          >
            <p class="text-sm font-medium">This board has no lists yet</p>
            <p class="mt-1 text-xs text-muted-foreground">
              Add one to get started, e.g. Todo, Doing, Done.
            </p>
          </div>

          <VueDraggable
            v-model="localLists"
            class="flex items-start gap-3"
            :animation="150"
            handle="[data-drag-handle]"
            ghost-class="opacity-40"
            @end="onDragEnd"
          >
            <ListColumn v-for="list in localLists" :key="list.id" :list="list"  :cards = "cardsByList.get(list.id)??[]"/>
          </VueDraggable>
          <RouterView/>
          <AddListComposer :board-id="boardId" />
        </template>
      </div>
    </template>
  </div>
</template>
