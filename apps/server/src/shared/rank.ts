
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length; // 62 possible digits

function digit(ch: string): number {
  const value = DIGITS.indexOf(ch);

  if (value === -1) {
    throw new Error(`Invalid rank character: ${ch}`);
  }

  return value;
}

export function rankBetween(
  a: string | null,
  b: string | null
): string {
  // Keys ending in "0" are invalid because they leave no room before them.
  if (a?.endsWith("0") || b?.endsWith("0")) {
    throw new Error('Rank must not end in "0"');
  }

  // Treat null as an empty lower boundary.
  const lo = a ?? "";

  // The lower key must come before the upper key.
  if (b !== null && lo >= b) {
    throw new Error("Rank a must be less than b");
  }

  let result = "";

  for (let i = 0; ; i++) {
    // Missing lower digits are 0; missing upper digits are 62.
    const da = i < lo.length ? digit(lo[i]) : 0;
    const db = b !== null && i < b.length ? digit(b[i]) : BASE;

    // Same digit: keep it and check the next position.
    if (da === db) {
      result += DIGITS[da];
      continue;
    }

    // There is room between the digits: return their midpoint.
    if (db - da > 1) {
      const mid = Math.floor((da + db) / 2);
      return result + DIGITS[mid];
    }

    // Adjacent digits: keep the lower digit and extend the key.
    return result + DIGITS[da] +
      rankBetween(lo.slice(i + 1) || null, null);
  }
}
