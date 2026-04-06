import { mockMarketData } from "./data/mock-market-data.js";
import { searchSymbolEntries } from "./data/symbol-directory.js";

const symbolsInput = document.querySelector("#symbols");
const symbolSearchInput = document.querySelector("#symbol-search");
const addSymbolButton = document.querySelector("#add-symbol-button");
const symbolSuggestions = document.querySelector("#symbol-suggestions");
const generateButton = document.querySelector("#generate-button");
const refreshButton = document.querySelector("#refresh-button");
const autoRefreshToggle = document.querySelector("#auto-refresh-toggle");
const watchlistNameInput = document.querySelector("#watchlist-name");
const saveWatchlistButton = document.querySelector("#save-watchlist-button");
const savedWatchlists = document.querySelector("#saved-watchlists");
const watchlistStatus = document.querySelector("#watchlist-status");
const symbolFeedback = document.querySelector("#symbol-feedback");
const cardsContainer = document.querySelector("#briefing-cards");
const cardTemplate = document.querySelector("#briefing-card-template");

const marketDate = document.querySelector("#market-date");
const marketMood = document.querySelector("#market-mood");
const resultCount = document.querySelector("#result-count");
const dataSourceBadge = document.querySelector("#data-source-badge");
const lastUpdated = document.querySelector("#last-updated");
const dataSourceDetail = document.querySelector("#data-source-detail");
const dataUpdatedDetail = document.querySelector("#data-updated-detail");

const summaryToneTitle = document.querySelector("#summary-tone-title");
const summaryToneBody = document.querySelector("#summary-tone-body");
const summaryTopName = document.querySelector("#summary-top-name");
const summaryTopBody = document.querySelector("#summary-top-body");
const summaryRiskName = document.querySelector("#summary-risk-name");
const summaryRiskBody = document.querySelector("#summary-risk-body");

const AUTO_REFRESH_MS = 60_000;
const WATCHLIST_STORAGE_KEY = "kis-briefing-bot.watchlists";
const LAST_WATCHLIST_NAME_KEY = "kis-briefing-bot.last-watchlist-name";
let autoRefreshTimer = null;
let isRendering = false;
let savedWatchlistItems = loadSavedWatchlists();
let activeSuggestionSymbol = "";

marketDate.textContent = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "long"
}).format(new Date());

renderSavedWatchlists();
restoreLastWatchlistName();

generateButton.addEventListener("click", () => {
  void renderDashboard(parseSymbolInput(symbolsInput.value));
});

refreshButton.addEventListener("click", () => {
  void renderDashboard(parseSymbolInput(symbolsInput.value));
});

saveWatchlistButton.addEventListener("click", () => {
  saveCurrentWatchlist();
});

symbolSearchInput.addEventListener("input", () => {
  renderSymbolSuggestions(symbolSearchInput.value);
});

symbolSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addSelectedSymbolToInput();
  }
});

addSymbolButton.addEventListener("click", () => {
  addSelectedSymbolToInput();
});

autoRefreshToggle.addEventListener("change", () => {
  syncAutoRefresh();
});

void renderDashboard(parseSymbolInput(symbolsInput.value));

function parseSymbolInput(rawInput) {
  return rawInput
    .split(/[\n,;]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderSymbolSuggestions(rawKeyword) {
  const keyword = rawKeyword.trim().toLowerCase();
  symbolSuggestions.innerHTML = "";
  activeSuggestionSymbol = "";

  if (!keyword) {
    return;
  }

  const matches = searchSymbolEntries(keyword, 6);

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "symbol-suggestion-empty";
    empty.textContent = "일치하는 등록 종목이 없습니다. 6자리 종목코드로 직접 입력해 보세요.";
    symbolSuggestions.appendChild(empty);
    return;
  }

  activeSuggestionSymbol = matches[0].symbol;

  matches.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "symbol-suggestion";
    if (index === 0) {
      button.classList.add("symbol-suggestion-active");
    }
    button.innerHTML = `<strong>${entry.name}</strong><span>${entry.symbol}</span>`;
    button.addEventListener("click", () => {
      appendSymbolToInput(entry.symbol);
      symbolSearchInput.value = "";
      renderSymbolSuggestions("");
    });
    symbolSuggestions.appendChild(button);
  });
}

