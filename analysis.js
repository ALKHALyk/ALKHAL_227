// ============================================================
// ALKHAL227 — Statistical Analysis Engine (5.1 – 5.14)
// © ALKHAL_YOUSEF_FUAD_KAMEL — All Rights Reserved
// ============================================================

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay(); // 0=Sun
}

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d - startOfWeek1;
  return Math.floor(diff / (7 * 86400000)) + 1;
}

function isPositive(c) { return c.close > c.open; }
function isNegative(c) { return c.close < c.open; }
function range(c)      { return c.high - c.low; }
function body(c)       { return Math.abs(c.close - c.open); }
function bodyRatio(c)  { const r = range(c); return r === 0 ? 0 : body(c) / r; }
function midpoint(c)   { return (c.high + c.low) / 2; }
function closePos(c)   { const r = range(c); return r === 0 ? 0.5 : (c.close - c.low) / r; }

function pct(num, den) { return den === 0 ? 0 : Math.round((num / den) * 1000) / 10; }

// ─────────────────────────────────────────────────────────────
// 5.1 — DAILY DIRECTION PROBABILITIES
// ─────────────────────────────────────────────────────────────
function calcDirectionProbabilities(candles, filterDow = null) {
  // Context-aware: filter by day-of-week of the CURRENT candle
  // filterDow: if set, only look at candles where prev candle was that dow
  let pairs = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const prevDow = getWeekday(prev.date);
    if (filterDow !== null && prevDow !== filterDow) continue;
    pairs.push({ prev, curr });
  }

  const n = pairs.length;
  const posClose = pairs.filter(p => isPositive(p.curr)).length;
  const negClose = pairs.filter(p => isNegative(p.curr)).length;
  const highBreak = pairs.filter(p => p.curr.high > p.prev.high).length;
  const lowBreak  = pairs.filter(p => p.curr.low < p.prev.low).length;

  const dayName = filterDow !== null ? DAYS[filterDow] : 'All Days';

  return {
    n,
    dayName,
    PC: pct(posClose, n),
    NC: pct(negClose, n),
    HB: pct(highBreak, n),
    LB: pct(lowBreak, n),
  };
}

