# 🎯 Resume Tailor Agent

An AI-powered resume optimization platform built with Next.js, LangGraph, and LangChain.

The application analyzes resumes against job descriptions, optimizes wording under strict anti-hallucination constraints, and provides objective match-rate scoring with transparent feedback.

## ✨ Highlights

* 🔄 Self-reflection loop with automatic retry (up to 3 rounds)
* 🛡️ Anti-hallucination design that never fabricates experience
* 🛠️ Tool calling for keyword extraction and coverage calculation
* 📊 Dual scoring system (keyword coverage + AI evaluation)
* ⚡ Real-time agent visualization using SSE
* 🌍 Multilingual support (English / Japanese / Chinese)
* 📄 PDF resume upload and parsing
* 🪂 Graceful degradation when API quota is exhausted

## 🧠 Workflow

Extract Keywords
       ↓
Rewrite Resume
       ↓
 Score Resume
       ↓
Score < 85 && Retry < 3 ?
       │
 ┌─────┴─────┐
 │           │
Yes         No
 │           │
 ↓           ↓
Retry      Verify
 │           │
 └─────┬─────┘
       ↓
      Done


## 🚀 Tech Stack

| Layer           | Technology               |
| --------------- | ------------------------ |
| Framework       | Next.js 16 (App Router)  |
| Frontend        | React 19                 |
| Styling         | Tailwind CSS v4          |
| AI Framework    | LangChain                |
| Agent Framework | LangGraph                |
| Model           | Gemini 2.5 Flash-Lite    |
| Streaming       | Server-Sent Events (SSE) |
| Validation      | Zod                      |
| Language        | TypeScript               |

## 🔧 Technical Highlights

* LangGraph self-reflection workflow with conditional retry
* Tool-based architecture for keyword extraction and coverage calculation
* Type-safe LLM responses using Zod and Structured Output
* Real-time agent visualization via Server-Sent Events (SSE)
* Graceful degradation when API quota is exhausted
* Multilingual support (English / Japanese / Chinese)

## 👨‍💻 Personal Contributions

This project was independently designed and implemented.

Main contributions include:

* LangGraph workflow design
* Self-reflection loop implementation
* Prompt engineering
* LangChain tool integration
* SSE streaming architecture
* Anti-hallucination strategy design
* PDF parsing workflow
* Internationalization (i18n)
* Frontend implementation using Next.js and Tailwind CSS

## 📸 Screenshots

### Resume Input

![Resume Input](./screenshots/resume-input.png)

### Optimization Result

![Optimization Result](./screenshots/optimization-result.png)

### Agent Execution Flow

![Agent Flow](./screenshots/agent-flow.png)

## Project Status

This project is mainly for portfolio and technical demonstration purposes.

The application demonstrates AI agent orchestration, resume optimization workflows, and anti-hallucination strategies using LangGraph and LangChain.

Screenshots are included to demonstrate the main UI and application flow.

## 🌐 Demo

Live Demo:

https://your-demo-url.vercel.app

## ⚠️ Known Issues

### Gemini Free Tier Limits

The application handles API quota limitations through retry strategies and graceful degradation.

### PDF Parsing Compatibility

LangChain's PDFLoader currently requires:

pdf-parse@1.x

This dependency is pinned via package overrides.
