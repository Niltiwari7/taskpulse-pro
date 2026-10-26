<!--
  Board page at /boards/:boardId. For now an empty shell: header with the
  board's title (loaded from GET /boards/:id) and a placeholder canvas where
  lists will go (W06).

  The server answers 404 both for a missing board and one the user may not see,
  so the page shows the same "not found" state for both.
-->
<script setup lang="ts">
import { computed, watch } from "vue";
import { AlertCircle, ArrowLeft, Columns3 } from "@lucide/vue";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoardQuery } from "@/composables/useBoards";
import { BOARD_VISIBILITY } from "@/lib/board-display";
import { ApiError } from "@/services/http";
import { useWorkspaceStore } from "@/stores/workspace";

const props = defineProps<{ boardId: string }>();

const workspaceStore = useWorkspaceStore();
const { data: board, isPending, isError, error, refetch, isFetching } = useBoardQuery(() => props.boardId);

const isNotFound = computed(() => error.value instanceof ApiError && error.value.status === 404);
const visibility = computed(() => (board.value ? BOARD_VISIBILITY[board.value.visibility] : null));

// Opening a board from a link should also switch the header to its workspace
watch(
  () => board.value?.workspaceId,
  (id) => {
    if (id) workspaceStore.select(id);
  },
  { immediate: true },
);
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

    <div v-if="isPending" class="flex-1 p-6">
      <Skeleton class="h-64 w-72 rounded-xl" />
    </div>

    <div
      v-else-if="isError"
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
        {{ isFetching ? "Retrying..." : "Try again" }}
      </Button>
    </div>

    <!-- Lists arrive in W06; until then the canvas is an empty state -->
    <div v-else class="flex-1 overflow-x-auto p-6">
      <div class="flex h-full flex-col items-center justify-center rounded-xl border border-dashed text-center">
        <Columns3 class="size-10 text-muted-foreground" />
        <p class="mt-4 text-lg font-semibold">No lists yet</p>
        <p class="mt-1 max-w-sm text-sm text-muted-foreground">Lists and cards for this board are coming soon.</p>
      </div>
    </div>
  </div>
</template>
