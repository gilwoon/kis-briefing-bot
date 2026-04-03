export const symbolDirectory = [
  { symbol: "005930", aliases: ["삼성전자", "samsung", "005930"], name: "삼성전자" },
  { symbol: "000660", aliases: ["SK하이닉스", "sk hynix", "000660"], name: "SK하이닉스" },
  { symbol: "035420", aliases: ["NAVER", "네이버", "035420"], name: "NAVER" },
  { symbol: "005380", aliases: ["현대차", "hyundai", "005380"], name: "현대차" },
  { symbol: "373220", aliases: ["LG에너지솔루션", "lges", "373220"], name: "LG에너지솔루션" },
  { symbol: "068270", aliases: ["셀트리온", "celltrion", "068270"], name: "셀트리온" },
  { symbol: "035720", aliases: ["카카오", "kakao", "035720"], name: "카카오" },
  { symbol: "105560", aliases: ["KB금융", "kb", "105560"], name: "KB금융" }
];

export function findSymbolEntry(keyword) {
  const normalizedKeyword = String(keyword).trim().toLowerCase();

  return symbolDirectory.find((entry) =>
    entry.aliases.some((alias) => alias.toLowerCase() === normalizedKeyword)
  );
}
