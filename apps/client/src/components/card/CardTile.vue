<!-- One card in a column. A real link, so Tab reaches it, Enter opens it, and Ctrl+click opens a new tab. -->
<script setup lang="ts">
import type { Card } from "@taskpulse/shared-types";
defineProps<{ card: Card; boardId: string }>();
</script>

<template>
  <RouterLink
    :to="{ name: 'card', params: { boardId, cardId: card.id } }"
    :data-card-id="card.id"
    class="block rounded-lg border bg-background px-3 py-2 text-sm shadow-xs hover:border-ring
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring break-words"
  >
    {{ card.title }}
  </RouterLink>
</template>
