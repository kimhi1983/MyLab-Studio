import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'

if (typeof window !== 'undefined') {
  const url = new URL(window.location.href)
  if (url.searchParams.get('reset-local') === '1') {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith('mylab:')) keysToRemove.push(key)
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
    url.searchParams.delete('reset-local')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }
}

const app = createApp(App)
app.use(router)
app.mount('#app')
