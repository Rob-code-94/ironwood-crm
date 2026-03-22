"use client"

import { useCallback, useRef } from "react"

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export function useCache<T>(ttl: number = 5 * 60 * 1000) {
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map())

  const get = useCallback((key: string): T | null => {
    const entry = cacheRef.current.get(key)
    if (!entry) return null

    const isExpired = Date.now() - entry.timestamp > ttl
    if (isExpired) {
      cacheRef.current.delete(key)
      return null
    }

    return entry.data
  }, [ttl])

  const set = useCallback((key: string, data: T) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    })
  }, [])

  const clear = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  const remove = useCallback((key: string) => {
    cacheRef.current.delete(key)
  }, [])

  return { get, set, clear, remove }
}