function addSelectedSymbolToInput() {
  const keyword = symbolSearchInput.value.trim();
  if (!keyword) {
    return;
  }

  const directCode = /^\d{6}$/.test(keyword) ? keyword : "";
  const symbolToAdd = activeSuggestionSymbol || directCode;

  if (!symbolToAdd) {
    updateWatchlistStatus("자동완성에 없는 종목명은 6자리 종목코드로 입력해 주세요.");
    return;
  }

  appendSymbolToInput(symbolToAdd);
  symbolSearchInput.value = "";
  renderSymbolSuggestions("");
}

function appendSymbolToInput(symbol) {
  const currentSymbols = parseSymbolInput(symbolsInput.value);

  if (currentSymbols.includes(symbol)) {
    updateWatchlistStatus(`${symbol}은 이미 입력되어 있습니다.`);
    return;
  }

  currentSymbols.push(symbol);
  symbolsInput.value = currentSymbols.join(", ");
  updateWatchlistStatus(`${symbol}을 관심종목 입력란에 추가했습니다.`);
}

function saveCurrentWatchlist() {
  const symbols = parseSymbolInput(symbolsInput.value);
  const name = watchlistNameInput.value.trim();

  if (!name) {
    updateWatchlistStatus("저장 이름을 먼저 입력해 주세요.");
    watchlistNameInput.focus();
    return;
  }

  if (symbols.length === 0) {
    updateWatchlistStatus("저장할 종목이 없습니다. 종목을 먼저 입력해 주세요.");
    symbolsInput.focus();
    return;
  }

  const now = new Date().toISOString();
  const existingIndex = savedWatchlistItems.findIndex((item) => item.name === name);
  const payload = {
    name,
    symbols,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    savedWatchlistItems[existingIndex] = payload;
  } else {
    savedWatchlistItems.unshift(payload);
  }

  savedWatchlistItems = savedWatchlistItems
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
    .slice(0, 8);

  persistWatchlists();
  localStorage.setItem(LAST_WATCHLIST_NAME_KEY, name);
  renderSavedWatchlists();
  updateWatchlistStatus(`"${name}"에 ${symbols.length}개 종목을 저장했습니다.`);
}

function loadSavedWatchlists() {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) =>
      item &&
      typeof item.name === "string" &&
      Array.isArray(item.symbols) &&
      typeof item.updatedAt === "string"
    );
  } catch (error) {
    return [];
  }
}

function persistWatchlists() {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(savedWatchlistItems));
}

function renderSavedWatchlists() {
  savedWatchlists.innerHTML = "";

  if (savedWatchlistItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "saved-watchlists-empty";
    empty.textContent = "아직 저장된 관심종목 묶음이 없습니다.";
    savedWatchlists.appendChild(empty);
    return;
  }

  savedWatchlistItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "saved-watchlist-card";

    const meta = document.createElement("div");
    meta.className = "saved-watchlist-meta";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const count = document.createElement("span");
    count.textContent = `${item.symbols.length}개 종목`;

    const description = document.createElement("p");
    description.textContent = item.symbols.join(", ");

    meta.append(title, count, description);

    const actions = document.createElement("div");
    actions.className = "saved-watchlist-actions";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "secondary-button";
    loadButton.textContent = "불러오기";
    loadButton.addEventListener("click", () => {
      symbolsInput.value = item.symbols.join(", ");
      watchlistNameInput.value = item.name;
      localStorage.setItem(LAST_WATCHLIST_NAME_KEY, item.name);
      updateWatchlistStatus(`"${item.name}"을 불러왔습니다.`);
      void renderDashboard(item.symbols);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary-button danger-button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => {
      deleteWatchlist(item.name);
    });

    actions.append(loadButton, deleteButton);
    card.append(meta, actions);
    savedWatchlists.appendChild(card);
  });
}

function deleteWatchlist(name) {
  savedWatchlistItems = savedWatchlistItems.filter((item) => item.name !== name);
  persistWatchlists();

  if (localStorage.getItem(LAST_WATCHLIST_NAME_KEY) === name) {
    localStorage.removeItem(LAST_WATCHLIST_NAME_KEY);
  }

  renderSavedWatchlists();
  updateWatchlistStatus(`"${name}" 저장 목록을 삭제했습니다.`);
}

function restoreLastWatchlistName() {
  const lastName = localStorage.getItem(LAST_WATCHLIST_NAME_KEY);
  if (lastName) {
    watchlistNameInput.value = lastName;
  }
}

