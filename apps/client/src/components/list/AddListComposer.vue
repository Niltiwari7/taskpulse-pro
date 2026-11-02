<!-- 
 "+ Add a list" at the end of the board. Stays open after each add so several lists can be types in a row; Escape, the X, or a click outside closes it. 
-->

<script setup lang="ts">
import {nextTick, ref, useTemplateRef} from "vue";
import { onClickOutside } from "@vueuse/core";
import {toast} from 'vue-sonner';
import {Plus, X} from "@lucide/vue";
import { createListSchema } from "@taskpulse/shared-types";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useCreateList} from "@/composables/useLists";

const props = defineProps<{
  boardId: string;
}>();

const isOpen = ref(false);
const name = ref("");
const error = ref("");
const form = useTemplateRef<HTMLFormElement>("form");
const nameInput = useTemplateRef<{
  $el: HTMLInputElement;
}>("nameInput");
const {mutateAsync: createList, isPending} = useCreateList(()=> props.boardId);

onClickOutside(form, () => close());

async function focusInput() {
  await nextTick();
  nameInput.value?.$el.focus();
}

function open() {
  isOpen.value = true;
  focusInput();
}

function close() {
  isOpen.value = false;
  name.value = "";
  error.value = "";
}

async function submit() {
  const parsed = createListSchema.safeParse({name: name.value});
   if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? "Invalid list name";
    focusInput();
    return;
  }
  error.value = "";
   try {
    await createList(parsed.data);
    name.value = "";
    focusInput();
  } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add the list");
  }
}
</script>  


<template>
  <div class="w-72 shrink-0">
    <form v-if="isOpen" ref="form" class="space-y-2 rounded-xl bg-muted p-2" @submit.prevent="submit" @keydown.esc="close">
      <Input
        ref="nameInput"
        v-model="name"
        class="bg-background"
        placeholder="Enter list title..."
        maxlength="100"
        aria-label="List name"
        :aria-invalid="Boolean(error)"
        />

        <p v-if="error" class="px-1 text-xs text-destructive">
          {{ error }}
        </p>

        <div class="flex items-center gap-1">
          <Button type = "submit" size="sm" :disabled="isPending">{{ isPending ? "Adding..." : "Add list" }}</Button>
          <Button type="button" variant="ghost" size="icon" class="size-8" aria-label="Cancel" @click="close">
            <X/>
          </Button>
        </div>
    </form>


    <button
      v-else
      type="button"
      class="flex w-full items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
      @click="open"
      >
      <Plus class="size-4" /> Add a list</button>
  </div>
</template>