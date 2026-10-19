<!--
  One workspace in the dashboard grid. Purely presentational: it receives the
  workspace and whether it is active, and emits `select`. It never touches the
  store or the query cache — the parent decides what "select" means.
-->
<script setup lang="ts">
import { computed } from "vue";
import type { Workspace } from "@taskpulse/shared-types";
import { CalendarDays, Globe, Lock } from "@lucide/vue";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import WorkspaceAvatar from "./WorkspaceAvatar.vue";

const props = defineProps<{
  workspace: Workspace;
  active: boolean;
}>();

defineEmits<{ select: [] }>();

const createdLabel = computed(() =>
  new Date(props.workspace.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
);
</script>

<template>
  <!-- A <button>, not a <div @click>: keyboard and screen-reader users can select it too -->
  <button
    type="button"
    :aria-pressed="active"
    :class="
      cn(
        'group flex h-full flex-col rounded-xl border bg-card p-5 text-left transition-all hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'border-indigo-500 ring-1 ring-indigo-500 hover:border-indigo-500',
      )
    "
    @click="$emit('select')"
  >
    <WorkspaceAvatar :workspace="workspace" size="lg" class="mb-4" />

    <div class="flex-1">
      <h3 class="line-clamp-1 text-base font-semibold transition-colors group-hover:text-indigo-600">
        {{ workspace.name }}
      </h3>
      <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {{ workspace.description || "No description provided." }}
      </p>
    </div>

    <div class="mt-5 flex w-full items-center justify-between border-t pt-4 text-sm text-muted-foreground">
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1.5">
          <component :is="workspace.visibility === 'PRIVATE' ? Lock : Globe" class="size-3.5" />
          {{ workspace.visibility === "PRIVATE" ? "Private" : "Public" }}
        </span>
        <span class="flex items-center gap-1.5">
          <CalendarDays class="size-3.5" />
          {{ createdLabel }}
        </span>
      </div>
      <Badge v-if="active" class="border-transparent bg-indigo-50 text-indigo-600">Active</Badge>
    </div>
  </button>
</template>
