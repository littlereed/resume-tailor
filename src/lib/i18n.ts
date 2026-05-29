// 语言配置 —— 加新语言只需在这里加一行 + 加对应 JSON 文件
export const LOCALES = ["zh", "en", "ja"] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_NAMES: Record<Locale, string> = {
  zh: "中文",
  en: "EN",
  ja: "日本語",
}

export const DEFAULT_LOCALE: Locale = "zh"

// 翻译内容的类型(以 zh 为基准)
// 改成支持数组
export type Messages = Record<string, string | string[]>

// 动态按需加载:用户切到哪个语言才加载哪个文件
export async function loadMessages(locale: Locale): Promise<Messages> {
  const mod = await import(`@/locales/${locale}.json`)
  return mod.default
}

// 占位符插值:t("roundLabel", { n: 2 }) → "第 2 轮"
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

