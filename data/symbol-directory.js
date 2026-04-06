export const symbolDirectory = [
  { symbol: "005930", aliases: ["삼성전자", "삼전", "samsung", "samsung electronics", "005930"], name: "삼성전자" },
  { symbol: "000660", aliases: ["SK하이닉스", "하이닉스", "sk hynix", "000660"], name: "SK하이닉스" },
  { symbol: "035420", aliases: ["NAVER", "네이버", "naver corp", "035420"], name: "NAVER" },
  { symbol: "005380", aliases: ["현대차", "현대자동차", "hyundai", "hyundai motor", "005380"], name: "현대차" },
  { symbol: "373220", aliases: ["LG에너지솔루션", "엘지에너지솔루션", "lges", "373220"], name: "LG에너지솔루션" },
  { symbol: "068270", aliases: ["셀트리온", "celltrion", "068270"], name: "셀트리온" },
  { symbol: "035720", aliases: ["카카오", "kakao", "035720"], name: "카카오" },
  { symbol: "105560", aliases: ["KB금융", "kb금융", "kb", "105560"], name: "KB금융" },
  { symbol: "012330", aliases: ["현대모비스", "hyundai mobis", "012330"], name: "현대모비스" },
  { symbol: "207940", aliases: ["삼성바이오로직스", "삼바", "samsung biologics", "207940"], name: "삼성바이오로직스" },
  { symbol: "006400", aliases: ["삼성SDI", "삼성에스디아이", "samsung sdi", "006400"], name: "삼성SDI" },
  { symbol: "051910", aliases: ["LG화학", "엘지화학", "lg chem", "051910"], name: "LG화학" },
  { symbol: "034020", aliases: ["두산에너빌리티", "doosan", "034020"], name: "두산에너빌리티" },
  { symbol: "011200", aliases: ["HMM", "hmm", "011200"], name: "HMM" },
  { symbol: "329180", aliases: ["HD현대중공업", "현대중공업", "329180"], name: "HD현대중공업" },
  { symbol: "042700", aliases: ["한미반도체", "hanmi semiconductor", "042700"], name: "한미반도체" },
  { symbol: "012450", aliases: ["한화에어로스페이스", "한화에어로", "hanwha aerospace", "012450"], name: "한화에어로스페이스" },
  { symbol: "000270", aliases: ["기아", "kia", "000270"], name: "기아" },
  { symbol: "005490", aliases: ["POSCO홀딩스", "포스코홀딩스", "posco holdings", "005490"], name: "POSCO홀딩스" },
  { symbol: "028260", aliases: ["삼성물산", "samsung c&t", "028260"], name: "삼성물산" },
  { symbol: "055550", aliases: ["신한지주", "shinhan", "055550"], name: "신한지주" },
  { symbol: "259960", aliases: ["크래프톤", "krafton", "259960"], name: "크래프톤" },
  { symbol: "247540", aliases: ["에코프로비엠", "ecopro bm", "247540"], name: "에코프로비엠" },
  { symbol: "086520", aliases: ["에코프로", "ecopro", "086520"], name: "에코프로" },
  { symbol: "196170", aliases: ["알테오젠", "alteogen", "196170"], name: "알테오젠" },
  { symbol: "042660", aliases: ["한화오션", "hanwha ocean", "042660"], name: "한화오션" }
];

export function findSymbolEntry(keyword) {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    return null;
  }

  const exactMatch = symbolDirectory.find((entry) =>
    getSearchTerms(entry).some((term) => term === normalizedKeyword)
  );

  if (exactMatch) {
    return exactMatch;
  }

  const [bestMatch] = searchSymbolEntries(keyword, 1);
  if (bestMatch?.score >= 70) {
    return bestMatch;
  }

  if (/^\d{6}$/.test(normalizedKeyword)) {
    return {
      symbol: normalizedKeyword,
      aliases: [normalizedKeyword],
      name: normalizedKeyword
    };
  }

  return null;
}

export function searchSymbolEntries(keyword, limit = 6) {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  return symbolDirectory
    .map((entry) => ({
      ...entry,
      score: scoreEntry(entry, normalizedKeyword)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "ko"))
    .slice(0, limit);
}

function scoreEntry(entry, normalizedKeyword) {
  const terms = getSearchTerms(entry);

  if (terms.includes(normalizedKeyword)) {
    return 120;
  }

  if (entry.symbol.startsWith(normalizedKeyword)) {
    return 110;
  }

  const normalizedName = normalizeKeyword(entry.name);
  if (normalizedName.startsWith(normalizedKeyword)) {
    return 105;
  }

  const aliasStartsWith = entry.aliases.some((alias) => normalizeKeyword(alias).startsWith(normalizedKeyword));
  if (aliasStartsWith) {
    return 95;
  }

  if (normalizedName.includes(normalizedKeyword)) {
    return 88;
  }

  const aliasContains = entry.aliases.some((alias) => normalizeKeyword(alias).includes(normalizedKeyword));
  if (aliasContains) {
    return 76;
  }

  if (isSubsequence(normalizedKeyword, normalizedName)) {
    return 72;
  }

  return 0;
}

function getSearchTerms(entry) {
  return [
    normalizeKeyword(entry.symbol),
    normalizeKeyword(entry.name),
    ...entry.aliases.map((alias) => normalizeKeyword(alias))
  ].filter(Boolean);
}

function normalizeKeyword(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function isSubsequence(keyword, target) {
  let index = 0;

  for (const char of target) {
    if (char === keyword[index]) {
      index += 1;
      if (index === keyword.length) {
        return true;
      }
    }
  }

  return false;
}
