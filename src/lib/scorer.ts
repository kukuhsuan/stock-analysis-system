export interface ScoreBreakdown {
  fundamental: { total: number; eps: number; roe: number; grossMargin: number; revenueGrowth: number }
  valuation: { total: number; per: number; pbr: number; dividendYield: number; historicalValuation: number }
  technical: { total: number; matrend: number; rsi: number; macd: number; volume: number }
  risk: { total: number; debtRatio: number; revenueDecline: number }
  total: number
  status: string
  statusLabel: string
}

export function calculateScore(data: {
  financials: any[]
  balanceSheet: any[]
  monthlyRevenue: any[]
  technical: any
  per: { per: number | null; pbr: number | null; dividendYield: number | null } | null
}): ScoreBreakdown {
  const { financials, balanceSheet, monthlyRevenue, technical, per } = data

  // ===== 基本面 40分 =====
  // EPS成長 10分
  let epsScore = 0
  const epsData = financials.filter(f => f.eps != null).slice(0, 4)
  if (epsData.length >= 2) {
    const latest = epsData[0]?.eps ?? 0
    const prev = epsData[1]?.eps ?? 0
    if (latest > 0 && latest > prev) epsScore = 10
    else if (latest > 0) epsScore = 6
    else if (latest > -1) epsScore = 3
  } else if (epsData.length === 1 && (epsData[0]?.eps ?? 0) > 0) {
    epsScore = 5
  }

  // ROE 10分（用淨利 / 權益估算）
  let roeScore = 0
  const bs = balanceSheet[0]
  const fi = financials[0]
  if (bs && fi && bs.totalEquity && fi.netIncome) {
    const roe = (fi.netIncome / bs.totalEquity) * 100
    if (roe >= 20) roeScore = 10
    else if (roe >= 15) roeScore = 8
    else if (roe >= 10) roeScore = 6
    else if (roe >= 5) roeScore = 3
  } else {
    roeScore = 5 // 資料不足給中間分
  }

  // 毛利率 10分
  let grossMarginScore = 0
  const withGross = financials.filter(f => f.grossProfit != null && f.revenue != null && f.revenue > 0).slice(0, 4)
  if (withGross.length >= 1) {
    const margins = withGross.map(f => (f.grossProfit / f.revenue) * 100)
    const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length
    if (avgMargin >= 50) grossMarginScore = 10
    else if (avgMargin >= 30) grossMarginScore = 8
    else if (avgMargin >= 20) grossMarginScore = 6
    else if (avgMargin >= 10) grossMarginScore = 4
    else grossMarginScore = 2
  } else {
    grossMarginScore = 5
  }

  // 月營收成長 10分
  let revenueGrowthScore = 0
  if (monthlyRevenue.length >= 13) {
    const latest = monthlyRevenue[0]
    const yearAgo = monthlyRevenue[12]
    if (latest?.revenue && yearAgo?.revenue) {
      const yoy = ((latest.revenue - yearAgo.revenue) / yearAgo.revenue) * 100
      if (yoy >= 20) revenueGrowthScore = 10
      else if (yoy >= 10) revenueGrowthScore = 8
      else if (yoy >= 0) revenueGrowthScore = 5
      else if (yoy >= -10) revenueGrowthScore = 3
      else revenueGrowthScore = 0
    } else revenueGrowthScore = 5
  } else revenueGrowthScore = 5

  const fundamentalTotal = epsScore + roeScore + grossMarginScore + revenueGrowthScore

  // ===== 估值 25分 =====
  // 本益比 10分
  let perScore = 0
  if (per?.per != null) {
    if (per.per < 10) perScore = 10
    else if (per.per < 15) perScore = 8
    else if (per.per < 20) perScore = 6
    else if (per.per < 25) perScore = 4
    else if (per.per < 30) perScore = 2
    else perScore = 0
  } else perScore = 5

  // 股價淨值比 5分
  let pbrScore = 0
  if (per?.pbr != null) {
    if (per.pbr < 1) pbrScore = 5
    else if (per.pbr < 2) pbrScore = 4
    else if (per.pbr < 3) pbrScore = 3
    else if (per.pbr < 4) pbrScore = 2
    else pbrScore = 1
  } else pbrScore = 3

  // 殖利率 5分
  let divYieldScore = 0
  if (per?.dividendYield != null) {
    if (per.dividendYield >= 5) divYieldScore = 5
    else if (per.dividendYield >= 3) divYieldScore = 4
    else if (per.dividendYield >= 1) divYieldScore = 2
    else divYieldScore = 1
  } else divYieldScore = 3

  const historicalValuationScore = perScore >= 6 ? 5 : perScore >= 4 ? 3 : 1

  const valuationTotal = perScore + pbrScore + divYieldScore + historicalValuationScore

  // ===== 技術面 25分 =====
  let maTrendScore = 0, rsiScore = 0, macdScore = 0, volumeScore = 0
  if (technical) {
    const { signals, rsi, macd, volume } = technical
    // 均線趨勢 10分
    if (signals.isBullish && signals.isAboveMa60) maTrendScore = 10
    else if (signals.isBullish) maTrendScore = 7
    else if (signals.isAboveMa20) maTrendScore = 5
    else if (signals.isAboveMa60) maTrendScore = 3
    else maTrendScore = 1

    // RSI 5分
    if (rsi >= 40 && rsi <= 60) rsiScore = 5
    else if (rsi >= 30 && rsi <= 70) rsiScore = 4
    else if (rsi < 30) rsiScore = 3 // oversold but risky
    else rsiScore = 1 // overbought

    // MACD 5分
    if (signals.isMACDBullish && macd.histogram > 0) macdScore = 5
    else if (signals.isMACDBullish) macdScore = 4
    else if (macd.histogram > -0.5) macdScore = 3
    else macdScore = 1

    // 成交量 5分
    if (volume.ratio >= 1.5 && signals.isBullish) volumeScore = 5
    else if (volume.ratio >= 1 && volume.ratio < 2) volumeScore = 4
    else if (volume.ratio >= 0.5) volumeScore = 3
    else volumeScore = 2
  } else {
    maTrendScore = 5; rsiScore = 3; macdScore = 3; volumeScore = 3
  }
  const technicalTotal = maTrendScore + rsiScore + macdScore + volumeScore

  // ===== 風險 10分 =====
  // 負債比 5分
  let debtRatioScore = 0
  if (bs && bs.totalAssets && bs.totalLiabilities) {
    const ratio = (bs.totalLiabilities / bs.totalAssets) * 100
    if (ratio < 30) debtRatioScore = 5
    else if (ratio < 50) debtRatioScore = 4
    else if (ratio < 60) debtRatioScore = 3
    else if (ratio < 70) debtRatioScore = 2
    else debtRatioScore = 1
  } else debtRatioScore = 3

  // 營收衰退風險 5分
  let revenueDeclineScore = 0
  if (monthlyRevenue.length >= 3) {
    const recent3 = monthlyRevenue.slice(0, 3)
    const isDeclineTrend = recent3[0]?.revenue < recent3[1]?.revenue && recent3[1]?.revenue < recent3[2]?.revenue
    if (!isDeclineTrend) revenueDeclineScore = 5
    else revenueDeclineScore = 2
  } else revenueDeclineScore = 3

  const riskTotal = debtRatioScore + revenueDeclineScore

  const total = fundamentalTotal + valuationTotal + technicalTotal + riskTotal

  let status: string, statusLabel: string
  if (total >= 80) { status = 'BUY_WATCH'; statusLabel = '買進觀察' }
  else if (total >= 70) { status = 'BATCH_BUY'; statusLabel = '分批布局' }
  else if (total >= 65) { status = 'HOLD'; statusLabel = '持有' }
  else if (total >= 50) { status = 'WATCH'; statusLabel = '觀望' }
  else if (total >= 35) { status = 'REDUCE'; statusLabel = '減碼提醒' }
  else { status = 'EXIT'; statusLabel = '出場提醒' }

  return {
    fundamental: { total: fundamentalTotal, eps: epsScore, roe: roeScore, grossMargin: grossMarginScore, revenueGrowth: revenueGrowthScore },
    valuation: { total: valuationTotal, per: perScore, pbr: pbrScore, dividendYield: divYieldScore, historicalValuation: historicalValuationScore },
    technical: { total: technicalTotal, matrend: maTrendScore, rsi: rsiScore, macd: macdScore, volume: volumeScore },
    risk: { total: riskTotal, debtRatio: debtRatioScore, revenueDecline: revenueDeclineScore },
    total,
    status,
    statusLabel,
  }
}
