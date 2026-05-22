# 简历优化 Agent (Resume Tailor)

基于 LangGraph 的自反思 AI Agent,根据目标岗位 JD 自动优化简历:
**改写 → 评分 → 不达标自动重写**,并实时可视化 Agent 的每一步执行过程。

## ✨ 核心特性

- **自反思循环**:基于 LangGraph 条件边,改写后自动评分,低于阈值则重新优化(最多 3 轮)
- **实时可视化**:通过 SSE 流式展示 Agent 每个节点的执行状态
- **结构化输出**:用 LangChain `withStructuredOutput` + zod 保证评分结果类型安全
- **PDF 解析**:支持上传 PDF 简历,自动提取文本

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| 前端 | React 19 |
| 组件层 | LangChain (PromptTemplate / withStructuredOutput / PDFLoader) |
| 编排层 | LangGraph (StateGraph 自反思循环) |
| 模型 | Google Gemini 2.5 Flash-Lite |

## 🏗 架构

\`\`\`
用户输入(简历 + JD)
      ↓
[改写节点] ←──────┐
      ↓           │ 评分 < 85 且轮数 < 3
[评分节点] ───────┘
      ↓ 达标
   输出优化结果
\`\`\`

## 🚀 本地运行

\`\`\`bash
npm install --legacy-peer-deps
# 在 .env.local 填入 GOOGLE_API_KEY
npm run dev
\`\`\`

访问 http://localhost:3000

## 📝 说明

- Gemini 免费层有速率限制(15 RPM),项目实现了指数退避重试
- 演示请使用脱敏简历,避免上传真实隐私信息