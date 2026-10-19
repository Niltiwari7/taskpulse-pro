<!--
  Header workspace switcher. Reads the same cached list as the dashboard
  (one network request, shared), and writes only the selected id to Pinia.
-->
<script setup lang="ts">
import { ref } from "vue";
import { Check, ChevronsUpDown, Plus } from "@lucide/vue";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentWorkspace, useWorkspacesQuery } from "@/composables/useWorkspaces";
import { useWorkspaceStore } from "@/stores/workspace";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog.vue";
import WorkspaceAvatar from "./WorkspaceAvatar.vue";

const workspaceStore = useWorkspaceStore();
const { data: workspaces, isPending } = useWorkspacesQuery();
const currentWorkspace = useCurrentWorkspace();

const createOpen = ref(false);
</script>

<template>
  <Skeleton v-if="isPending" class="h-8 w-44" />

  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="group flex max-w-60 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <WorkspaceAvatar v-if="currentWorkspace" :workspace="currentWorkspace" size="sm" />
        <span class="truncate">{{ currentWorkspace?.name ?? "Select workspace" }}</span>
        <ChevronsUpDown class="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" :side-offset="4" class="w-64 p-0">
      <DropdownMenuLabel
        class="border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Your workspaces
      </DropdownMenuLabel>

      <div class="max-h-64 overflow-y-auto p-1">
        <DropdownMenuItem
          v-for="workspace in workspaces"
          :key="workspace.id"
          :class="['cursor-pointer justify-between', workspace.id === currentWorkspace?.id && 'bg-indigo-50 text-indigo-700']"
          @select="workspaceStore.select(workspace.id)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <WorkspaceAvatar :workspace="workspace" />
            <span class="truncate font-medium">{{ workspace.name }}</span>
          </span>
          <Check v-if="workspace.id === currentWorkspace?.id" class="text-indigo-600" />
        </DropdownMenuItem>

        <p v-if="!workspaces?.length" class="px-2 py-3 text-sm text-muted-foreground">No workspaces yet.</p>
      </div>

      <DropdownMenuSeparator class="my-0" />
      <div class="p-1">
        <DropdownMenuItem class="cursor-pointer font-medium" @select="createOpen = true">
          <Plus />
          Create workspace
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Lives outside the menu so it stays mounted when the menu closes -->
  <CreateWorkspaceDialog v-model:open="createOpen" />
</template>
