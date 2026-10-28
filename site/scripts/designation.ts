const TRAILING =
  /^(and|or|a|an|the|any|with|to|of|in|on|for|by|not|never|et|ou|un|une|le|la|les|des|du|de|avec|à|au|aux|sur|dans|pour|par|ne|pas|jamais)$/i;

/**
 * A short engraved name for a jack: the heading up to its first pause, whole when it is five
 * words or fewer; otherwise its first three words, never ending on a joining word.
 */
export function designation(heading: string): string {
  const clause = heading.split(/[,:;.!?(—–]/)[0]?.trim() || heading.trim();
  const words = clause.split(/\s+/);
  if (words.length <= 5) return clause;
  const short = words.slice(0, 3);
  while (short.length > 1 && TRAILING.test(short.at(-1) ?? "")) short.pop();
  return short.join(" ");
}
