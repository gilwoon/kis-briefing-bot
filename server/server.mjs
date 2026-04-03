import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { findSymbolEntry } from "../data/symbol-directory.js";
import { mockMarketData } from "../data/mock-market-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

loadEnv(path.join(projectRoot, ".env"));
loadEnv(path.join(projectRoot, ".env.local"));

const PORT = 4173;
const KIS_ENV = (process.env.KIS_ENV || "prod").trim().toLowerCase();
const KIS_BASE_URL = process.env.KIS_BASE_URL?.trim() ||
  (KIS_ENV === "vps"
    ? "https://openapivts.koreainvestment.com:29443"
    : "https://openapi.koreainvestment.com:9443");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const tokenCache = {
  token: null,
  expiresAt: 0
};

const KIS_MIN_INTERVAL_MS = 380;
let lastKisRequestAt = 0;
const quoteCache = new Map();
const historyCache = new Map();
const QUOTE_TTL_MS = 20_000;
const HISTORY_TTL_MS = 10 * 60_000;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/briefing") {
    try {
      const payload = await readJsonBody(request);
      const symbols = Array.isArray(payload.symbols) ? payload.symbols : [];
      const result = await buildBriefingResponse(symbols);
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 500, {
        source: "server-error",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      status: "ok",
      service: "kis-briefing-bot",
      kisEnv: KIS_ENV,
      hasCredentials: hasKisCredentials(),
      time: new Date().toISOString()
    });
  }

  return serveStaticFile(url.pathname, response);
});

server.listen(PORT, () => {
  console.log(`KIS Briefing Bot server listening on http://localhost:${PORT}`);
});

async function buildBriefingResponse(requestedSymbols) {
  const selectedSymbols = normalizeSymbols(requestedSymbols);

  if (selectedSymbols.length === 0) {
    return {
      source: "empty",
      marketMood: "입력한 종목을 찾지 못했습니다",
      updatedAt: new Date().toISOString(),
      items: []
    };
  }

  if (!hasKisCredentials()) {
    return {
      source: "mock-fallback",
      message: "`.env.local`에 KIS 키가 없어 샘플 데이터로 브리핑했습니다.",
      updatedAt: new Date().toISOString(),
      items: selectedSymbols
        .map((entry) => mockMarketData.find((item) => item.symbol === entry.symbol))
        .filter(Boolean)
    };
  }

  try {
    const items = [];

    for (const entry of selectedSymbols) {
      const quote = await fetchCurrentPrice(entry.symbol);
      const history = await fetchDailyHistory(entry.symbol);
      items.push(buildLiveMetrics(entry, quote, history));
    }

    return {
      source: "kis-live",
      marketMood: "KIS 실시간 시세 기준으로 브리핑을 생성했습니다",
      updatedAt: new Date().toISOString(),
      items
    };
  } catch (error) {
    return {
      source: "mock-fallback",
      message: `KIS 호출 실패로 샘플 데이터로 전환했습니다: ${error instanceof Error ? error.message : "unknown error"}`,
      updatedAt: new Date().toISOString(),
      items: selectedSymbols
        .map((entry) => mockMarketData.find((item) => item.symbol === entry.symbol))
        .filter(Boolean)
    };
  }
}

function normalizeSymbols(requestedSymbols) {
  const seen = new Set();
  const entries = [];

  for (const rawKeyword of requestedSymbols) {
    const entry = findSymbolEntry(rawKeyword);

    if (!entry || seen.has(entry.symbol)) {
      continue;
    }

    seen.add(entry.symbol);
    entries.push(entry);
  }

  return entries;
}

function hasKisCredentials() {
  return Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
}

async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  await waitForKisSlot();
  const response = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET
    })
  });

  const payload = await response.json();

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.msg1 || "토큰 발급에 실패했습니다.");
  }

  tokenCache.token = payload.access_token;
  tokenCache.expiresAt = Date.now() + Number(payload.expires_in || 86400) * 1000;

  return tokenCache.token;
}

async function fetchCurrentPrice(symbol) {
  const cacheKey = `quote:${symbol}`;
  const cached = readCache(quoteCache, cacheKey);

  if (cached) {
    return cached;
  }

  const payload = await kisGet("/uapi/domestic-stock/v1/quotations/inquire-price", "FHKST01010100", {
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: symbol
  });

  writeCache(quoteCache, cacheKey, payload, QUOTE_TTL_MS);
  return payload;
}

