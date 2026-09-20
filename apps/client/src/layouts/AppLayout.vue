<!--
  AppLayout — wraps every protected page (dashboard, boards, cards…).

  It will eventually contain:
  - Top navigation bar (workspace switcher, notifications bell, user menu)
  - Sidebar (workspace boards list)

  For now it is a shell. Add real UI here in W04-D3 (workspace UI week).
-->
<template>
  <div class="flex min-h-screen flex-col bg-background">
    <!-- Placeholder header — replace in W04 -->
    <header class="border-b px-6 py-3">
      <span class="font-semibold tracking-tight">TaskPulse Pro</span>
    </header>

    <!-- Page content is injected here by the router -->
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
