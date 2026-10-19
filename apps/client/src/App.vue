<script setup lang="ts">
/**
 * App.vue is now just a shell.
 * <RouterView /> is the "hole" where the current route's component is rendered.
 *
 * The router will inject:
 *   /login     → GuestLayout → LoginPage
 *   /dashboard → AppLayout   → DashboardPage
 *   etc.
 *
 * Nothing else belongs here — no layout, no navigation. Those live in the
 * layout files (src/layouts/). The one exception is <Toaster />: toasts must
 * outlive page and layout changes, so it mounts once at the root.
 */
import "vue-sonner/style.css"
import { Toaster } from "@/components/ui/sonner"
</script>

<template>
  <RouterView />
  <Toaster position="bottom-right" rich-colors />
</template>
