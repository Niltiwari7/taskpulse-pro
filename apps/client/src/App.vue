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
 * layout files (src/layouts/).
 */
</script>

<template>
  <RouterView />
</template>