// ─────────────────────────────────────────────────────────────
// 5.2 — WEEKLY HIGH/LOW ANALYSIS
// ─────────────────────────────────────────────────────────────
function calcWeeklyHighLow(candles) {
  // Group candles by ISO week
  const weeks = {};
  candles.forEach(c => {
    const wk = `${new Date(c.date + 'T00:00:00').getFullYear()}-W${String(getISOWeek(c.date)).padStart(2,'0')}`;
    if (!weeks[wk]) weeks[wk] = [];
    weeks[wk].push(c);
  });

  const highDow = [0,0,0,0,0,0,0]; // indexed by dow
  const lowDow  = [0,0,0,0,0,0,0];
  let totalWeeks = 0;

  // For consecutive week same-day high/low
  const weekKeys = Object.keys(weeks).sort();
  const highDowByWeek = {}; // weekKey -> dow that formed high
  const lowDowByWeek  = {};

  weekKeys.forEach(wk => {
    const wcandles = weeks[wk];
    if (wcandles.length < 3) return; // Skip incomplete weeks
    totalWeeks++;

    const maxHigh = Math.max(...wcandles.map(c => c.high));
    const minLow  = Math.min(...wcandles.map(c => c.low));

    // Find first candle that formed the high/low
    const highCandle = wcandles.find(c => c.high === maxHigh);
    const lowCandle  = wcandles.find(c => c.low  === minLow);

    if (highCandle) { highDow[getWeekday(highCandle.date)]++; highDowByWeek[wk] = getWeekday(highCandle.date); }
    if (lowCandle)  { lowDow[getWeekday(lowCandle.date)]++;   lowDowByWeek[wk]  = getWeekday(lowCandle.date); }
  });

  // Consecutive same-day high
  const consecutiveHigh = {};
  const consecutiveLow  = {};
  for (let i = 1; i < weekKeys.length; i++) {
    const d1 = highDowByWeek[weekKeys[i-1]];
    const d2 = highDowByWeek[weekKeys[i]];
    if (d1 !== undefined && d2 !== undefined && d1 === d2) {
      consecutiveHigh[d1] = (consecutiveHigh[d1] || 0) + 1;
    }
    const e1 = lowDowByWeek[weekKeys[i-1]];
    const e2 = lowDowByWeek[weekKeys[i]];
    if (e1 !== undefined && e2 !== undefined && e1 === e2) {
      consecutiveLow[e1] = (consecutiveLow[e1] || 0) + 1;
    }
  }

  return {
    totalWeeks,
    highByDow: highDow.map((count, dow) => ({ dow, name: DAYS_SHORT[dow], count, pct: pct(count, totalWeeks) })),
    lowByDow:  lowDow.map((count, dow)  => ({ dow, name: DAYS_SHORT[dow], count, pct: pct(count, totalWeeks) })),
    consecutiveHigh: Object.entries(consecutiveHigh).map(([dow, count]) => ({
      dow: parseInt(dow), name: DAYS_SHORT[parseInt(dow)], count, pct: pct(count, totalWeeks)
    })),
    consecutiveLow: Object.entries(consecutiveLow).map(([dow, count]) => ({
      dow: parseInt(dow), name: DAYS_SHORT[parseInt(dow)], count, pct: pct(count, totalWeeks)
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// 5.3 — DAILY HIGH/LOW FORMATION HOURS (placeholder — needs hourly data)
// ─────────────────────────────────────────────────────────────
function calcDailyHighLowHours(hourlyByDate, dailyCandles) {
  const highHour = new Array(24).fill(0);
  const lowHour  = new Array(24).fill(0);
  let totalDays = 0;

  for (const [date, hourCandles] of Object.entries(hourlyByDate)) {
    if (!hourCandles || hourCandles.length === 0) continue;
    totalDays++;
    const maxH = Math.max(...hourCandles.map(c => c.high));
    const minL  = Math.min(...hourCandles.map(c => c.low));
    const hCandle = hourCandles.find(c => c.high === maxH);
    const lCandle = hourCandles.find(c => c.low === minL);
    if (hCandle) { const h = parseInt(hCandle.datetime.split(' ')[1]?.split(':')[0] || 0); highHour[h]++; }
    if (lCandle) { const h = parseInt(lCandle.datetime.split(' ')[1]?.split(':')[0] || 0); lowHour[h]++;  }
  }

  return {
    totalDays,
    highByHour: highHour.map((count, h) => ({ hour: h, count, pct: pct(count, totalDays) })),
    lowByHour:  lowHour.map((count, h)  => ({ hour: h, count, pct: pct(count, totalDays) })),
  };
}

// ─────────────────────────────────────────────────────────────
// 5.4 — THURSDAY/FRIDAY/MONDAY PATTERNS
// ─────────────────────────────────────────────────────────────
function calcThuFriMonPattern(candles) {
  const results = { A: {n:0,bull:0,bear:0}, B: {n:0,bull:0,bear:0}, C: {n:0,bull:0,bear:0}, D: {n:0,bull:0,bear:0} };
  
  // Group by week
  const weeks = {};
  candles.forEach(c => {
    const dow = getWeekday(c.date);
    const wk = `${new Date(c.date + 'T00:00:00').getFullYear()}-W${String(getISOWeek(c.date)).padStart(2,'0')}`;
    if (!weeks[wk]) weeks[wk] = {};
    weeks[wk][dow] = c;
  });

  const weekKeys = Object.keys(weeks).sort();
  for (let i = 0; i < weekKeys.length - 1; i++) {
    const thisWeek = weeks[weekKeys[i]];
    const nextWeek = weeks[weekKeys[i + 1]];
    const thu = thisWeek[4]; // Thursday
    const fri = thisWeek[5]; // Friday
    const mon = nextWeek[1]; // Next Monday

    if (!thu || !fri || !mon) continue;

    const thuPos = isPositive(thu);
    const friPos = isPositive(fri);
    const monPos = isPositive(mon);

    let pattern = null;
    if (!thuPos && friPos)  pattern = 'A'; // Thu neg, Fri pos
    if (thuPos  && !friPos) pattern = 'B'; // Thu pos, Fri neg
    if (thuPos  && friPos)  pattern = 'C'; // Both pos
    if (!thuPos && !friPos) pattern = 'D'; // Both neg

    if (pattern) {
      results[pattern].n++;
      if (monPos) results[pattern].bull++;
      else results[pattern].bear++;
    }
  }

  return Object.entries(results).map(([key, r]) => ({
    pattern: key,
    label: {A:'Thu−/Fri+', B:'Thu+/Fri−', C:'Thu+/Fri+', D:'Thu−/Fri−'}[key],
    n: r.n,
    bullPct: pct(r.bull, r.n),
    bearPct: pct(r.bear, r.n),
    bias: r.bull > r.bear ? 'BULLISH' : r.bear > r.bull ? 'BEARISH' : 'NEUTRAL'
  }));
}

// ─────────────────────────────────────────────────────────────
// 5.5 — LOWER HIGH / LOWER LOW PATTERNS
// ─────────────────────────────────────────────────────────────
function calcLowerHighLow(candles) {
  let lhTotal = 0, lhNextPos = 0, lhBreakHigh = 0, lhExtendLow = 0;
  let lhPosClose = {total:0, nextPos:0};
  let lhNegClose = {total:0, nextPos:0};

  // Tuesday Lower Low
  let tueLLCount = 0, tueLLWeekLow = 0, tueLLClose = 0, monNegTueLLClose = 0, monNegTueLLTotal = 0;

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    // Lower High pattern
    if (curr.high < prev.high) {
      lhTotal++;
      if (isPositive(next)) lhNextPos++;
      if (next.high > prev.high) lhBreakHigh++;
      if (next.low < curr.low)   lhExtendLow++;

      if (isPositive(curr))  { lhPosClose.total++; if (isPositive(next)) lhPosClose.nextPos++; }
      if (isNegative(curr))  { lhNegClose.total++; if (isPositive(next)) lhNegClose.nextPos++; }
    }

    // Tuesday Lower Low
    if (getWeekday(curr.date) === 2 && curr.low < prev.low) { // Tuesday
      tueLLCount++;
      if (isPositive(curr)) tueLLClose++;
      // Check if this becomes weekly low
      // Look for remaining week candles
      let isWeekLow = true;
      for (let j = i + 1; j < candles.length && getWeekday(candles[j].date) !== 1; j++) {
        if (candles[j].low < curr.low) { isWeekLow = false; break; }
      }
      if (isWeekLow) tueLLWeekLow++;

      // Monday negative + Tuesday lower low
      if (getWeekday(prev.date) === 1 && isNegative(prev)) {
        monNegTueLLTotal++;
        if (isPositive(curr)) monNegTueLLClose++;
      }
    }
  }

  return {
    lowerHigh: {
      total: lhTotal,
      nextDayPos: pct(lhNextPos, lhTotal),
      breaksHigh: pct(lhBreakHigh, lhTotal),
      extendsLow: pct(lhExtendLow, lhTotal),
      ifPosClose: { n: lhPosClose.total, nextPos: pct(lhPosClose.nextPos, lhPosClose.total) },
      ifNegClose: { n: lhNegClose.total, nextPos: pct(lhNegClose.nextPos, lhNegClose.total) },
    },
    tuesdayLL: {
      total: tueLLCount,
      becomesWeekLow: pct(tueLLWeekLow, tueLLCount),
      closesPositive: pct(tueLLClose, tueLLCount),
      monNegPlus: { n: monNegTueLLTotal, closesPos: pct(monNegTueLLClose, monNegTueLLTotal) }
    }
  };
}

// ─────────────────────────────────────────────────────────────
// 5.6 — CONSECUTIVE CANDLE SEQUENCES
// ─────────────────────────────────────────────────────────────
function calcConsecutive(candles) {
  const MAX = 10;
  const posRuns = {}; // runLength -> {total, nextPos}
  const negRuns = {};

  let posRun = 0, negRun = 0;
  for (let i = 0; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];

    if (isPositive(c)) { posRun++; negRun = 0; }
    else if (isNegative(c)) { negRun++; posRun = 0; }
    else { posRun = 0; negRun = 0; }

    if (posRun >= 2) {
      const key = Math.min(posRun, MAX);
      if (!posRuns[key]) posRuns[key] = {total:0, nextPos:0};
      posRuns[key].total++;
      if (isPositive(next)) posRuns[key].nextPos++;
    }
    if (negRun >= 2) {
      const key = Math.min(negRun, MAX);
      if (!negRuns[key]) negRuns[key] = {total:0, nextPos:0};
      negRuns[key].total++;
      if (isPositive(next)) negRuns[key].nextPos++;
    }
  }

  const posTable = Object.entries(posRuns).map(([len, d]) => ({
    run: parseInt(len), label: `${len}+ Consecutive Up`,
    n: d.total, nextPos: pct(d.nextPos, d.total), nextNeg: pct(d.total - d.nextPos, d.total),
    reversalZone: pct(d.total - d.nextPos, d.total) > 60
  })).sort((a,b) => a.run - b.run);

  const negTable = Object.entries(negRuns).map(([len, d]) => ({
    run: parseInt(len), label: `${len}+ Consecutive Down`,
    n: d.total, nextPos: pct(d.nextPos, d.total), nextNeg: pct(d.total - d.nextPos, d.total),
    reversalZone: pct(d.nextPos, d.total) > 60
  })).sort((a,b) => a.run - b.run);

  return { posTable, negTable };
}

// ─────────────────────────────────────────────────────────────
// 5.7 — INSIDE BAR / ENGULFING PATTERNS
// ─────────────────────────────────────────────────────────────
function calcBarPatterns(candles) {
  let ibTotal = 0, ibNextPos = 0, ibExpand = 0;
  let obTotal = 0, obBreakHigh = 0, obBreakLow = 0;
  const obByDow = [0,0,0,0,0,0,0];

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    const insideBar = curr.high < prev.high && curr.low > prev.low;
    const engulfing = curr.high > prev.high && curr.low < prev.low;

    if (insideBar) {
      ibTotal++;
      if (isPositive(next)) ibNextPos++;
      if (range(next) > range(curr)) ibExpand++;
    }

    if (engulfing) {
      obTotal++;
      obByDow[getWeekday(curr.date)]++;
      if (next.high > curr.high) obBreakHigh++;
      if (next.low < curr.low)   obBreakLow++;
    }
  }

  return {
    insideBar: {
      total: ibTotal,
      nextPos: pct(ibNextPos, ibTotal),
      expansion: pct(ibExpand, ibTotal),
    },
    engulfing: {
      total: obTotal,
      byDow: obByDow.map((c, d) => ({ dow: d, name: DAYS_SHORT[d], count: c, pct: pct(c, obTotal) })),
      breakHigh: pct(obBreakHigh, obTotal),
      breakLow:  pct(obBreakLow, obTotal),
    }
  };
}

// ─────────────────────────────────────────────────────────────
// 5.8 — HIGH/LOW BREAK CONTINUATION
// ─────────────────────────────────────────────────────────────
function calcBreakContinuation(candles) {
  let hbTotal = 0, hbContinues = 0;
  let lbTotal = 0, lbContinues = 0;
  const hbByDow = [0,0,0,0,0,0,0];
  const lbByDow = [0,0,0,0,0,0,0];
  const hbContByDow = [0,0,0,0,0,0,0];
  const lbContByDow = [0,0,0,0,0,0,0];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const dow = getWeekday(curr.date);
    const target = range(prev) * 0.5;

    if (curr.high > prev.high) {
      hbTotal++;
      hbByDow[dow]++;
      if (curr.high - prev.high >= target) { hbContinues++; hbContByDow[dow]++; }
    }

    if (curr.low < prev.low) {
      lbTotal++;
      lbByDow[dow]++;
      if (prev.low - curr.low >= target) { lbContinues++; lbContByDow[dow]++; }
    }
  }

  return {
    highBreak: {
      total: hbTotal,
      continuation: pct(hbContinues, hbTotal),
      byDow: hbByDow.map((c, d) => ({ dow: d, name: DAYS_SHORT[d], count: c, contCount: hbContByDow[d], contPct: pct(hbContByDow[d], c) }))
    },
    lowBreak: {
      total: lbTotal,
      continuation: pct(lbContinues, lbTotal),
      byDow: lbByDow.map((c, d) => ({ dow: d, name: DAYS_SHORT[d], count: c, contCount: lbContByDow[d], contPct: pct(lbContByDow[d], c) }))
    }
  };
}

// ─────────────────────────────────────────────────────────────
// 5.9 — CANDLE RANGE, CLOSE, MIDPOINT ANALYSIS
// ─────────────────────────────────────────────────────────────
function calcCandleRatios(candles) {
  let highBR = {total:0, nextPos:0};
  let aboveMid = {total:0, nextPos:0};
  let belowMid = {total:0, nextPos:0};
  const avgRange = candles.reduce((s, c) => s + range(c), 0) / candles.length;
  let largeRange = {total:0, nextPos:0};

  for (let i = 0; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    const br = bodyRatio(c);
    const cp = closePos(c);
    const r  = range(c);

    if (br > 0.6) { highBR.total++; if (isPositive(next)) highBR.nextPos++; }
    if (cp > 0.5) { aboveMid.total++; if (isPositive(next)) aboveMid.nextPos++; }
    else          { belowMid.total++; if (isPositive(next)) belowMid.nextPos++; }
    if (r > avgRange * 1.5) { largeRange.total++; if (isPositive(next)) largeRange.nextPos++; }
  }

  return {
    avgRange: Math.round(avgRange * 100000) / 100000,
    highBodyRatio: { n: highBR.total, nextPos: pct(highBR.nextPos, highBR.total) },
    aboveMidpoint: { n: aboveMid.total, nextPos: pct(aboveMid.nextPos, aboveMid.total) },
    belowMidpoint: { n: belowMid.total, nextPos: pct(belowMid.nextPos, belowMid.total) },
    largeRange:    { n: largeRange.total, nextPos: pct(largeRange.nextPos, largeRange.total) },
  };
}

// ─────────────────────────────────────────────────────────────
// 5.10 — ABNORMAL CANDLES
// ─────────────────────────────────────────────────────────────
function calcAbnormalCandles(candles) {
  const WINDOW = 20;
  const abnormals = [];

  for (let i = WINDOW; i < candles.length - 1; i++) {
    const window = candles.slice(i - WINDOW, i);
    const avgR = window.reduce((s, c) => s + range(c), 0) / WINDOW;
    const c = candles[i];
    if (range(c) > avgR * 2) {
      const next = candles[i + 1];
      abnormals.push({
        date: c.date,
        range: range(c),
        avgRange: avgR,
        multiple: Math.round((range(c) / avgR) * 10) / 10,
        direction: isPositive(c) ? 'UP' : 'DOWN',
        nextPos: isPositive(next),
        nextRange: range(next),
      });
    }
  }

  const upAbnormal = abnormals.filter(a => a.direction === 'UP');
  const downAbnormal = abnormals.filter(a => a.direction === 'DOWN');

  return {
    total: abnormals.length,
    upCount: upAbnormal.length,
    downCount: downAbnormal.length,
    afterUp:   { nextPos: pct(upAbnormal.filter(a => a.nextPos).length, upAbnormal.length) },
    afterDown: { nextPos: pct(downAbnormal.filter(a => a.nextPos).length, downAbnormal.length) },
    recentFive: abnormals.slice(-5).reverse(),
  };
}

// ─────────────────────────────────────────────────────────────
// 5.11 — GAP ANALYSIS
// ─────────────────────────────────────────────────────────────
function calcGapAnalysis(candles) {
  let gapTotal = 0, gapFillSameDay = 0;
  const gapFillDays = {1:0, 2:0, 3:0, 7:0};
  const gaps = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const gap = curr.open - prev.close;
    if (Math.abs(gap) < 0.0001) continue; // No gap

    gapTotal++;
    const direction = gap > 0 ? 'UP' : 'DOWN';
    const size = Math.abs(gap);

    // Fill check: same day
    let filled = false;
    if (direction === 'UP' && curr.low <= prev.close) { gapFillSameDay++; filled = true; }
    if (direction === 'DOWN' && curr.high >= prev.close) { gapFillSameDay++; filled = true; }

    // Multi-day fill
    for (const daysAhead of [1, 2, 3, 7]) {
      if (filled) { gapFillDays[daysAhead]++; continue; }
      const target = daysAhead === 7 ? Math.min(i + 7, candles.length - 1) : Math.min(i + daysAhead, candles.length - 1);
      for (let j = i; j <= target; j++) {
        const fc = candles[j];
        if (direction === 'UP'   && fc.low  <= prev.close) { gapFillDays[daysAhead]++; break; }
        if (direction === 'DOWN' && fc.high >= prev.close) { gapFillDays[daysAhead]++; break; }
      }
    }

    gaps.push({ date: curr.date, direction, size, filled, prev: prev.date });
  }

  return {
    total: gapTotal,
    pctOfCandles: pct(gapTotal, candles.length),
    avgSize: gapTotal ? Math.round(gaps.reduce((s, g) => s + g.size, 0) / gapTotal * 100000) / 100000 : 0,
    fillSameDay: pct(gapFillSameDay, gapTotal),
    fill1Day:  pct(gapFillDays[1], gapTotal),
    fill2Day:  pct(gapFillDays[2], gapTotal),
    fill3Day:  pct(gapFillDays[3], gapTotal),
    fill1Week: pct(gapFillDays[7], gapTotal),
    recentGaps: gaps.slice(-10).reverse(),
  };
}

