/** A short engraved name: the heading up to its first pause, at most three words. */
export function designation(heading: string): string {
  const clause = heading.split(/[,:;.!?(—–]/)[0]?.trim() || heading;
  return clause.split(/\s+/).slice(0, 3).join(" ");
}
