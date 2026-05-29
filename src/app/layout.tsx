import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "简历优化 Agent",
  description: "LangGraph 驱动的简历优化助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" >
      <body>{children}</body>
    </html>
  );
}



