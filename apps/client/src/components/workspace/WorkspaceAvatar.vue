<!-- Coloured initials tile for a workspace, e.g. "PE" for Product Engineering. -->
<script setup lang="ts">
import { computed } from "vue";
import type { Workspace } from "@taskpulse/shared-types";

import { cn } from "@/lib/utils";
import { workspaceGradient, workspaceInitials } from "@/lib/workspace-display";

const props = withDefaults(
  defineProps<{
    workspace: Pick<Workspace, "id" | "name">;
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);

const sizeClass = {
  sm: "size-5 rounded text-[10px]",
  md: "size-6 rounded text-[10px]",
  lg: "size-12 rounded-lg text-lg shadow-sm",
};

const gradient = computed(() => workspaceGradient(props.workspace.id));
const initials = computed(() => workspaceInitials(props.workspace.name));
</script>

<template>
  <div
    :class="cn('flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white', gradient, sizeClass[size])"
    aria-hidden="true"
  >
    {{ initials }}
  </div>
</template>
