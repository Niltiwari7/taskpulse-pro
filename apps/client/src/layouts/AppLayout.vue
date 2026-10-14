<!--
  AppLayout — wraps every protected page (dashboard, boards, cards…).

  It will eventually contain:
  - Top navigation bar (workspace switcher, notifications bell, user menu)
  - Sidebar (workspace boards list)

  For now it is a shell. Add real UI here in W04-D3 (workspace UI week).
-->

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";

const router = useRouter()
const authStore = useAuthStore()

async function handleLogout() {
  try {
    await authStore.logout()
  } finally {
    await router.replace("/login")
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <header class="flex items-center justify-between border-b px-6 py-3">
      <span class="font-semibold tracking-tight">TaskPulse Pro</span>
      
      <div class="flex items-center gap-4">
        <span class="hidden text-sm text-muted-foreground sm:inline">
          {{ authStore.user?.email }}
        </span>
        <Button variant="outline" @click="handleLogout">Logout</Button>
      </div>
    </header> 

    <!-- Page content is injected here by the router -->
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