function updateWatchlistStatus(message) {
  watchlistStatus.textContent = message;
}

async function renderDashboard(requestedSymbols) {
  if (isRendering) {
    return;
  }

  isRendering = true;
  setLoadingState(true);

  try {
    const response = await fetchBriefings(requestedSymbols);
    const briefings = response.items.map(buildBriefing);
    applySymbolFeedback(response, requestedSymbols);

    cardsContainer.innerHTML = "";
    resultCount.textContent = `${briefings.length}개 종목`;

    if (briefings.length === 0) {
      showEmptyState("입력한 종목을 찾지 못했습니다", "등록된 종목명 별칭 또는 6자리 종목코드를 입력해 주세요.");
      return;
    }

    const summary = buildPortfolioSummary(briefings);
    marketMood.textContent = response.marketMood || summary.marketMood;
    applyDataStatus(response);
    summaryToneTitle.textContent = summary.toneTitle;
    summaryToneBody.textContent =
      response.source === "kis-live"
        ? `${summary.toneBody} 실시간 KIS 시세 기준으로 계산했습니다.`
        : `${summary.toneBody} ${response.message || "현재는 복구 모드 데이터로 브리핑 중입니다."}`;
    summaryTopName.textContent = summary.topPick.name;
    summaryTopBody.textContent = summary.topPick.briefing;
    summaryRiskName.textContent = summary.riskPick.name;
    summaryRiskBody.textContent = summary.riskPick.briefing;

    briefings.forEach((briefing) => {
      cardsContainer.appendChild(renderCard(briefing));
    });
  } catch (error) {
    cardsContainer.innerHTML = "";
    resultCount.textContent = "0개 종목";
    applySymbolFeedback({ unknownSymbols: [] }, requestedSymbols);
    applyDataStatus({
      source: "error",
      updatedAt: new Date().toISOString()
    });
    showEmptyState("브리핑 생성에 실패했습니다", error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
  } finally {
    setLoadingState(false);
    isRendering = false;
  }
}

async function fetchBriefings(symbols) {
  try {
    const response = await fetch("/api/briefing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ symbols })
    });

    if (!response.ok) {
      throw new Error(`브리핑 API 호출 실패 (${response.status})`);
    }

    return response.json();
  } catch (error) {
    const fallbackItems = mapRequestedSymbols(symbols);
    return {
      source: "mock-fallback",
      message: "KIS 서버 응답을 받지 못해 복구 모드 데이터로 전환했습니다.",
      updatedAt: new Date().toISOString(),
      items: fallbackItems
    };
  }
}

function mapRequestedSymbols(requestedSymbols) {
  const seen = new Set();

  return requestedSymbols.reduce((accumulator, keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    const stock = mockMarketData.find((item) =>
      item.aliases.some((alias) => alias.toLowerCase() === normalizedKeyword)
    );

    if (!stock || seen.has(stock.symbol)) {
      return accumulator;
    }

    seen.add(stock.symbol);
    accumulator.push(stock);
    return accumulator;
  }, []);
}

function buildBriefing(stock) {
  const signal = classifySignal(stock);
  const tags = [];

  if (stock.changePercent >= 3) {
    tags.push("상승 탄력");
  } else if (stock.changePercent <= -2) {
    tags.push("낙폭 주의");
  }

  if (stock.volumeRatio >= 1.5) {
    tags.push("거래량 급증");
  } else if (stock.volumeRatio < 0.9) {
    tags.push("거래 위축");
  }

  if (stock.rsi >= 70) {
    tags.push("과열 구간");
  } else if (stock.rsi <= 35) {
    tags.push("과매도 근접");
  }

  if (stock.aboveMa20 && stock.aboveMa60) {
    tags.push("추세 우위");
  } else if (!stock.aboveMa20 && !stock.aboveMa60) {
    tags.push("추세 약세");
  }

  return {
    ...stock,
    signal,
    tags,
    briefing: buildNarrative(stock, signal)
  };
}

function classifySignal(stock) {
  if (stock.changePercent >= 3 && stock.volumeRatio >= 1.5 && stock.aboveMa20) {
    return { label: "Momentum", tone: "strong" };
  }

  if ((stock.rsi >= 70 && stock.changePercent > 0) || (!stock.aboveMa20 && stock.changePercent <= -2)) {
    return { label: "Risk Watch", tone: "risk" };
  }

  if (stock.aboveMa20 || stock.trendScore >= 60) {
    return { label: "Constructive", tone: "warm" };
  }

  return { label: "Neutral", tone: "neutral" };
}

