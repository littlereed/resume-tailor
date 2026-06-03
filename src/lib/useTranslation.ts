// src/lib/useTranslation.ts
import { useState, useEffect } from "react"
import {
  loadMessages,
  interpolate,
  type Locale,
  type Messages,
} from "./i18n"

export function useTranslation(locale: Locale) {
  const [messages, setMessages] = useState<Messages | null>(null)
  useEffect(() => {
    let cancelled = false                    
    loadMessages(locale).then((m) => {
      if (!cancelled) setMessages(m)         
      })
    
      return () => {                            
          cancelled = true                        
    }
  }, [locale])

  

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const text = messages?.[key]
    const str = typeof text === "string" ? text : key
    return vars ? interpolate(str, vars) : str
  }

  const tArray = (key: string): string[] => {
    const value = messages?.[key]
    return Array.isArray(value) ? value : []
  }

  return { t, tArray, ready: messages !== null }
}