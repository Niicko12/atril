// @vitest-environment jsdom
import abcjs from 'abcjs';
import { buildAbc, emptyScore, getInstrument } from '@/core';
import { serializeScoreSvg } from './render-canvas';

it('el SVG real de abcjs se exporta como XML válido, con una sola declaración xmlns', () => {
  const score = { ...emptyScore('violin'), title: 'Oración & práctica', notes: [{ p: 60, d: 4 }, { p: 64, d: 4 }] };
  const host = document.createElement('div');
  document.body.appendChild(host);
  try {
    const abc = buildAbc(score, getInstrument('violin'), 'written', { names: false }).abc;
    abcjs.renderAbc(host, abc);
    const svg = host.querySelector('svg')!;
    const before = svg.outerHTML;
    const xml = serializeScoreSvg(svg, { width: 800, height: 200 });
    const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.documentElement.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(xml.slice(0, xml.indexOf('>')).match(/\sxmlns=/g)).toHaveLength(1);
    expect(parsed.documentElement.getAttribute('width')).toBe('800');
    expect(parsed.documentElement.getAttribute('height')).toBe('200');
    expect(parsed.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(svg.outerHTML).toBe(before);
  } finally { host.remove(); }
});
