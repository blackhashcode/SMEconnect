/**
 * Removes HTML-like markup, control characters and excessive blank lines from
 * user-authored plain text. It deliberately preserves apostrophes, Bangla text
 * and currency symbols used by demo content and real profiles.
 */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