// ─────────────────────────────────────────────────────────────
// 5.12 — WEEK NUMBER / SEASONAL ANALYSIS
// ─────────────────────────────────────────────────────────────
function calcSeasonalAnalysis(candles) {
  const weekMap = {}; // weekNum -> { dow -> { highCount, lowCount, total } }

  const weeks = {};
  candles.forEach(c => {
    const wk = `${new Date(c.date + 'T00:00:00').getFullYear()}-W${String(getISOWeek(c.date)).padStart(2,'0')}`;
    if (!weeks[wk]) weeks[wk] = [];
    weeks[wk].push(c);
  });

  Object.entries(weeks).forEach(([wk, wcandles]) => {
    if (wcandles.length < 3) return;
    const wkNum = parseInt(wk.split('-W')[1]);
    if (!weekMap[wkNum]) weekMap[wkNum] = {};
    const maxH = Math.max(...wcandles.map(c => c.high));
    const minL  = Math.min(...wcandles.map(c => c.low));
    const highCandle = wcandles.find(c => c.high === maxH);
    const lowCandle  = wcandles.find(c => c.low === minL);

    wcandles.forEach(c => {
      const dow = getWeekday(c.date);
      if (!weekMap[wkNum][dow]) weekMap[wkNum][dow] = { highCount:0, lowCount:0, total:0 };
      weekMap[wkNum][dow].total++;
      if (highCandle && highCandle.date === c.date) weekMap[wkNum][dow].highCount++;
      if (lowCandle  && lowCandle.date  === c.date) weekMap[wkNum][dow].lowCount++;
    });
  });

  // Convert to heatmap arrays
  const heatmap = [];
  for (let wk = 1; wk <= 52; wk++) {
    if (!weekMap[wk]) continue;
    const row = { week: wk, days: [] };
    for (let d = 1; d <= 5; d++) { // Mon-Fri
      const data = weekMap[wk][d] || { highCount: 0, lowCount: 0, total: 0 };
      row.days.push({
        dow: d,
        highPct: pct(data.highCount, data.total),
        lowPct:  pct(data.lowCount, data.total),
        total:   data.total
      });
    }
    heatmap.push(row);
  }

  return { heatmap };
}

