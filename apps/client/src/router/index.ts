/**
 * Router — the single source of truth for every URL in the app.
 *
 * KEY CONCEPTS TO UNDERSTAND:
 *
 * 1. createWebHistory vs createWebHashHistory
 *    - createWebHistory  → clean URLs  (/dashboard)  — needs server config in prod
 *    - createWebHashHistory → hash URLs (#/dashboard) — works without server config
 *    We use createWebHistory because Vite's dev server handles it, and in
 *    production (W26) we'll configure the host to serve index.html for every path.
 *
 * 2. Lazy loading with import()
 *    Each route uses () => import('../pages/...') instead of a static import.
 *    This means the page's JS is loaded ONLY when the user visits that route.
 *    Result: faster initial load. The browser shows the app shell immediately,
 *    then downloads the page chunk in the background.
 *
 * 3. Nested routes (children)
 *    GuestLayout and AppLayout are "parent" routes. Their pages are children.
 *    When the user visits /login:
 *      - GuestLayout renders → its <RouterView /> renders LoginPage
 *    When the user visits /dashboard:
 *      - AppLayout renders  → its <RouterView /> renders DashboardPage
 *    This lets the layout (header, sidebar) persist while only the page swaps.
 *
 * 4. meta.requiresAuth
 *    A custom field we attach to protected routes. The navigation guard below
 *    reads it to decide whether to redirect to /login. We will expand this in
 *    W03-D4 (session restore) and W04-D1 (role guards).
 *
 * 5. Navigation guards (router.beforeEach)
 *    Runs before EVERY navigation. Think of it as middleware for the URL bar.
 *    return '/login'   → redirect there
 *    return true       → allow the navigation
 */

import { createRouter, createWebHistory } from 'vue-router'

// ─── Route definitions ────────────────────────────────────────────────────────

const router = createRouter({
  // Use the browser's History API — URLs look like /dashboard, not /#/dashboard
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    // ── Guest routes (unauthenticated only) ──────────────────────────────────
    {
      path: '/',
      component: () => import('@/layouts/GuestLayout.vue'), // lazy-loaded layout
      // Redirect bare "/" to /login so the user always lands somewhere useful
      redirect: '/login',
      children: [
        {
          path: 'login',
          name: 'login',                                     // name lets you do router.push({ name: 'login' })
          component: () => import('@/pages/auth/LoginPage.vue'),
          meta: { requiresAuth: false },
        },
        {
          path: 'register',
          name: 'register',
          component: () => import('@/pages/auth/RegisterPage.vue'),
          meta: { requiresAuth: false },
        },
      ],
    },

    // ── Protected routes (authenticated users only) ──────────────────────────
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },   // inherited by all children
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/dashboard/DashboardPage.vue'),
        },
        // Future routes added here (W05 boards, W07 cards, etc.):
        // { path: 'boards/:boardId', name: 'board', component: () => import(...) },
      ],
    },

    // ── 404 fallback ─────────────────────────────────────────────────────────
    {
      path: '/:pathMatch(.*)*',   // matches anything not caught above
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

// ─── Navigation guard ─────────────────────────────────────────────────────────
/**
 * This runs before every route change.
 *
 * Right now it checks a simple localStorage flag so you can test the guard
 * immediately without a real auth backend. In W03-D4 you'll replace
 * `isLoggedIn` with a check against the Pinia auth store.
 *
 * Pattern:
 *   - Route needs auth + user not logged in  → send to /login
 *   - Route is guest-only + user IS logged in → send to /dashboard
 *   - Everything else                         → allow
 */
router.beforeEach((to) => {
  // TODO (W03-D4): replace with → const { user } = useAuthStore()
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const isGuestRoute  = to.matched.some((record) => record.meta.requiresAuth === false)

  if (requiresAuth && !isLoggedIn) {
    // User tried to visit /dashboard without logging in → kick to /login
    return { name: 'login' }
  }

  if (isGuestRoute && isLoggedIn) {
    // Already logged in, no need to see the login page → send to dashboard
    return { name: 'dashboard' }
  }

  // All good — let the navigation proceed
  return true
})

export default router
