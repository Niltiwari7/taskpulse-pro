import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import router from './router'

const pinia = createPinia()
const queryClient = new QueryClient()

createApp(App)
  .use(pinia)
  .use(router)   // register the router — now <RouterView> and <RouterLink> work everywhere
  .use(VueQueryPlugin, { queryClient })
  .mount('#app')
