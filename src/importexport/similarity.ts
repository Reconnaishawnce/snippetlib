/**
 * "Changed enough" heuristic (§7.9): Dice coefficient over word bigrams.
 * Below SAVE_AS_NEW_THRESHOLD the edit dialog defaults to Save as New.
 */

export const SAVE_AS_NEW_THRESHOLD = 0.6;

function words(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function bigrams(tokens: string[]): Map<string, number> {
  const grams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const gram = `${tokens[i]} ${tokens[i + 1]}`;
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Dice similarity in [0, 1]. Falls back to word sets for one-word texts. */
export function diceSimilarity(a: string, b: string): number {
  const wordsA = words(a);
  const wordsB = words(b);
  if (wordsA.length === 0 && wordsB.length === 0) {
    return 1;
  }
  if (wordsA.length < 2 || wordsB.length < 2) {
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    if (setA.size === 0 || setB.size === 0) {
      return 0;
    }
    let common = 0;
    for (const word of setA) {
      if (setB.has(word)) {
        common += 1;
      }
    }
    return (2 * common) / (setA.size + setB.size);
  }
  const gramsA = bigrams(wordsA);
  const gramsB = bigrams(wordsB);
  let overlap = 0;
  for (const [gram, countA] of gramsA) {
    const countB = gramsB.get(gram);
    if (countB !== undefined) {
      overlap += Math.min(countA, countB);
    }
  }
  const totalA = wordsA.length - 1;
  const totalB = wordsB.length - 1;
  return (2 * overlap) / (totalA + totalB);
}