// ─────────────────────────────────────────────────────────────
// 5.13 — THURSDAY SPECIAL PATTERN
// ─────────────────────────────────────────────────────────────
function calcThursdaySpecial(candles) {
  const results = { total:0, friPos:0, friBreakHigh:0, friBreakLow:0 };
  const byBodyRatio = { low:{n:0,friPos:0}, mid:{n:0,friPos:0}, high:{n:0,friPos:0} };

  // Group by week for weekly high detection
  const weeks = {};
  candles.forEach(c => {
    const wk = `${new Date(c.date + 'T00:00:00').getFullYear()}-W${String(getISOWeek(c.date)).padStart(2,'0')}`;
    if (!weeks[wk]) weeks[wk] = [];
    weeks[wk].push(c);
  });

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]; // Wednesday
    const curr = candles[i];     // Thursday
    const next = candles[i + 1]; // Friday

    if (getWeekday(curr.date) !== 4) continue; // Must be Thursday
    if (getWeekday(prev.date) !== 3) continue; // Prev must be Wednesday

    const engulfing = curr.high > prev.high && curr.low < prev.low;
    const negative  = isNegative(curr);

    if (!engulfing || !negative) continue;

    // Check if Thursday is weekly high
    const wk = `${new Date(curr.date + 'T00:00:00').getFullYear()}-W${String(getISOWeek(curr.date)).padStart(2,'0')}`;
    const wcandles = weeks[wk] || [];
    const maxH = Math.max(...wcandles.map(c => c.high));
    if (curr.high < maxH) continue; // Not the weekly high

    results.total++;
    const br = bodyRatio(curr);
    const bucket = br < 0.3 ? 'low' : br < 0.6 ? 'mid' : 'high';
    byBodyRatio[bucket].n++;

    if (isPositive(next))         { results.friPos++;       byBodyRatio[bucket].friPos++; }
    if (next.high > curr.high)    results.friBreakHigh++;
    if (next.low  < curr.low)     results.friBreakLow++;
  }

  return {
    total: results.total,
    friPositive:  pct(results.friPos, results.total),
    friBreakHigh: pct(results.friBreakHigh, results.total),
    friBreakLow:  pct(results.friBreakLow, results.total),
    byBodyRatio: {
      low:  { n: byBodyRatio.low.n, friPos: pct(byBodyRatio.low.friPos, byBodyRatio.low.n) },
      mid:  { n: byBodyRatio.mid.n, friPos: pct(byBodyRatio.mid.friPos, byBodyRatio.mid.n) },
      high: { n: byBodyRatio.high.n, friPos: pct(byBodyRatio.high.friPos, byBodyRatio.high.n) },
    }
  };
}

