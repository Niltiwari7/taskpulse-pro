<!--
  One board in the dashboard grid. A RouterLink, not a button: opening a board
  is navigation, so middle-click / open-in-new-tab work as expected.
-->
<script setup lang="ts">
import { computed } from "vue";
import type { Board } from "@taskpulse/shared-types";

import { BOARD_VISIBILITY, boardBackground } from "@/lib/board-display";

const props = defineProps<{ board: Board }>();

const visibility = computed(() => BOARD_VISIBILITY[props.board.visibility]);
const background = computed(() => boardBackground(props.board));
</script>

<template>
  <RouterLink
    :to="{ name: 'board', params: { boardId: board.id } }"
    class="group flex h-32 flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <!-- The gradient is twice the strip's size, so moving its position on hover makes it drift -->
    <div
      class="h-18 shrink-0 bg-[position:0_0,0%_0%] transition-[background-position] duration-700 ease-out group-hover:bg-[position:0_0,100%_100%]"
      :style="background"
      aria-hidden="true"
    />
    <div class="flex flex-1 flex-col justify-between p-3">
      <h3 class="line-clamp-1 text-sm font-semibold transition-colors group-hover:text-indigo-600">
        {{ board.name }}
      </h3>
      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <component :is="visibility.icon" class="size-3.5" />
        {{ visibility.label }}
      </span>
    </div>
  </RouterLink>
</template>
