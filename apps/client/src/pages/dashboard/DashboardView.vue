<!--
  Dashboard — lists the user's workspaces.

  Server state (the list) comes from TanStack Query; client state (which one is
  selected) comes from Pinia; the search box is local component state because
  nothing else in the app cares about it. Three kinds of state, three homes.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { AlertCircle, FolderPlus, PlusCircle, Search } from "@lucide/vue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import CreateWorkspaceDialog from "@/components/workspace/CreateWorkspaceDialog.vue";
import WorkspaceCard from "@/components/workspace/WorkspaceCard.vue";
import { useCurrentWorkspace, useWorkspacesQuery } from "@/composables/useWorkspaces";
import { useWorkspaceStore } from "@/stores/workspace";

const workspaceStore = useWorkspaceStore();
const { data: workspaces, isPending, isError, error, refetch, isFetching } = useWorkspacesQuery();
const currentWorkspace = useCurrentWorkspace();

const createOpen = ref(false);
const search = ref("");

const filteredWorkspaces = computed(() => {
  const term = search.value.trim().toLowerCase();
  const list = workspaces.value ?? [];
  if (!term) return list;
  return list.filter(
    (w) => w.name.toLowerCase().includes(term) || w.description?.toLowerCase().includes(term),
  );
});
</script>

<template>
  <div class="mx-auto w-full max-w-6xl p-6 sm:p-10">
    <div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Workspaces</h1>
        <p class="mt-1 text-sm text-muted-foreground sm:text-base">
          Manage your teams, projects, and settings across different environments.
        </p>
      </div>
      <Button class="shrink-0" @click="createOpen = true">
        <PlusCircle />
        New workspace
      </Button>
    </div>

    <!-- 1. Loading: skeletons keep the layout from jumping when data arrives -->
    <div v-if="isPending" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="n in 3" :key="n" class="h-52 rounded-xl" />
    </div>

    <!-- 2. Error: say what happened and offer a way out -->
    <div
      v-else-if="isError"
      role="alert"
      class="flex flex-col items-center rounded-xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center"
    >
      <AlertCircle class="size-8 text-destructive" />
      <p class="mt-3 font-medium">Couldn't load your workspaces</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ error?.message }}</p>
      <Button variant="outline" class="mt-4" :disabled="isFetching" @click="refetch()">
        {{ isFetching ? "Retrying..." : "Try again" }}
      </Button>
    </div>

    <!-- 3. Empty: first-run experience, points at the one useful action -->
    <div
      v-else-if="!workspaces?.length"
      class="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center"
    >
      <FolderPlus class="size-10 text-muted-foreground" />
      <p class="mt-4 text-lg font-semibold">No workspaces yet</p>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        Create your first workspace to start organising boards and inviting your team.
      </p>
      <Button class="mt-6" @click="createOpen = true">
        <PlusCircle />
        Create workspace
      </Button>
    </div>

    <!-- 4. Data -->
    <template v-else>
      <div class="relative mb-6 max-w-md">
        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" type="search" placeholder="Search workspaces..." class="pl-9" aria-label="Search workspaces" />
      </div>

      <div v-if="filteredWorkspaces.length" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <WorkspaceCard
          v-for="workspace in filteredWorkspaces"
          :key="workspace.id"
          :workspace="workspace"
          :active="workspace.id === currentWorkspace?.id"
          @select="workspaceStore.select(workspace.id)"
        />
      </div>
      <p v-else class="py-12 text-center text-sm text-muted-foreground">
        No workspaces match "{{ search }}".
      </p>
    </template>

    <CreateWorkspaceDialog v-model:open="createOpen" />
  </div>
</template>
