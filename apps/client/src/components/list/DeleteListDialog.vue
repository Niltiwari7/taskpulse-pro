<!-- 
  Confirm before deleting a list. The server archives it (cards are kept) so the copy says so instead of implying the cards are gone 
-->

<script setup lang="ts">
import {toast} from 'vue-sonner';
import type {List} from "@taskpulse/shared-types";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {useDeleteList} from "@/composables/useLists";

const props = defineProps<{
  list: List;
  
}>();

const open = defineModel<boolean>("open", {default: false});
const {mutateAsync: deleteList, isPending} = useDeleteList(()=> props.list.boardId);

async function confirm() {
  try {
     await deleteList(props.list.id);
    open.value = false;
    toast.success(`List "${props.list.name}" deleted`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Couldn't delete the list");
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle> Delete "{{ list.name }}"?</DialogTitle>
        <DialogDescription>
          The list is removed from the board. Any cards in it are kept.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="open=false">Cancel</Button>
        <Button variant="destructive" :disabled="isPending" @click="confirm">
          {{ isPending ? "Deleting..." : "Delete list" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>