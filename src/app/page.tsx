"use client"

import { useState } from "react"
import {
  LOCALES,
  LOCALE_NAMES,
  DEFAULT_LOCALE,
  type Locale,
} from "@/lib/i18n";
import { useTranslation } from "@/lib/useTranslation";
type Step = {
  node: string
  score?: number
  feedback?: string
  round?: number
}


export default function Home() {
  
  const [resume, setResume] = useState("")
  const [jd, setJd] = useState("")
  const [steps, setSteps] = useState<Step[]>([])
  const [result, setResult] = useState("")
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  
  const { t, ready } = useTranslation(locale)

  const NODE_LABELS: Record<string, string> = {
  rewrite: t("rewriteNode"),
  score: t("scorePercentage"),
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)  // 1.5秒后恢复
  }

  async function handlePDFUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/parse-pdf", { method: "POST", body: formData })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResume(data.text)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFail"))
    } finally {
      setParsing(false)
      e.target.value = ""
    }
  }

  async function run() {
    if (!resume.trim() || !jd.trim()) {
      setError(t("jobDescription"))
      return
    }
    setRunning(true)
    setSteps([])
    setResult("")
    setFinalScore(null)
    setError("")
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jd , locale}),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = JSON.parse(line.slice(6))
          if (data.error) {
            setError(data.error)
          } else if (data.node) {
            const v = data.value
            setSteps((prev) => [
              ...prev,
              { node: data.node, score: v.score, feedback: v.feedback, round: v.rounds },
            ])
            if (data.node === "rewrite" && v.optimized) setResult(v.optimized)
            if (data.node === "score" && v.score != null) setFinalScore(v.score)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFail"))
    }finally {
      setRunning(false)
    }
  }
  if (!ready) {
    return <main className="container"><p className="hint">Loading...</p></main>
  }

  return (
    <main className="container">
      <header className="mb-10">
  <div className="flex items-center justify-between gap-3">
    <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
    <div className="flex gap-1 shrink-0">
      {LOCALES.map((lc) => (
        <button
          type="button"
          key={lc}
          onClick={() => setLocale(lc)}
          className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
            locale === lc
              ? "text-accent border-accent-dim bg-accent-dim"
              : "text-muted border-border bg-transparent hover:text-text"
          }`}
        >
          {LOCALE_NAMES[lc]}
        </button>
      ))}
      </div>
    </div>
    <p className="text-muted mt-2 text-sm">{t("subtitle")}</p>
     </header>

      <div className="grid">
        <div className="input-col">
          <label>{t("jdLabel")}</label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder={t("jdPlaceholder")}
            rows={8}
          />
          <label>
            {t("resumeLabel")}
            <span className="upload-wrap">
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePDFUpload}
                disabled={parsing}
                id="pdf-upload"
                className='hidden-input'
              />
              <label htmlFor="pdf-upload" className="upload-btn">
                {parsing ? t("parsing") : t("uploadBtn")}
              </label>
            </span>
          </label>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder={t("resumePlaceholder")}
            rows={10}
          />
          <button type="button"  onClick={run} disabled={running}>
            {running ? t("running") : t("start")}
          </button>
          {error && <p className="error">⚠️ {error}</p>}
        </div>

        <div className="output-col">
          <div className="agent-trace">
            <div className="trace-header">
              <h3>{t("traceTitle")}</h3>
              {running && <span className="live-dot">● LIVE</span>}
            </div>

            {steps.length === 0 && !running && (
              <p className="hint">{t("hint")}</p>
            )}

            <div className="timeline">
              {steps.map((s, i) => {
                const isLast = i === steps.length - 1
                const done = !running || !isLast
                return (
                  <div key={i} className={`step ${done ? "done" : "active"}`}>
                    <div className="step-marker">
                      <span className="step-icon">
                        {done ? "✓" : "●"}
                      </span>
                    </div>
                    <div className="step-body">
                      <div className="step-head">
                        <span className="step-label">
                          {NODE_LABELS[s.node] ?? s.node}
                        </span>
                        {s.round != null && (
                          <span className="badge">{t("roundLabel", { n: s.round })}</span>
                        )}
                      </div>
                      
                      {s.score != null && (
                        <div className="score-bar">
                          
                          <div
                            className="score-fill"
                            
                            style={{ width: `${s.score}%` }}
                          />
                          <span className="score-num">{s.score}%</span>
                        </div>
                      )}

                      {s.feedback && <p className="feedback">{s.feedback}</p>}
                    </div>
                  </div>
                )
              })}

              {running && (
                <div className="step active">
                  <div className="step-marker">
                    <span className="step-icon spin">◌</span>
                  </div>
                  <div className="step-body">
                    <span className="step-label dim">{t("reasoning")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {finalScore != null && (
            <div className="final-score">
              <span className="final-label">{t("finalScore")}</span>
              <span className="final-num">{finalScore}%</span>
            </div>
          )}

          {result && (
            <div className="result">
              <div className="result-head">
              <h3>{t("resultTitle")}</h3>
                <button
                  type="button"
                  className={`copy-btn ${copied ? "copied" : ""}`}
                  onClick={handleCopy}
                >
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
              <div className="compare">
                <div className="compare-col">
                  <span className="compare-tag">{t("originalResume")}</span>
                  <pre className="dim-text">{resume}</pre>
                </div>
                <div className="compare-col">
                  <span className="compare-tag accent">{t("optimized")}</span>
                  <pre>{result}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}