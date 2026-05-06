// ============================================================
// ALKHAL227 — CSV Parser (MT5 spec compliant)
// © ALKHAL_YOUSEF_FUAD_KAMEL — All Rights Reserved
// ============================================================

function parseDateMT5(dateStr) {
  // "2026.04.27" or "2026-04-27" or "27/04/2026"
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  let m = s.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function cleanHeader(h) {
  return String(h).replace(/[<>\s]/g, '').toUpperCase();
}

function detectSeparator(text) {
  // Sniff first non-empty line
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  const tabs   = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g)  || []).length;
  const semis  = (firstLine.match(/;/g)  || []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function parseFile(csvText) {
  const sep = detectSeparator(csvText);
  const result = Papa.parse(csvText, {
    delimiter: sep,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (!result.data || result.data.length < 2) throw new Error('File too short');

  const rawHeaders = result.data[0].map(h => String(h).trim());
  const headers    = rawHeaders.map(cleanHeader);
  const idx = {};
  ['DATE','TIME','OPEN','HIGH','LOW','CLOSE','TICKVOL','VOL','SPREAD','VOLUME'].forEach(k => {
    const i = headers.indexOf(k);
    if (i > -1) idx[k] = i;
  });

  // Fallback aliases
  if (idx.DATE === undefined) {
    const i = headers.findIndex(h => h.includes('DATE') || h === 'TIME' || h === 'TIMESTAMP');
    if (i > -1) idx.DATE = i;
  }

  if (idx.OPEN === undefined || idx.HIGH === undefined || idx.LOW === undefined || idx.CLOSE === undefined) {
    throw new Error('Missing OHLC columns. Found: ' + headers.join(', '));
  }
  if (idx.DATE === undefined) throw new Error('Missing DATE column');

  const rows = [];
  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i];
    if (!row || row.length < 4) continue;

    let dateRaw = String(row[idx.DATE] || '').trim();
    let time = idx.TIME !== undefined ? String(row[idx.TIME] || '').trim() : '';

    // Handle combined "2026.04.27 14:00" date
    if (!time && dateRaw.includes(' ')) {
      const parts = dateRaw.split(/\s+/);
      dateRaw = parts[0];
      time = parts[1] || '';
    }

    const date = parseDateMT5(dateRaw);
    if (!date) continue;

    const open  = parseFloat(row[idx.OPEN]);
    const high  = parseFloat(row[idx.HIGH]);
    const low   = parseFloat(row[idx.LOW]);
    const close = parseFloat(row[idx.CLOSE]);
    if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) continue;
    if (high < low) continue;

    const tickvol = idx.TICKVOL !== undefined ? parseInt(row[idx.TICKVOL]) || 0 : 0;
    const volume  = idx.VOLUME  !== undefined ? parseInt(row[idx.VOLUME])  || 0 : 0;

    rows.push({ date, time, open, high, low, close, tickvol, volume });
  }

  return { rows, headers, columnCount: headers.length, hasTime: idx.TIME !== undefined };
}

function detectTimeframe(parsed) {
  const { hasTime, columnCount, rows } = parsed;
  // D1 = 8 columns, no TIME
  // H1 = 9 columns, has TIME
  if (!hasTime && columnCount === 8) return 'D1';
  if (hasTime  && columnCount === 9) return 'H1';

  // Fallback: check if same date repeats
  const dates = rows.map(r => r.date);
  const uniqueDates = new Set(dates);
  if (uniqueDates.size < rows.length * 0.8) return 'H1';
  return 'D1';
}

// Parse daily file → returns daily candles
function parseDailyCSV(csvText) {
  const parsed = parseFile(csvText);
  const tf = detectTimeframe(parsed);
  if (tf === 'H1') {
    throw new Error('This appears to be an Hourly (H1) file, not a Daily (D1) file. Please upload via the Hourly upload slot.');
  }

  const candles = parsed.rows.map(r => ({
    date: r.date,
    open: r.open, high: r.high, low: r.low, close: r.close,
    volume: r.tickvol || r.volume || 0
  }));

  // Sort + dedupe (keep last)
  candles.sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set();
  const deduped = [];
  for (let i = candles.length - 1; i >= 0; i--) {
    if (!seen.has(candles[i].date)) {
      seen.add(candles[i].date);
      deduped.unshift(candles[i]);
    }
  }
  if (deduped.length === 0) throw new Error('No valid candles parsed');
  return deduped;
}

// Parse hourly file → returns hourly candles
function parseHourlyCSV(csvText) {
  const parsed = parseFile(csvText);
  const tf = detectTimeframe(parsed);
  if (tf === 'D1') {
    const err = new Error('This appears to be a Daily (D1) file, not an Hourly (H1) file.');
    err.isDailyInHourlySlot = true;
    err.parsedRows = parsed.rows;
    throw err;
  }

  const candles = parsed.rows.map(r => ({
    datetime: `${r.date} ${(r.time || '00:00').substring(0, 5)}`,
    date: r.date,
    time: r.time || '00:00:00',
    open: r.open, high: r.high, low: r.low, close: r.close,
    volume: r.tickvol || r.volume || 0
  }));
  candles.sort((a, b) => a.datetime.localeCompare(b.datetime));
  return candles;
}

// Aggregate hourly candles into daily candles, grouped by date
// Returns array of { date, open, high, low, close, sessionStart, sessionEnd, candleCount, complete, message }
function extractDailiesFromHourly(hourlyCandles) {
  const byDate = {};
  hourlyCandles.forEach(c => {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  });

  const dailies = [];
  Object.keys(byDate).sort().forEach(date => {
    const candles = byDate[date].slice().sort((a, b) => a.time.localeCompare(b.time));
    const first = candles[0];
    const last  = candles[candles.length - 1];

    const startHour = parseInt(first.time.split(':')[0]);
    const expected  = 24 - startHour;
    const complete  = candles.length >= expected;
    const message = complete
      ? null
      : `⚠ Only ${candles.length} of ~${expected} expected candles for ${date} (session ${first.time.substring(0,5)}–${last.time.substring(0,5)}). File may be partial.`;

    dailies.push({
      date,
      open:  first.open,
      high:  Math.max(...candles.map(c => c.high)),
      low:   Math.min(...candles.map(c => c.low)),
      close: last.close,
      volume: candles.reduce((s, c) => s + (c.volume || 0), 0),
      sessionStart: first.time,
      sessionEnd:   last.time,
      candleCount:  candles.length,
      complete, message
    });
  });

  return dailies;
}

// Convenience: aggregate to single most-recent daily
function aggregateHourlyToDaily(hourlyCandles) {
  const dailies = extractDailiesFromHourly(hourlyCandles);
  return dailies.length > 0 ? dailies[dailies.length - 1] : null;
}

window.Parser = { parseDailyCSV, parseHourlyCSV, extractDailiesFromHourly, aggregateHourlyToDaily, detectTimeframe, parseFile };
