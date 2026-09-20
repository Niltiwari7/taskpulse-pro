import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

createApp(App)
  .use(router)   // register the router — now <RouterView> and <RouterLink> work everywhere
  .mount('#app')
