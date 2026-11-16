<script setup lang="ts">
import {computed, nextTick} from "vue";
import { useRouter } from "vue-router";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton";
import { useCardQuery } from "@/composables/useCards";
import { ApiError } from "@/services/http";
import DescriptionEditor from "./DescriptionEditor.vue";

const props = defineProps<
    {
      boardId : string;
      cardId : string
    }>();

const router = useRouter();
const {data:card, isPending, error} = useCardQuery(() => props.boardId, () => props.cardId);
const isNotFound = computed(() => error.value instanceof ApiError && error.value.status === 404);

async function close() {
  const id = props.cardId;
  await router.push({name:"board", params:{boardId : props.boardId}});
  await nextTick();
  document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.focus();
}
</script>


<template>
  <Dialog :open="true" @update:open="(v) => !v && close()">
    <!-- One constant height whatever the content (smaller on short screens, since the
         dialog is position: fixed and can't be scrolled to). The title stays put and
         only the body scrolls. -->
    <DialogContent class="flex h-[min(36rem,calc(100dvh-4rem))] flex-col sm:max-w-xl">
      <template v-if="card">
        <DialogHeader class="shrink-0 pr-6">
          <DialogTitle class="line-clamp-2 break-words text-xl">{{ card.title }}</DialogTitle>
          <DialogDescription>Card details</DialogDescription>
        </DialogHeader>
        <div class="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
          <DescriptionEditor :key="card.id" :board-id="boardId" :card="card" />
        </div>
      </template>

      <template v-else-if="isPending">
        <DialogTitle class="sr-only">Loading card</DialogTitle>
        <Skeleton class="h-7 w-2/3"/>
        <Skeleton class="h-24 w-full"/>
      </template>

      <template v-else>
        <DialogTitle>{{isNotFound ? "Card Not found" : "Couldn't load this card"}}</DialogTitle>
        <DialogDescription>
          {{ isNotFound ? "It may have been deleted, or you don't have access to it" : error?.message }}
        </DialogDescription>
      </template>
    </DialogContent>
  </Dialog>
</template>