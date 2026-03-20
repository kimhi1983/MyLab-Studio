import { ref, watch } from 'vue'

function cloneDefaultValue(defaultValue) {
  if (Array.isArray(defaultValue) || (defaultValue && typeof defaultValue === 'object')) {
    return JSON.parse(JSON.stringify(defaultValue))
  }
  return defaultValue
}

function readStoredValue(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key)
    if (stored == null) return cloneDefaultValue(defaultValue)
    return JSON.parse(stored)
  } catch (error) {
    console.warn(`[useLocalStorage] invalid value for ${key}, resetting`, error)
    localStorage.removeItem(key)
    return cloneDefaultValue(defaultValue)
  }
}

export function useLocalStorage(key, defaultValue) {
  const data = ref(readStoredValue(key, defaultValue))

  watch(data, (val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val))
    } catch (error) {
      console.error(`[useLocalStorage] failed to persist ${key}:`, error)
    }
  }, { deep: true })

  return data
}
