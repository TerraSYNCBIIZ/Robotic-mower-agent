import { useEffect, useState } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    
    // Initial state setting - immediately set the value without condition
    setMatches(media.matches)
    
    // Create a listener function to update state when media query changes
    const listener = () => {
      setMatches(media.matches)
    }
    
    // Add the listener
    media.addEventListener("change", listener)
    
    // Clean up
    return () => {
      media.removeEventListener("change", listener)
    }
  }, [query]) // Only dependency is query

  return matches
} 