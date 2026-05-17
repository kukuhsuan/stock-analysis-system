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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `你是一位親切的投資入門導師，專門幫助沒有財經背景的股市新手看懂股票。請根據以下資料，用「跟朋友說話」的口吻寫分析報告——不用艱深術語，遇到專有名詞要用括號簡單解釋。

**股票資訊：**
- 股票代號：${stockData.symbol}
- 公司名稱：${stockData.name}
- 目前股價：${stockData.price?.close ?? 'N/A'} 元
- 今日漲跌：${stockData.price?.changePercent?.toFixed(2) ?? 'N/A'}%

**估值指標：**
- 本益比 PER：${stockData.per?.per ?? 'N/A'}（你付多少錢買 1 元的獲利，越低越便宜）
- 股價淨值比 PBR：${stockData.per?.pbr ?? 'N/A'}（股價是公司帳面價值的幾倍）
- 殖利率：${stockData.per?.dividendYield ?? 'N/A'}%（每年配息佔股價的比例，像定存利率）

**近四季財報（最新在前）：**
${stockData.financials.slice(0, 4).map(f => `- ${f.date}: 每股賺 ${f.eps ?? 'N/A'} 元（EPS）, 毛利 ${f.grossProfit != null ? (f.grossProfit / 1e8).toFixed(2) : 'N/A'} 億, 營收 ${f.revenue != null ? (f.revenue / 1e8).toFixed(2) : 'N/A'} 億`).join('\n')}

**資產負債表（最新）：**
- 公司總資產：${stockData.balanceSheet[0]?.totalAssets != null ? (stockData.balanceSheet[0].totalAssets / 1e8).toFixed(2) : 'N/A'} 億
- 欠別人的錢（負債）：${stockData.balanceSheet[0]?.totalLiabilities != null ? (stockData.balanceSheet[0].totalLiabilities / 1e8).toFixed(2) : 'N/A'} 億
- 真正屬於股東的（淨值）：${stockData.balanceSheet[0]?.totalEquity != null ? (stockData.balanceSheet[0].totalEquity / 1e8).toFixed(2) : 'N/A'} 億
${stockData.balanceSheet[0]?.totalAssets && stockData.balanceSheet[0]?.totalLiabilities ? `- 負債比：${((stockData.balanceSheet[0].totalLiabilities / stockData.balanceSheet[0].totalAssets) * 100).toFixed(1)}%（越低越安全，低於 50% 通常不錯）` : ''}

**近三個月營收：**
${stockData.monthlyRevenue.slice(0, 3).map(r => `- ${r.revenue_year}/${r.revenue_month}: ${(r.revenue / 1e8).toFixed(2)} 億`).join('\n')}

**技術面（股價走勢訊號）：**
- 5日均線 MA5：${stockData.technical?.ma5 ?? 'N/A'}（近一週平均股價）
- 20日均線 MA20：${stockData.technical?.ma20 ?? 'N/A'}（近一月平均股價）
- 60日均線 MA60：${stockData.technical?.ma60 ?? 'N/A'}（近三月平均股價）
- RSI 強弱指標：${stockData.technical?.rsi ?? 'N/A'}（30以下超賣、70以上超買）
- MACD 動能指標：${stockData.technical?.macd?.macd ?? 'N/A'} / 訊號線：${stockData.technical?.macd?.signal ?? 'N/A'}
- KD 隨機指標：K=${stockData.technical?.kd?.k ?? 'N/A'} / D=${stockData.technical?.kd?.d ?? 'N/A'}（20以下偏低、80以上偏高）
- 成交量：${stockData.technical?.volume?.ratio ?? 'N/A'} 倍（相對近一月平均，>1.5 代表成交熱絡）

**系統綜合評分：${stockData.score.total}/100 分（${stockData.score.statusLabel}）**
- 基本面（公司賺不賺錢）：${stockData.score.fundamental.total}/40
- 估值（股價貴不貴）：${stockData.score.valuation.total}/25
- 技術面（走勢好不好）：${stockData.score.technical.total}/25
- 風險（穩不穩）：${stockData.score.risk.total}/10

**寫作要求：**
1. 用朋友聊天的口吻，不要像新聞稿
2. 遇到專有名詞，第一次出現時加括號解釋（例：EPS（每股盈餘，代表每股賺多少錢））
3. 用比喻讓數字有感（例：「負債比只有 30%，就像房貸不到三成，財務很健康」）
4. 優缺點各寫 3 點，每點一句話，直接說重點
5. 策略要給出明確情境（什麼狀況可以考慮買、什麼狀況先觀望）

請用以下 JSON 格式回應（請直接輸出 JSON，不要加 markdown 代碼塊）：
{
  "summary": "200字以內、口語化的整體摘要，讓完全不懂股票的人也能讀懂",
  "strengths": ["優點1（一句話，有數據佐證）", "優點2", "優點3"],
  "risks": ["風險1（一句話，說清楚風險在哪）", "風險2", "風險3"],
  "strategy": "100字以內的入門友善建議，說明什麼情況可考慮進場、什麼情況觀望",
  "fundamentalAnalysis": "150字，用生活化方式解釋公司的獲利狀況和財務健康度",
  "valuationAnalysis": "100字，用比喻說明現在股價貴不貴、值不值得買",
  "technicalAnalysis": "150字，用天氣或交通比喻說明目前走勢訊號",
  "riskAnalysis": "100字，用白話說明主要風險，不用技術術語",
  "finalStatus": "${stockData.score.status}",
  "finalStatusLabel": "${stockData.score.statusLabel}"
}

**絕對禁止：**
- 不能保證獲利或說「一定會漲」
- 不能叫人全押或重倉
- 所有分析僅供參考，非投資建議
- 請用繁體中文回答`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    // Extract JSON - handle various formats Gemini might return
    let jsonText = text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) jsonText = jsonMatch[0]
    else jsonText = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
    const parsed = JSON.parse(jsonText)
    return {
      ...parsed,
      disclaimer: '⚠️ 本分析僅供參考，非投資建議。投資有風險，請謹慎評估並自行負責投資決策。',
    }
  } catch (error) {
    console.error('Gemini analysis error:', error)
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