// ─────────────────────────────────────────────────────────────
// 5.14 — FRACTAL / RECURRING PATTERN RECOGNITION
// ─────────────────────────────────────────────────────────────
function encodePattern(candles, start, length) {
  const parts = [];
  for (let i = start; i < start + length && i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : null;
    const dir = isPositive(c) ? 'U' : isNegative(c) ? 'D' : 'N';
    const relSize = prev ? (range(c) > range(prev) ? 'L' : 'S') : 'M';
    const hhll = prev ? (c.high > prev.high && c.low > prev.low ? 'HH' : c.high < prev.high && c.low < prev.low ? 'LL' : c.high > prev.high && c.low < prev.low ? 'OB' : c.high < prev.high && c.low > prev.low ? 'IB' : 'EQ') : 'ST';
    parts.push(`${dir}${relSize}${hhll}`);
  }
  return parts.join('|');
}

function calcFractals(candles) {
  const patterns3 = {};
  const patterns5 = {};
  const MIN_OCC = 15;

  for (let i = 0; i < candles.length - 4; i++) {
    const key3 = encodePattern(candles, i, 3);
    if (!patterns3[key3]) patterns3[key3] = { occurrences:0, nextPos:0, lastIdx:0 };
    if (i + 3 < candles.length) {
      patterns3[key3].occurrences++;
      if (isPositive(candles[i + 3])) patterns3[key3].nextPos++;
      patterns3[key3].lastIdx = i;
      patterns3[key3].lastDate = candles[i + 2].date;
    }

    if (i + 5 < candles.length) {
      const key5 = encodePattern(candles, i, 5);
      if (!patterns5[key5]) patterns5[key5] = { occurrences:0, nextPos:0, lastIdx:0 };
      patterns5[key5].occurrences++;
      if (isPositive(candles[i + 5])) patterns5[key5].nextPos++;
      patterns5[key5].lastIdx = i;
      patterns5[key5].lastDate = candles[i + 4].date;
    }
  }

  const format = (map) => Object.entries(map)
    .filter(([, v]) => v.occurrences >= MIN_OCC)
    .map(([key, v]) => ({
      pattern: key,
      n: v.occurrences,
      nextPos: pct(v.nextPos, v.occurrences),
      nextNeg: pct(v.occurrences - v.nextPos, v.occurrences),
      lastDate: v.lastDate,
      bias: pct(v.nextPos, v.occurrences) > 60 ? 'BULLISH' : pct(v.occurrences - v.nextPos, v.occurrences) > 60 ? 'BEARISH' : 'NEUTRAL'
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 20);

  return { threeCandle: format(patterns3), fiveCandle: format(patterns5) };
}

// ─────────────────────────────────────────────────────────────
// MASTER RUNNER — runs all analyses
// ─────────────────────────────────────────────────────────────
function runAllAnalyses(candles, options = {}) {
  const { filterDow = null, hourlyByDate = {} } = options;

  if (!candles || candles.length < 2) return null;

  return {
    direction:       calcDirectionProbabilities(candles, filterDow),
    directionAll:    calcDirectionProbabilities(candles, null),
    weeklyHighLow:   calcWeeklyHighLow(candles),
    hourlyHighLow:   calcDailyHighLowHours(hourlyByDate, candles),
    thuFriMon:       calcThuFriMonPattern(candles),
    lowerHighLow:    calcLowerHighLow(candles),
    consecutive:     calcConsecutive(candles),
    barPatterns:     calcBarPatterns(candles),
    breakCont:       calcBreakContinuation(candles),
    candleRatios:    calcCandleRatios(candles),
    abnormal:        calcAbnormalCandles(candles),
    gaps:            calcGapAnalysis(candles),
    seasonal:        calcSeasonalAnalysis(candles),
    thursdaySpecial: calcThursdaySpecial(candles),
    fractals:        calcFractals(candles),
    totalCandles:    candles.length,
    firstDate:       candles[0].date,
    lastDate:        candles[candles.length - 1].date,
    lastCandle:      candles[candles.length - 1],
  };
}

window.Analysis = { runAllAnalyses, getWeekday, DAYS, DAYS_SHORT, pct };