function buildNarrative(stock, signal) {
  const changePhrase =
    stock.changePercent >= 3
      ? "강한 상승 탄력이 붙었고"
      : stock.changePercent <= -2
        ? "단기 낙폭이 커졌고"
        : stock.changePercent > 0
          ? "완만한 상승 흐름을 보이며"
          : stock.changePercent < 0
            ? "조정 흐름이 이어지며"
            : "보합권에서 움직이며";

  const volumePhrase =
    stock.volumeRatio >= 1.5
      ? "거래량까지 뒷받침되고 있습니다."
      : stock.volumeRatio < 0.9
        ? "거래가 가벼워 추세 신뢰도는 조금 낮습니다."
        : "거래량도 평균 수준 이상입니다.";

  const trendPhrase =
    stock.aboveMa20 && stock.aboveMa60
      ? "20일선과 60일선 위에 있어 추세 구조는 안정적입니다."
      : stock.aboveMa20
        ? "20일선 위를 유지해 단기 추세는 아직 살아 있습니다."
        : stock.aboveMa60
          ? "60일선 위이긴 하지만 단기선 이탈이라 탄력은 둔합니다."
          : "주요 이동평균선 아래라 방어보다 확인이 먼저입니다.";

  const rsiPhrase =
    stock.rsi >= 70
      ? "다만 RSI가 높아 추격 진입은 부담이 있습니다."
      : stock.rsi <= 35
        ? "반대로 RSI가 낮아 기술적 반등 후보로 볼 여지는 있습니다."
        : "RSI는 과열도 과매도도 아닌 중립 구간입니다.";

  const conclusionMap = {
    strong: "오늘 브리핑 기준으로는 공격적으로 시선이 가는 종목입니다.",
    warm: "관심 유지에 적합한 종목으로 보입니다.",
    risk: "수익 구간 점검이나 보수적 접근이 더 어울립니다.",
    neutral: "강한 확신보다는 관찰 중심이 적절한 종목입니다."
  };

  return `${changePhrase} ${trendPhrase} ${volumePhrase} ${rsiPhrase} ${conclusionMap[signal.tone]}`;
}

function buildPortfolioSummary(briefings) {
  const topPick = [...briefings].sort((left, right) => right.trendScore - left.trendScore)[0];
  const riskPick = [...briefings].sort((left, right) => left.trendScore - right.trendScore)[0];

  const positiveCount = briefings.filter((item) => item.changePercent > 0).length;
  const volumeLeaders = briefings.filter((item) => item.volumeRatio >= 1.5).length;
  const riskSignals = briefings.filter((item) => item.signal.tone === "risk").length;

  const marketMood =
    positiveCount >= Math.ceil(briefings.length / 2)
      ? "상승 종목이 우세하고 선별적 추세 추종이 가능한 장"
      : "조정 종목이 많아 방어와 선별 접근이 중요한 장";

  const toneTitle =
    positiveCount >= Math.ceil(briefings.length / 2)
      ? "강한 쪽이 분명한 선별 장세"
      : "모멘텀보다 리스크 관리가 먼저인 장세";

  const toneBody = [
    `${briefings.length}개 관심종목 중 ${positiveCount}개가 상승 흐름을 보이고 있습니다.`,
    volumeLeaders > 0
      ? `특히 ${volumeLeaders}개 종목은 거래량이 평균보다 크게 늘어 수급 확인이 가능합니다.`
      : "거래량이 폭발적으로 붙은 종목은 많지 않아 추격보다는 확인이 유리합니다.",
    riskSignals > 0
      ? `${riskSignals}개 종목에서는 과열 또는 추세 이탈 신호가 함께 보여 비중 조절이 필요합니다.`
      : "뚜렷한 붕괴 신호보다 정상 범위 안의 흔들림이 많은 편입니다."
  ].join(" ");

  return {
    marketMood,
    toneTitle,
    toneBody,
    topPick,
    riskPick
  };
}

