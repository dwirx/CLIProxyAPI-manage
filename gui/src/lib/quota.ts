export type QuotaRule = {
  id: string;
  label: string;
  match: string;
  limitTokens: number;
};

export const defaultQuotaRules: QuotaRule[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    match: 'gemini',
    limitTokens: 1_000_000
  },
  {
    id: 'gemini-image',
    label: 'Gemini Image',
    match: 'image',
    limitTokens: 500_000
  },
  {
    id: 'claude',
    label: 'Claude',
    match: 'claude',
    limitTokens: 1_000_000
  }
];

export function findRuleForModel(rules: QuotaRule[], model: string): QuotaRule | null {
  const name = model.toLowerCase();
  const matches = rules.filter(
    (rule) => rule.match && name.includes(rule.match.toLowerCase())
  );
  if (matches.length === 0) {
    return null;
  }
  return matches.sort((a, b) => b.match.length - a.match.length)[0] || null;
}

export function getRuleById(rules: QuotaRule[], id: string): QuotaRule | null {
  return rules.find((rule) => rule.id === id) || null;
}
