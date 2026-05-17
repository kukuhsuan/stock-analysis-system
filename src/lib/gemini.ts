import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function analyzeStockWithAI(stockData: {
  symbol: string
  name: string
  price: any
  per: any
  financials: any[]
  balanceSheet: any[]
  monthlyRevenue: any[]
  technical: any
  institutional: any
  score: any
}): Promise<{
  summary: string
  strengths: string[]
  risks: string[]
  strategy: string
  fundamentalAnalysis: string
  valuationAnalysis: string
  technicalAnalysis: string
  riskAnalysis: string
  finalStatus: string
  finalStatusLabel: string
  disclaimer: string
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `你是一位專業的台灣股票分析師。請根據以下股票資料，產生一份詳細的股票分析報告。

**股票資訊：**
- 股票代號：${stockData.symbol}
- 公司名稱：${stockData.name}
- 目前股價：${stockData.price?.close ?? 'N/A'} 元
- 漲跌幅：${stockData.price?.changePercent?.toFixed(2) ?? 'N/A'}%

**估值指標：**
- 本益比 PER：${stockData.per?.per ?? 'N/A'}
- 股價淨值比 PBR：${stockData.per?.pbr ?? 'N/A'}
- 殖利率：${stockData.per?.dividendYield ?? 'N/A'}%

**近四季財報（最新在前）：**
${stockData.financials.slice(0, 4).map(f => `- ${f.date} ${f.type}: EPS ${f.eps ?? 'N/A'} 元, 毛利 ${f.grossProfit != null ? (f.grossProfit / 1e8).toFixed(2) : 'N/A'} 億, 營收 ${f.revenue != null ? (f.revenue / 1e8).toFixed(2) : 'N/A'} 億`).join('\n')}

**資產負債表（最新）：**
- 總資產：${stockData.balanceSheet[0]?.totalAssets != null ? (stockData.balanceSheet[0].totalAssets / 1e8).toFixed(2) : 'N/A'} 億
- 總負債：${stockData.balanceSheet[0]?.totalLiabilities != null ? (stockData.balanceSheet[0].totalLiabilities / 1e8).toFixed(2) : 'N/A'} 億
- 淨值：${stockData.balanceSheet[0]?.totalEquity != null ? (stockData.balanceSheet[0].totalEquity / 1e8).toFixed(2) : 'N/A'} 億
${stockData.balanceSheet[0]?.totalAssets && stockData.balanceSheet[0]?.totalLiabilities ? `- 負債比：${((stockData.balanceSheet[0].totalLiabilities / stockData.balanceSheet[0].totalAssets) * 100).toFixed(1)}%` : ''}

**近三個月營收：**
${stockData.monthlyRevenue.slice(0, 3).map(r => `- ${r.revenue_year}/${r.revenue_month}: ${(r.revenue / 1e8).toFixed(2)} 億`).join('\n')}

**技術指標：**
- MA5：${stockData.technical?.ma5 ?? 'N/A'}
- MA20：${stockData.technical?.ma20 ?? 'N/A'}
- MA60：${stockData.technical?.ma60 ?? 'N/A'}
- RSI：${stockData.technical?.rsi ?? 'N/A'}
- MACD：${stockData.technical?.macd?.macd ?? 'N/A'} / Signal：${stockData.technical?.macd?.signal ?? 'N/A'}
- KD：K=${stockData.technical?.kd?.k ?? 'N/A'} / D=${stockData.technical?.kd?.d ?? 'N/A'}
- 成交量比率：${stockData.technical?.volume?.ratio ?? 'N/A'}（相對20日均量）

**系統評分：${stockData.score.total}/100 分（${stockData.score.statusLabel}）**
- 基本面：${stockData.score.fundamental.total}/40
- 估值：${stockData.score.valuation.total}/25
- 技術面：${stockData.score.technical.total}/25
- 風險：${stockData.score.risk.total}/10

請用以下 JSON 格式回應（請直接輸出 JSON，不要加 markdown 代碼塊）：
{
  "summary": "200字以內的整體摘要",
  "strengths": ["優點1", "優點2", "優點3"],
  "risks": ["風險1", "風險2", "風險3"],
  "strategy": "100字以內的建議策略",
  "fundamentalAnalysis": "150字基本面分析",
  "valuationAnalysis": "100字估值分析",
  "technicalAnalysis": "150字技術面分析",
  "riskAnalysis": "100字風險分析",
  "finalStatus": "${stockData.score.status}",
  "finalStatusLabel": "${stockData.score.statusLabel}"
}

**重要限制：**
- 禁止保證獲利或保證上漲
- 禁止叫使用者重壓
- 所有分析都是供參考，非投資建議
- 保持客觀、數據導向的分析語氣
- 請用繁體中文回答`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const jsonText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonText)
    return {
      ...parsed,
      disclaimer: '⚠️ 本分析僅供參考，非投資建議。投資有風險，請謹慎評估並自行負責投資決策。',
    }
  } catch (error) {
    return {
      summary: '無法取得 AI 分析，請稍後再試。',
      strengths: [],
      risks: [],
      strategy: '請稍後重新分析。',
      fundamentalAnalysis: '資料取得中...',
      valuationAnalysis: '資料取得中...',
      technicalAnalysis: '資料取得中...',
      riskAnalysis: '資料取得中...',
      finalStatus: stockData.score.status,
      finalStatusLabel: stockData.score.statusLabel,
      disclaimer: '⚠️ 本分析僅供參考，非投資建議。投資有風險，請謹慎評估並自行負責投資決策。',
    }
  }
}
