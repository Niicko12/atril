const BOMS: readonly [number[], string][] = [
  [[0xef, 0xbb, 0xbf], 'utf-8'],
  [[0xff, 0xfe], 'utf-16le'],
  [[0xfe, 0xff], 'utf-16be'],
];

function tryDecode(label: string, bytes: Uint8Array): string | null {
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return null;
  }
}

/** Bytes → texto respetando BOM y el `encoding` de la declaración XML (formats-spec 11.3). */
export function decodeText(bytes: Uint8Array): string {
  const bom = BOMS.find(([sig]) => sig.every((b, i) => bytes[i] === b));
  if (bom) return new TextDecoder(bom[1]).decode(bytes.subarray(bom[0].length));
  const head = new TextDecoder('ascii').decode(bytes.subarray(0, 200));
  const label = /^\s*<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1];
  return (label && tryDecode(label, bytes)) || new TextDecoder('utf-8').decode(bytes);
}
