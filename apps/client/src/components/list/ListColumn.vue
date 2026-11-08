<script setup lang="ts">
import {nextTick, ref, useTemplateRef} from "vue";
import {toast} from 'vue-sonner';
import { GripVertical, MoreHorizontal, Trash2 } from "@lucide/vue";
import {updateListSchema, type Card, type List} from "@taskpulse/shared-types";

import DeleteListDialog from "@/components/list/DeleteListDialog.vue";
import {Button} from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {Input} from "@/components/ui/input";
import {useRenameList} from "@/composables/useLists";
import AddCardComposer from "@/components/card/AddCardComposer.vue";
import CardTile from "@/components/card/CardTile.vue";

const props = defineProps<{
  list: List;
  cards: Card[]
}>();

const isEditing = ref(false);
const draft = ref("");
const deleteOpen = ref(false);
const titleInput = useTemplateRef<{
  $el: HTMLInputElement;
}>("titleInput");
const {mutateAsync: renameList} = useRenameList(()=> props.list.boardId);

async function startEditing() {
  draft.value = props.list.name;
  isEditing.value = true;
  await nextTick();
  titleInput.value?.$el.focus();
  titleInput.value?.$el.select();
}

function cancel() {
  isEditing.value = false;
}

async function save() {
  if(!isEditing.value) return;
  isEditing.value = false;
  const parsed = updateListSchema.safeParse({name: draft.value});
  if(!parsed.success || parsed.data.name === props.list.name) return;

  try {
    await renameList({listId: props.list.id, name: parsed.data.name});
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Couldn't rename the list");
  }
}

</script>

<template>
  <section 
      class = "flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-muted p-2"
      :aria-label="list.name"
  >
  <header
    class = "flex items-center gap-1"
  >
  <!-- Only this grip starts a drag, so clicking the title still renames -->
  <span data-drag-handle class="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true">
    <GripVertical class="size-4" />
  </span>
  <Input
    v-if="isEditing"
    ref="titleInput"
    v-model="draft"
    class="h-7 bg-background font-semibold"
    maxlength="100"
    aria-label="List name"
    @keydown.enter.prevent="save"
    @keydown.esc="cancel"
    @blur="save"
  />
  <button
    v-else
    type="button"
    class="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm font-semibold hover:bg-background/60"
    :title="`Rename ${list.name}`"
    @click="startEditing"
    >
    {{ list.name }}
  </button>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="List actions">
       <MoreHorizontal/>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem variant="destructive" @select="deleteOpen=true">
        <Trash2/> Delete list
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </header>

  <ol class="mt-2 min-h-2 flex-1 space-y-2 overflow-y-auto px-0.5 py-0.5">
    <li v-for="card in cards" :key="card.id">
      <CardTile :card="card" :board-id="list.boardId"/>
    </li>
  </ol>
  <AddCardComposer :list-id="list.id" :board-id="list.boardId"/>
    <!-- Outside the DropdownMenu so closing the menu doesn't tear down the dialog -->
    <DeleteListDialog v-model:open="deleteOpen" :list="list" />
  </section>
</template>