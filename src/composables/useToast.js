import { reactive } from 'vue'

// Module-level singleton — accessible from stores and composables outside component context
const toasts = reactive([])
let nextId = 0

export function useToast() {
  function addToast(message, type = 'success') {
    const id = ++nextId
    toasts.push({ id, message, type })
    setTimeout(() => removeToast(id), 3000)
  }

  function removeToast(id) {
    const idx = toasts.findIndex(t => t.id === id)
    if (idx !== -1) toasts.splice(idx, 1)
  }

  return { toasts, addToast, removeToast }
}
