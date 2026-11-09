<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, useTemplateRef} from "vue";
import {toast} from "vue-sonner"
import type {Card} from "@taskpulse/shared-types"
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateCard } from "@/composables/useCards";
import { renderMarkdown } from "@/lib/markdown";

const props = defineProps<{boardId : string; card: Card}>();
const {mutateAsync} = useUpdateCard(()=>props.boardId);
const editing = ref(false);
const draft = ref("")
const status = ref<"idle"|"saving"|"saved">("idle");
const wrapper = useTemplateRef<HTMLElement>("wrapper");
let cancelled = false;
let savedTimer: ReturnType<typeof setTimeout>;

const html = computed(()=>renderMarkdown(props.card.description??""));

async function startEdit () {
  draft.value = props.card.description??"";
  cancelled = false;
  editing.value = true;
  await nextTick();
  wrapper.value?.querySelector("textarea")?.focus();
}

async  function commit() {
  if(cancelled) return;
  const next = draft.value.trim() === "" ? null : draft.value;
  editing.value = false;
  if(next === props.card.description) return;
  status.value = "saving";
  try {
    await mutateAsync({cardId : props.card.id, input : {description : next}});
    status.value = "saved";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (status.value = "idle"), 2000);
  }catch {
    status.value = "idle";
    editing.value = true;
    toast.error("Couldn't save the description. Your text is still here");
  }

}

function cancel() {
  cancelled = true;
  editing.value = false;
}

onBeforeUnmount(() => clearTimeout(savedTimer)); 

</script>


<template>
  <section aria-labelledby="desc-heading" class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 id="desc-heading" class="text-sm font-medium">Description</h3>
      <span class="text-xs text-muted-foreground" role="status" aria-live="polite">
        <template v-if="status==='saving'">Saving...</template>
        <template v-else-if="status === 'saved'">Saved</template>
      </span>
    </div>
    
    <div v-if="editing" ref="wrapper" class="space-y-2">
      <Textarea
         v-model="draft"
         rows="6"
         maxlength="10000"
         placeholder="Add a more detailed description...(Markdown supported)"
         @blur="commit"
         @keydown.esc.stop.prevent="cancel"
      />

      <div class="flex gap-2">
        <Button size="sm" @mousedown.prevent @click="commit">Save</Button>
        <Button size="sm" variant="ghost" @mousedown.prevent @click="cancel">Cancel</Button>
      </div>
    </div>
    <button v-else type="button" class="block w-full rounded-md p-2 text-left hover:bg-muted"
          @click="startEdit">
    <!-- eslint-disable-next-line vue/no-v-html -- sanitized by renderMarkdown -->
    <div v-if="card.description" class="prose prose-sm max-w-none" v-html="html" />
    <span v-else class="text-sm text-muted-foreground">Add a more detailed description…</span>
  </button>
  </section>
</template>