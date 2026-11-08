<!--
  "+ Add a card" at the bottom of a column. Enter adds and keeps it open with focus
  in the textarea, so cards can be typed back to back; Escape or a click outside closes.
-->

<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue';
import { onClickOutside } from '@vueuse/core';
import {toast} from "vue-sonner"
import {Plus,X} from "@lucide/vue";
import { createCardSchema } from '@taskpulse/shared-types';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCard } from "@/composables/useCards";

const props = defineProps<{ listId: string; boardId: string }>();

const isOpen = ref(false);
const title = ref("");
const error = ref("");
const root = useTemplateRef<HTMLElement>("root");
const field = useTemplateRef<{$el : HTMLTextAreaElement}>("field");
const {mutate: createCard} = useCreateCard(()=>props.boardId)

onClickOutside(root, ()=> close());

async function focusField() {
  await nextTick();
  field.value?.$el.focus();
}

function open() {
  isOpen.value = true;
  focusField();
}

function close() {
  isOpen.value = false;
  title.value="";
  error.value="";
}


function submit() {
  const parsed = createCardSchema.safeParse({title:title.value});
  if(!parsed.success) {
    error.value = parsed.error.issues[0]?.message??"Invalid title";
    return;
  }
  error.value = ""

  const sent = title.value;
  title.value = "";
  focusField();


  createCard(
    {listId : props.listId, input: parsed.data},
    {
      onSuccess: () => nextTick(()=>root.value?.scrollIntoView({block:"nearest"})),
      onError: (err) => {
        if(!title.value)title.value = sent;
        toast.error(err instanceof Error ? err.message : "Couldn't add the card");
      } 
    }
  )
}

function onEnter(e: KeyboardEvent) {
  if(e.isComposing) return;
  e.preventDefault();
  submit();
}

</script>

<template>
  <div 
      ref="root"
      class="mt-2"
   
  >
  <form
     v-if="isOpen"
     class="space-y-2"
     @submit.prevent = "submit"
     @keydown.esc = "close"
  >
  <Textarea
    ref="field"
    v-model="title"
    class="min-h-14 resize-none bg-background"
    placeholder="Enter a title for this card..."
    maxlength="500"
    aria-label="Card title"
    :aria-invalid="Boolean(error)"
    @keydown.enter="onEnter"
  />

  <p v-if="error" class="px-1 text-xs text-destructive">{{ error }}</p>
  <div class="flex items-center gap-1">
    <Button type="submit" size="sm">Add card</Button>
    <Button type = "button" variant="ghost" size="icon" class="size-8" aria-label="Cancel" @click="close"><X/></Button>
  </div>
</form>
  <button 
     v-else
     type="button"
     class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-background/60"
     @click="open"
  >
  <Plus class="size-4"/> Add a card
</button>
  </div> 
</template>