async function fetchDailyHistory(symbol) {
  const cacheKey = `history:${symbol}`;
  const cached = readCache(historyCache, cacheKey);

  if (cached) {
    return cached;
  }

  const endDate = formatDate(new Date());
  const start = new Date();
  start.setDate(start.getDate() - 140);

  const payload = await kisGet("/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice", "FHKST03010100", {
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: symbol,
    FID_INPUT_DATE_1: formatDate(start),
    FID_INPUT_DATE_2: endDate,
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "1"
  });

  writeCache(historyCache, cacheKey, payload, HISTORY_TTL_MS);
  return payload;
}

async function kisGet(pathname, trId, params) {
  const token = await getAccessToken();
  const searchParams = new URLSearchParams(params);
  await waitForKisSlot();
  const response = await fetch(`${KIS_BASE_URL}${pathname}?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
      tr_id: trId,
      custtype: "P"
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.msg1 || `KIS API error (${response.status})`);
  }

  return payload;
}

function buildLiveMetrics(entry, quotePayload, historyPayload) {
  const quote = quotePayload.output || {};
  const rawHistory = Array.isArray(historyPayload.output2)
    ? historyPayload.output2
    : Array.isArray(historyPayload.output)
      ? historyPayload.output
      : [];

  const closes = rawHistory
    .map((row) => Number(row.stck_clpr || row.stck_prpr || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reverse();

  const volumes = rawHistory
    .map((row) => Number(row.acml_vol || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reverse();

  const price = Number(quote.stck_prpr || 0);
  const changePercent = Number(quote.prdy_ctrt || 0);
  const todayVolume = Number(quote.acml_vol || 0);

  const ma20 = average(last(closes, 20));
  const ma60 = average(last(closes, 60));
  const priorVolumes = volumes.length > 1 ? volumes.slice(0, -1) : volumes;
  const averageVolume20 = average(last(priorVolumes, 20));
  const volumeRatio = averageVolume20 > 0 ? todayVolume / averageVolume20 : 1;
  const rsi = calculateRsi(last(closes, 30), 14);
  const trendScore = calculateTrendScore({ price, changePercent, volumeRatio, rsi, ma20, ma60 });

  return {
    symbol: entry.symbol,
    aliases: entry.aliases,
    name: entry.name,
    price,
    changePercent,
    volumeRatio: round(volumeRatio),
    rsi: Math.round(rsi),
    aboveMa20: ma20 > 0 ? price >= ma20 : changePercent >= 0,
    aboveMa60: ma60 > 0 ? price >= ma60 : changePercent >= 0,
    trendScore
  };
}

function calculateTrendScore({ price, changePercent, volumeRatio, rsi, ma20, ma60 }) {
  let score = 50;

  if (changePercent > 2) score += 12;
  else if (changePercent > 0) score += 6;
  else if (changePercent < -2) score -= 12;
  else if (changePercent < 0) score -= 6;

  if (ma20 > 0 && price >= ma20) score += 10;
  else score -= 8;

  if (ma60 > 0 && price >= ma60) score += 8;
  else score -= 6;

  if (volumeRatio >= 1.5) score += 10;
  else if (volumeRatio < 0.9) score -= 6;

  if (rsi >= 70) score -= 4;
  else if (rsi <= 35) score += 2;
  else score += 4;

  return Math.max(1, Math.min(99, Math.round(score)));
}

function calculateRsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period) {
    return 50;
  }

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const delta = closes[index] - closes[index - 1];

    if (delta > 0) {
      averageGain += delta;
    } else {
      averageLoss += Math.abs(delta);
    }
  }

  averageGain /= period;
  averageLoss /= period;

  for (let index = period + 1; index < closes.length; index += 1) {
    const delta = closes[index] - closes[index - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;

    averageGain = ((averageGain * (period - 1)) + gain) / period;
    averageLoss = ((averageLoss * (period - 1)) + loss) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function last(values, count) {
  return values.slice(Math.max(values.length - count, 0));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
  }

  return body ? JSON.parse(body) : {};
}

function serveStaticFile(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(projectRoot, normalizedPath);

  if (!filePath.startsWith(projectRoot) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  response.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");

    if (equalIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function readCache(cache, key) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCache(cache, key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

async function waitForKisSlot() {
  const waitMs = Math.max(0, lastKisRequestAt + KIS_MIN_INTERVAL_MS - Date.now());

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastKisRequestAt = Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
