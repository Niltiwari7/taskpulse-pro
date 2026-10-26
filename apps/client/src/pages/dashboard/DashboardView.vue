<!--
  Dashboard — lists the user's workspaces.

  Server state (the list) comes from TanStack Query; client state (which one is
  selected) comes from Pinia; the search box is local component state because
  nothing else in the app cares about it. Three kinds of state, three homes.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { AlertCircle, FolderPlus, Plus, PlusCircle, Search } from "@lucide/vue";

import BoardCard from "@/components/board/BoardCard.vue";
import CreateBoardDialog from "@/components/board/CreateBoardDialog.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import CreateWorkspaceDialog from "@/components/workspace/CreateWorkspaceDialog.vue";
import WorkspaceCard from "@/components/workspace/WorkspaceCard.vue";
import { useBoardsQuery } from "@/composables/useBoards";
import { useCurrentWorkspace, useWorkspacesQuery } from "@/composables/useWorkspaces";
import { useWorkspaceStore } from "@/stores/workspace";

const workspaceStore = useWorkspaceStore();
const { data: workspaces, isPending, isError, error, refetch, isFetching } = useWorkspacesQuery();
const currentWorkspace = useCurrentWorkspace();

// Boards of the selected workspace; the key follows the switcher, so picking
// another workspace swaps the grid without any extra wiring.
const currentWorkspaceId = computed(() => currentWorkspace.value?.id);
const {
  data: boards,
  isPending: boardsPending,
  isError: boardsIsError,
  error: boardsError,
  refetch: refetchBoards,
  isFetching: boardsFetching,
} = useBoardsQuery(currentWorkspaceId);

const createOpen = ref(false);
const createBoardOpen = ref(false);
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
      <!-- Boards of the selected workspace come first: they're where the work happens -->
      <section v-if="currentWorkspace" class="mb-12" aria-labelledby="boards-heading">
        <div class="mb-4 flex items-center justify-between gap-4">
          <h2 id="boards-heading" class="line-clamp-1 text-lg font-semibold">
            Boards in {{ currentWorkspace.name }}
          </h2>
          <Button variant="outline" size="sm" class="shrink-0" @click="createBoardOpen = true">
            <Plus />
            New board
          </Button>
        </div>

        <div v-if="boardsPending" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Skeleton v-for="n in 4" :key="n" class="h-28 rounded-xl" />
        </div>

        <div
          v-else-if="boardsIsError"
          role="alert"
          class="flex items-center justify-between gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <span>Couldn't load boards: {{ boardsError?.message }}</span>
          <Button variant="outline" size="sm" :disabled="boardsFetching" @click="refetchBoards()">
            {{ boardsFetching ? "Retrying..." : "Try again" }}
          </Button>
        </div>

        <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <BoardCard v-for="board in boards" :key="board.id" :board="board" />
          <!-- Always-visible tile doubles as the empty state -->
          <button
            type="button"
            class="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="createBoardOpen = true"
          >
            <Plus class="size-5" />
            Create board
          </button>
        </div>

        <CreateBoardDialog v-model:open="createBoardOpen" :workspace-id="currentWorkspace.id" />
      </section>

      <h2 class="mb-4 text-lg font-semibold">All workspaces</h2>
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
