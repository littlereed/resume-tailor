// src/lib/useTranslation.ts
import { useState, useEffect } from "react"
import { loadMessages, interpolate, type Locale, type Messages } from "./i18n"

export function useTranslation(locale: Locale) {
  const [messages, setMessages] = useState<Messages | null>(null)

  useEffect(() => {
    loadMessages(locale).then(setMessages)
  }, [locale])
// 翻译辅助函数
  const t = (key: string, vars?: Record<string, string | number>): string => {
    const text = messages?.[key] ?? key
    return vars ? interpolate(text, vars) : text
  }

  return { t, ready: messages !== null }
}