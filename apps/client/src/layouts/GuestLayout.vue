<!--
  GuestLayout — wraps pages that ONLY unauthenticated users should see:
  /login, /register.

  Later (W03-D4) the router guard will redirect logged-in users away
  from these pages automatically. The layout itself stays simple.
-->
<template>
  <!-- Full-screen centred container — perfect for auth forms -->
  <main class="min-h-screen bg-background">
    <RouterView />
  </main>
</template>
