"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")

  // Initialize theme from localStorage and system preference
  React.useEffect(() => {
    // Get stored theme or system preference
    const stored = localStorage.getItem("theme") as Theme | null
    const initial = stored || "system"
    setThemeState(initial)

    // Determine resolved theme
    const isDark =
      initial === "dark" ||
      (initial === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    
    setResolvedTheme(isDark ? "dark" : "light")
    document.documentElement.classList.toggle("dark", isDark)
  }, [])

  // Listen to system theme changes
  React.useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? "dark" : "light")
        document.documentElement.classList.toggle("dark", e.matches)
      }

      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("theme", newTheme)

    if (newTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      setResolvedTheme(isDark ? "dark" : "light")
      document.documentElement.classList.toggle("dark", isDark)
    } else {
      const isDark = newTheme === "dark"
      setResolvedTheme(isDark ? "dark" : "light")
      document.documentElement.classList.toggle("dark", isDark)
    }
  }

  // Always provide context so SSR and the first client frame (before useEffect) still
  // wrap consumers like ThemeSwitcher. Theme sync from localStorage runs in useEffect.
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
