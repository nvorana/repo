import { useEffect, useState } from 'react'

/* State that survives a refresh — the studio remembers your work. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable — the session simply won't persist */
    }
  }, [key, value])

  return [value, setValue] as const
}
