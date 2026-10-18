const ENTITIES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function xmlEscape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ENTITIES[c] as string);
}
