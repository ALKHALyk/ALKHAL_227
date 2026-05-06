// ============================================================
// ALKHAL227 — Forecast Engine
// © ALKHAL_YOUSEF_FUAD_KAMEL — All Rights Reserved
// ============================================================

function generateForecast(analyses, candles) {
  if (!analyses || !candles || candles.length < 2) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const { direction, weeklyHighLow, thuFriMon, lowerHighLow, consecutive, barPatterns, breakCont, candleRatios, abnormal, gaps } = analyses;

  const signals = [];
  const MIN_N = 20;

  // Helper: add signal
  function addSignal(name, bullPct, n, description) {
    if (n < MIN_N) return;
    const bias = bullPct > 60 ? 'BULLISH' : bullPct < 40 ? 'BEARISH' : 'NEUTRAL';
    signals.push({ name, bullPct, bearPct: 100 - bullPct, n, bias, description });
  }

  // 1. Day-of-week direction
  addSignal('Day-of-Week Bias', direction.PC, direction.n,
    `After ${direction.dayName}: ${direction.PC}% positive close rate`);

  // 2. High break probability
  addSignal('High Break Probability', direction.HB, direction.n,
    `${direction.HB}% chance tomorrow breaks today's high`);

  // 3. Consecutive sequence
  let posRun = 0, negRun = 0;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].close > candles[i].open) { if (negRun > 0) break; posRun++; }
    else if (candles[i].close < candles[i].open) { if (posRun > 0) break; negRun++; }
    else break;
  }
  if (posRun >= 2) {
    const row = consecutive.posTable.find(r => r.run === Math.min(posRun, 10));
    if (row && row.n >= MIN_N) {
      addSignal(`After ${posRun}+ Up Candles`, 100 - row.nextNeg, row.n,
        `Reversal probability: ${row.nextNeg}%`);
    }
  }
  if (negRun >= 2) {
    const row = consecutive.negTable.find(r => r.run === Math.min(negRun, 10));
    if (row && row.n >= MIN_N) {
      addSignal(`After ${negRun}+ Down Candles`, row.nextPos, row.n,
        `Reversal probability: ${row.nextPos}%`);
    }
  }

  // 4. Inside bar
  if (last.high < prev.high && last.low > prev.low) {
    addSignal('Inside Bar Pattern', barPatterns.insideBar.nextPos, barPatterns.insideBar.total,
      `Inside bar detected — next day positive: ${barPatterns.insideBar.nextPos}%`);
  }

  // 5. Engulfing
  if (last.high > prev.high && last.low < prev.low) {
    const ib = barPatterns.engulfing;
    addSignal('Outside Bar (Engulfing)', ib.breakHigh, ib.total,
      `Engulfing: break high ${ib.breakHigh}% vs break low ${ib.breakLow}%`);
  }

  // 6. Lower high
  if (last.high < prev.high) {
    const lh = lowerHighLow.lowerHigh;
    addSignal('Lower High Detected', lh.nextDayPos, lh.total,
      `Lower High: next day positive ${lh.nextDayPos}%`);
  }

  // 7. Body-to-range ratio
  const br = Math.abs(last.close - last.open) / (last.high - last.low || 1);
  if (br > 0.6) {
    addSignal('High Body Ratio Candle', candleRatios.highBodyRatio.nextPos, candleRatios.highBodyRatio.n,
      `Strong body (${Math.round(br * 100)}% ratio) — continuation: ${candleRatios.highBodyRatio.nextPos}%`);
  }

  // 8. Close above/below midpoint
  const cp = (last.close - last.low) / ((last.high - last.low) || 1);
  if (cp > 0.5) {
    addSignal('Close Above Midpoint', candleRatios.aboveMidpoint.nextPos, candleRatios.aboveMidpoint.n,
      `Closed above midpoint — next day positive: ${candleRatios.aboveMidpoint.nextPos}%`);
  } else {
    addSignal('Close Below Midpoint', candleRatios.belowMidpoint.nextPos, candleRatios.belowMidpoint.n,
      `Closed below midpoint — next day positive: ${candleRatios.belowMidpoint.nextPos}%`);
  }

  // 9. Thu/Fri/Mon pattern (if today is Friday)
  const lastDow = new Date(last.date + 'T00:00:00').getDay();
  if (lastDow === 5) { // Friday — check Thu/Fri pattern
    const thu = candles[candles.length - 2];
    if (thu && new Date(thu.date + 'T00:00:00').getDay() === 4) {
      const thuPos = thu.close > thu.open;
      const friPos = last.close > last.open;
      let patternKey = thuPos && friPos ? 'C' : !thuPos && !friPos ? 'D' : !thuPos && friPos ? 'A' : 'B';
      const pattern = thuFriMon.find(p => p.pattern === patternKey);
      if (pattern && pattern.n >= MIN_N) {
        addSignal(`Thu/Fri Pattern ${patternKey} (${pattern.label})`, pattern.bullPct, pattern.n,
          `Monday forecast: ${pattern.bias} (${pattern.bullPct}% bullish)`);
      }
    }
  }

  // Tally
  const bullish = signals.filter(s => s.bias === 'BULLISH').length;
  const bearish = signals.filter(s => s.bias === 'BEARISH').length;
  const total   = signals.filter(s => s.bias !== 'NEUTRAL').length;
  const agreePct = total > 0 ? Math.round(Math.max(bullish, bearish) / total * 100) : 50;

  const overallBias = bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'NEUTRAL';
  const confidence = agreePct > 70 ? 'HIGH' : agreePct > 50 ? 'MEDIUM' : 'LOW';

  // Scenario targets (using avg range)
  const avgRng = analyses.candleRatios.avgRange;
  const scenarioBull = last.high + avgRng;
  const scenarioBear = last.low  - avgRng;

  return {
    date: last.date,
    lastCandle: last,
    signals,
    bullish, bearish,
    total: signals.length,
    agreePct,
    overallBias,
    confidence,
    scenarioBull: Math.round(scenarioBull * 100000) / 100000,
    scenarioBear: Math.round(scenarioBear * 100000) / 100000,
    scenarioRange: { h: last.high, l: last.low },
    KPIs: { PC: direction.PC, NC: direction.NC, HB: direction.HB, LB: direction.LB, n: direction.n },
  };
}

window.Forecast = { generateForecast };
