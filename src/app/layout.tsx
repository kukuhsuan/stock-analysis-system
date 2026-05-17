import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI 股票分析系統",
  description: "智能股票健檢分析平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={geist.className}>
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
              <span className="text-blue-600">📊</span>
              AI 股票分析
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">首頁</Link>
              <Link href="/favorites" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">收藏清單</Link>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="mt-16 py-8 border-t border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-400">
            ⚠️ 本平台所有分析僅供參考，非投資建議。投資有風險，請謹慎評估。
          </div>
        </footer>
      </body>
    </html>
  );
}
