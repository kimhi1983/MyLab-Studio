import { makeUserDataApi, saveSettings } from '../lib/userDataApi.js'

const MIGRATED_KEY = 'mylab:server-migrated'

export async function migrateLocalDataToServer() {
  if (localStorage.getItem(MIGRATED_KEY)) return

  const resources = ['formulas', 'projects', 'notes', 'stability']
  for (const key of resources) {
    const raw = localStorage.getItem(`mylab:${key}`)
    if (raw) {
      try {
        const items = JSON.parse(raw)
        if (Array.isArray(items) && items.length > 0) {
          await makeUserDataApi(key).saveBatch(items)
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // widget layout
  const layout = localStorage.getItem('mylab:dashboard-layout-v4')
  const memo = localStorage.getItem('mylab:dashboard-memo')
  if (layout || memo) {
    try {
      await saveSettings({
        widget_layout: layout ? JSON.parse(layout) : undefined,
        dashboard_memo: memo || undefined,
      })
    } catch {
      // ignore
    }
  }

  localStorage.setItem(MIGRATED_KEY, '1')
}
