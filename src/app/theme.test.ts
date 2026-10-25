import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [m[1], m[2]]));
}
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const light = tokens(css.match(/:root\s*\{([\s\S]*?)\}/)![1]!);
const dark = { ...light, ...tokens(css.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\}/)![1]!) };
it.each([
  ['claro', light],
  ['oscuro', dark],
] as const)('contraste de texto en tema %s', (_name, theme) => {
  for (const fg of ['fg', 'muted', 'accent', 'error'])
    for (const bg of ['bg', 'surface'])
      expect(contrast(theme[fg]!, theme[bg]!), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
  expect(contrast(theme['accent-fg']!, theme.accent!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(theme.oor!, theme.paper!)).toBeGreaterThanOrEqual(4.5);
});
