<!--
  AppLayout — wraps every protected page (dashboard, boards, cards…).

  - Sidebar: app nav (from `navItems`). On small screens it slides in as a drawer.
  - Top bar: mobile menu button + user menu.
  - Main: the selected page, injected by the router.
-->

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import { computed, ref, watch } from "vue";
import WorkspaceSwitcher from "@/components/workspace/WorkspaceSwitcher.vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, LogOut, Menu, SquareKanban, X } from "@lucide/vue";

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const queryClient = useQueryClient()

const initial = computed(() => authStore.user?.email?.charAt(0).toUpperCase() ?? "?")

// Add an entry here when a new page gets a route (boards, settings, …)
const navItems = [
  { label: "Work", to: { name: "dashboard" }, icon: LayoutDashboard },
]

// Mobile drawer — close it whenever the user navigates
const sidebarOpen = ref(false)
watch(() => route.fullPath, () => (sidebarOpen.value = false))

async function handleLogout() {
  try {
    await authStore.logout()
  } finally {
    // Drop the previous user's cached server data and selection, otherwise the
    // next person to log in on this browser briefly sees their workspaces
    queryClient.clear()
    workspaceStore.select(null)
    await router.replace("/login")
  }
}
</script>

<template>
  <div class="flex h-screen bg-background">
    <!-- Backdrop behind the mobile drawer -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-black/40 md:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform md:static md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <RouterLink :to="{ name: 'dashboard' }" class="flex items-center gap-2">
          <SquareKanban class="size-6" />
          <span class="font-semibold tracking-tight">TaskPulse Pro</span>
        </RouterLink>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-accent md:hidden"
          aria-label="Close menu"
          @click="sidebarOpen = false"
        >
          <X class="size-5" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto p-3">
        <RouterLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          active-class="bg-accent text-accent-foreground"
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Right column: top bar + selected page -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6">
        <div class="flex min-w-0 items-center gap-2">
          <button
            type="button"
            class="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
            aria-label="Open menu"
            @click="sidebarOpen = true"
          >
            <Menu class="size-5" />
          </button>
          <WorkspaceSwitcher />
        </div>

        <div class="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Open account menu"
              >
                <Avatar class="size-9 cursor-pointer">
                  <AvatarFallback
                    class="bg-orange-400 text-sm font-medium text-black"
                  >
                    {{ initial }}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              :side-offset="8"
              class="w-72 p-0"
            >
              <!-- Account heading -->
              <DropdownMenuLabel
                class="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Account
              </DropdownMenuLabel>

              <!-- User details -->
              <div class="flex items-center gap-3 px-4 py-2">
                <Avatar class="size-10 shrink-0">
                  <AvatarFallback
                    class="bg-orange-400 text-sm font-medium text-black"
                  >
                    {{ initial }}
                  </AvatarFallback>
                </Avatar>

                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">
                    {{ authStore.user?.email?.split("@")[0] }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ authStore.user?.email }}
                  </p>
                </div>
              </div>

              <DropdownMenuSeparator />


               <!-- Logout -->
              <DropdownMenuItem
                variant="destructive"
                @select="handleLogout"
                class="cursor-pointer px-4 py-3"
              >
                <LogOut class="mr-2 size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <!-- Page content is injected here by the router -->
      <main class="flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