function renderCard(briefing) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);

  node.querySelector(".ticker").textContent = briefing.symbol;
  node.querySelector(".name").textContent = briefing.name;

  const pill = node.querySelector(".signal-pill");
  pill.textContent = briefing.signal.label;
  pill.classList.add(`signal-${briefing.signal.tone}`);

  node.querySelector(".price").textContent = formatPrice(briefing.price);

  const changeNode = node.querySelector(".change");
  changeNode.textContent = `${briefing.changePercent > 0 ? "+" : ""}${briefing.changePercent.toFixed(2)}%`;
  changeNode.classList.add(
    briefing.changePercent > 0 ? "up" : briefing.changePercent < 0 ? "down" : "flat"
  );

  const metrics = [
    ["거래량 배수", `${briefing.volumeRatio.toFixed(2)}x`],
    ["RSI", `${briefing.rsi}`],
    ["20일선", briefing.aboveMa20 ? "상회" : "하회"],
    ["추세 점수", `${briefing.trendScore}/100`]
  ];

  const metricGrid = node.querySelector(".metric-grid");
  metrics.forEach(([label, value]) => {
    const metricNode = document.createElement("div");
    metricNode.className = "metric";
    metricNode.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    metricGrid.appendChild(metricNode);
  });

  node.querySelector(".briefing-copy").textContent = briefing.briefing;

  const tagList = node.querySelector(".tags");
  briefing.tags.forEach((tag) => {
    const tagNode = document.createElement("li");
    tagNode.textContent = tag;
    tagList.appendChild(tagNode);
  });

  return node;
}

function showEmptyState(title, description) {
  marketMood.textContent = title;
  summaryToneTitle.textContent = title;
  summaryToneBody.textContent = description;
  summaryTopName.textContent = "없음";
  summaryTopBody.textContent = "유효한 종목을 찾으면 톱픽을 계산합니다.";
  summaryRiskName.textContent = "없음";
  summaryRiskBody.textContent = "유효한 종목을 찾으면 위험 신호를 계산합니다.";
}

function setLoadingState(isLoading) {
  generateButton.disabled = isLoading;
  refreshButton.disabled = isLoading;
  generateButton.textContent = isLoading ? "브리핑 생성 중..." : "오늘 브리핑 생성";
  refreshButton.textContent = isLoading ? "새로고침 중..." : "지금 새로고침";
}

function applySymbolFeedback(response, requestedSymbols) {
  const unknownSymbols = Array.isArray(response.unknownSymbols) ? response.unknownSymbols : [];

  if (requestedSymbols.length === 0) {
    symbolFeedback.hidden = true;
    symbolFeedback.textContent = "";
    return;
  }

  if (unknownSymbols.length === 0) {
    symbolFeedback.hidden = false;
    symbolFeedback.classList.remove("symbol-feedback-warning");
    symbolFeedback.textContent = `${requestedSymbols.length}개 입력값을 인식했습니다. 종목명은 등록된 별칭만 지원하고, 그 외에는 6자리 종목코드 입력이 가장 확실합니다.`;
    return;
  }

  symbolFeedback.hidden = false;
  symbolFeedback.classList.add("symbol-feedback-warning");
  symbolFeedback.textContent = `인식하지 못한 종목: ${unknownSymbols.join(", ")}. 종목명 대신 6자리 종목코드를 입력해 보세요.`;
}

function applyDataStatus(response) {
  const updatedAt = response.updatedAt ? new Date(response.updatedAt) : new Date();
  const formattedTime = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(updatedAt);

  const config = {
    "kis-live": {
      badge: "실데이터 사용 중",
      detail: "KIS 실시간 시세"
    },
    "mock-fallback": {
      badge: "복구 모드",
      detail: "KIS 실패 후 샘플 전환"
    },
    empty: {
      badge: "입력값 확인 필요",
      detail: "유효 종목 없음"
    },
    error: {
      badge: "오류 발생",
      detail: "브리핑 생성 실패"
    }
  }[response.source] || {
    badge: "데이터 확인 중",
    detail: "확인 중"
  };

  dataSourceBadge.textContent = config.badge;
  dataSourceDetail.textContent = config.detail;
  lastUpdated.textContent = `마지막 갱신 ${formattedTime}`;
  dataUpdatedDetail.textContent = formattedTime;
}

function syncAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (!autoRefreshToggle.checked) {
    return;
  }

  autoRefreshTimer = setInterval(() => {
    if (document.visibilityState !== "visible" || isRendering) {
      return;
    }

    void renderDashboard(parseSymbolInput(symbolsInput.value));
  }, AUTO_REFRESH_MS);
}

function formatPrice(price) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(price);
}
