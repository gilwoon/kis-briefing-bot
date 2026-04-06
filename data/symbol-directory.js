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
  { symbol: "042700", aliases: ["한미반도체", "hanmi semiconductor", "042700"], name: "한미반도체" }
];

export function findSymbolEntry(keyword) {
  const normalizedKeyword = String(keyword).trim().toLowerCase();

  const existingEntry = symbolDirectory.find((entry) =>
    entry.aliases.some((alias) => alias.toLowerCase() === normalizedKeyword)
  );

  if (existingEntry) {
    return existingEntry;
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
