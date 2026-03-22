"use client"

import { useEffect, useRef, useState } from "react"

interface UseLazyLoadOptions {
  threshold?: number
  rootMargin?: string
}

export function useLazyLoad(options: UseLazyLoadOptions = {}) {
  const { threshold = 0.1, rootMargin = "50px" } = options
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [threshold, rootMargin])

  return { ref, isVisible }
}
