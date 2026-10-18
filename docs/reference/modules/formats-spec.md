---
name: atril-formats-spec
status: in-progress
created: 2026-10-18T12:40:26Z
updated: 2026-10-18T12:40:26Z
---

# Spec: Módulo `formats` (+ `import` y `export`)

**Estado:** 🟡 Lista para revisión
**Features:** F05 (importar MusicXML/.mxl/MIDI/ABC), F06 (exportar PDF, PNG, ABC, ZIP MuseScore), F13 (enlaces)
**Historias:** US-F01 … US-F06
**Deuda que corrige:** 2 (forward/backup y anacrusa), 3 (acordes MusicXML), 9 (cambios de tempo/compás MIDI)
**Referencia de comportamiento:** `legacy/index.html` líneas 522-725 (exportadores e importadores) y 1276-1350,
1428-1520 (UI de abrir y exportar)
**Ubicación:** `src/core/formats` (puro), `src/modules/import`, `src/modules/export`, `src/infra/download.ts`

---

## Índice

1. Alcance
2. Code Structure
3. Contratos comunes
4. Exportar MusicXML
5. Exportar MIDI
6. Exportar ABC
7. Exportar ZIP "para MuseScore"
8. Exportar imagen (PNG)
9. Exportar PDF
10. Descargar y compartir
11. Detección de formato y lectura de archivos
12. Importar MusicXML y .mxl
13. Importar MIDI
14. Importar ABC
15. Convertir el resultado en partitura
16. UI de "Buscar o abrir"
17. Advertencias al usuario
18. Límites y seguridad
19. Edge cases
20. Errores y mensajes
21. Performance
22. Testing scenarios
23. Quality Gates
24. Trazabilidad
25. Diferencias intencionales con legacy
26. Preguntas abiertas

---

## 1. Alcance

| Pieza | Responsabilidad |
|---|---|
| `core/formats/musicxml-export.ts` | `Score` → texto MusicXML 3.1 partwise (alturas escritas + `<transpose>`) |
| `core/formats/midi-export.ts` | `Score` → bytes SMF formato 0 (sonido real) |
| `core/formats/musicxml-import.ts` | Texto MusicXML → `ImportResult` (melodía principal) |
| `core/formats/midi-import.ts` | Bytes SMF → `ImportResult` |
| `core/formats/abc-import.ts` | Árbol de abcjs → `ImportResult` |
| `core/formats/harmony.ts` | Cifrado en solfeo ⇄ `<harmony>` de MusicXML |
| `core/formats/text-decode.ts` | Bytes → texto respetando BOM y `encoding` de la declaración XML |
| `modules/import` | Leer archivo, descomprimir .mxl, pegar ABC, enlaces a sitios, avisos, entregar al editor |
| `modules/export` | Botones, imagen, PDF, ZIP, copiar ABC, compartir |
| `infra/download.ts` | Descargar un `Blob` o compartirlo con Web Share |

Fuera de alcance: PDF → notas (OMR), MusicXML `score-timewise`, archivos de MuseScore `.mscz`, Guitar Pro, LilyPond.

---

## 2. Code Structure

```
src/core/formats/
├── musicxml-export.ts      (≤ 150)   # orquesta
├── musicxml-measure.ts     (≤ 150)   # <measure>, <attributes>, <note>, <tie>
├── musicxml-transpose.ts   (≤ 60)    # cálculo de <transpose> (F-X1)
├── harmony.ts              (≤ 120)
├── midi-export.ts          (≤ 120)
├── midi-reader.ts          (≤ 150)   # lectura de bytes SMF → eventos crudos
├── midi-import.ts          (≤ 150)   # eventos → ImportResult
├── musicxml-reader.ts      (≤ 150)   # DOM → eventos por voz con tiempos
├── musicxml-import.ts      (≤ 150)   # eventos → ImportResult
├── abc-import.ts           (≤ 150)
├── mono.ts                 (≤ 100)   # reducción a una voz (nota superior), relleno de anacrusa
├── text-decode.ts          (≤ 60)
├── warnings.ts             (≤ 60)
└── index.ts

src/modules/import/
├── components/  find-overlay.tsx · file-open.tsx · abc-paste.tsx · site-links.tsx · import-warnings.tsx
├── services/    import.service.ts (detección, lectura, unzip, límites)
├── strings.ts · index.ts

src/modules/export/
├── components/  export-bar.tsx · image-overlay.tsx
├── services/    render-canvas.ts · pdf.service.ts · zip.service.ts · file-names.ts
├── strings.ts · index.ts

src/infra/download.ts       (≤ 80)
```

### 2.1 Cambio de dependencia (ADR-011)

| Antes (legacy y technical-decisions 2.1) | Ahora |
|---|---|
| JSZip 3.10 (~100 KB) para .mxl y el ZIP | **fflate** (MIT, ~8 KB gzip, gratis) |

Motivo: fflate expone el tamaño descomprimido de cada entrada **antes** de descomprimir (filtro), lo que permite
cortar zip bombs sin usar APIs internas, y pesa una fracción. `technical-decisions.md` 2.1 se actualiza al aprobar
esta spec.

jsPDF 2.5 se mantiene (MIT) con carga diferida.

---

## 3. Contratos comunes

```typescript
// core/formats/index.ts
export function toMusicXML(score: Score, instrument: Instrument): string;
export function toMidi(score: Score, instrument: Instrument): Uint8Array;
export function parseMusicXML(text: string, dom: DomParserLike): ImportResult;
export function parseMidi(bytes: ArrayBuffer): ImportResult;
export function parseAbcTune(tune: AbcjsTuneLike): ImportResult;

/** Para inyectar DOMParser en navegador y @xmldom/xmldom en tests de Node. */
export interface DomParserLike {
  parseFromString(text: string, type: 'application/xml'): Document;
}
```

`ImportResult` y `ImportWarning` están en technical-decisions 8.5. Se agregan dos códigos:

| Código nuevo | Cuándo |
|---|---|
| `repeats_ignored` | ABC/MusicXML con repeticiones o casillas: se leyó tal como está escrito, sin repetir |
| `parts_more` | MusicXML con varias partes: se abrió la primera (`detail` = nombre y total) |

Reglas comunes de los importadores:
- **Puros:** reciben texto/bytes/árbol y devuelven datos; no tocan el store ni la UI.
- Lanzan `Error` con mensaje **en español apto para el usuario** cuando el archivo no se puede usar (el service lo
  envuelve en `AppError('import_parse_failed' | 'import_no_notes')`).
- Siempre devuelven alturas en **sonido real**.
- Máximo 3 000 notas (`truncated`).

---

## 4. Exportar MusicXML

### 4.1 Estructura

MusicXML 3.1 `score-partwise`, una parte `P1`, una voz. Las alturas van **escritas para el instrumento** y se
declara `<transpose>` para que los programas sepan el sonido real.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>{título | Sin título}</work-title></work>
  <identification>
    <creator type="composer">{compositor}</creator>          <!-- solo si hay -->
    <encoding><software>Atril</software></encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>{nombre del instrumento}</part-name>
      <score-instrument id="P1-I1"><instrument-name>{nombre}</instrument-name></score-instrument>
      <midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>{gm + 1}</midi-program></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>{armadura escrita}</fifths></key>
        <time symbol="common">  <!-- symbol solo en 4/4 -->
          <beats>4</beats><beat-type>4</beat-type>
        </time>
        <clef><sign>G</sign><line>2</line></clef>
        <transpose>…</transpose>   <!-- solo si transpose ≠ 0, ver 4.3 -->
      </attributes>
      <direction placement="above">
        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>{tempo}</per-minute></metronome></direction-type>
        <sound tempo="{tempo}"/>
      </direction>
      … notas …
    </measure>
    …
    <!-- último compás: <barline location="right"><bar-style>light-heavy</bar-style></barline> -->
  </part>
</score-partwise>
```

### 4.2 Notas

`divisions = 4` ⇒ 1 unidad de Atril (semicorchea) = `duration` 1.

| `d` del fragmento | `<type>` | `<dot/>` |
|---|---|---|
| 16 | whole | no |
| 12 | half | sí |
| 8 | half | no |
| 6 | quarter | sí |
| 4 | quarter | no |
| 3 | eighth | sí |
| 2 | eighth | no |
| 1 | 16th | no |

Por cada fragmento de `toMeasures` (spec notation-core 9.3):

```xml
<note>
  <pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>   <!-- o <rest/> -->
  <duration>4</duration>
  <tie type="stop"/>        <!-- si es continuación (¬first) y tiene tono -->
  <tie type="start"/>       <!-- si sigue ligada (¬last) y tiene tono -->
  <voice>1</voice>
  <type>quarter</type>
  <dot/>                    <!-- si corresponde -->
  <notations><tied type="stop"/><tied type="start"/></notations>
</note>
```

- `<alter>` se omite si es 0. La ortografía es `spell(p + transpose, armaduraEscrita)`.
- `<accidental>` no se emite (los programas lo calculan); ver Q2.
- Orden de elementos según el XSD: `pitch|rest`, `duration`, `tie*`, `voice`, `type`, `dot*`, `notations`.

### 4.3 `<transpose>` (requisito F-X1: generalizar a negativos)

MusicXML define `<transpose>` como lo que hay que sumar a la altura **escrita** para obtener la que **suena**:
`chromatic` y `diatonic` dentro de la octava, y `octave-change` para las octavas completas.

```
total = −instrument.transpose              # sonido − escrito
octaves = trunc(total / 12)                # hacia cero
rest = total − 12·octaves                  # −11..11
chromatic = rest
diatonic = sign(rest) · DIATONIC[|rest|]
DIATONIC = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]    # semitonos → pasos de escala (intervalos más comunes)
emitir <diatonic>, <chromatic>, y <octave-change> solo si octaves ≠ 0
```

| Instrumento | transpose | diatonic | chromatic | octave-change | Legacy |
|---|---|---|---|---|---|
| Clarinete Si♭ / Trompeta | 2 | −1 | −2 | — | ✅ igual |
| Saxofón alto Mi♭ | 9 | −5 | −9 | — | ✅ igual |
| Saxofón tenor Si♭ | 14 | −1 | −2 | −1 | ✅ igual |
| Corno Fa | 7 | −4 | −7 | — | ✅ igual |
| Guitarra / Bajo / Contrabajo | 12 | 0 | 0 | −1 | ✅ igual |
| Flauta dulce (pendiente) | −12 | 0 | 0 | **+1** | ❌ legacy omitía la octava |

`DIATONIC` por tabla en lugar de `round(rest·7/12)` para no depender del redondeo de `Math.round` con negativos
(−3.5 → −3).

### 4.4 Clave

| `clefFor` | `<sign>` | `<line>` |
|---|---|---|
| treble | G | 2 |
| bass | F | 4 |
| alto | C | 3 |

Para guitarra, bajo y contrabajo se agrega `<clef-octave-change>-1</clef-octave-change>`? **No**: Atril escribe una
octava arriba con `<transpose>` (convención de MuseScore para guitarra). Mezclar ambas cosas duplicaría la octava.

### 4.5 Cifrado → `<harmony>` (nuevo)

Las notas con `c` (cifrado que viene de "De oído") generan, antes de su `<note>` en el primer fragmento:

```xml
<harmony print-frame="no">
  <root><root-step>A</root-step></root>
  <kind text="m">minor</kind>
</harmony>
```

`core/formats/harmony.ts` convierte el nombre en solfeo:

| Raíz (texto) | step | alter |
|---|---|---|
| Do, Re, Mi, Fa, Sol, La, Si | C D E F G A B | 0 |
| + ♯ / # | — | 1 |
| + ♭ / b | — | −1 |

| Sufijo | `<kind>` | `text` |
|---|---|---|
| (vacío) | major | "" |
| m | minor | "m" |
| 7 | dominant | "7" |
| m7 | minor-seventh | "m7" |
| dim | diminished | "dim" |
| otro | other | sufijo tal cual |

Si la raíz no se reconoce → `<direction placement="above"><direction-type><words>{c}</words></direction-type></direction>`.

**La raíz se transpone** como la nota: el cifrado se calcula en sonido real y se escribe para el instrumento
(`spell(raízMidi + transpose, armaduraEscrita)`).

### 4.6 Partitura vacía y último compás

- Vacía: un compás con `<note><rest measure="yes"/><duration>{bar}</duration><voice>1</voice></note>`.
- **Último compás incompleto (nuevo):** se completa con silencios (`splitDuration` del faltante) para que el compás
  sume `bar`. Legacy lo dejaba corto (verificado: 10/16), lo que algunos programas marcan como compás irregular.

### 4.7 Escapado

`xmlEscape` para `& < > "` en título, compositor e instrumento (legacy `xmlEsc`).

---

## 5. Exportar MIDI

### 5.1 Formato

SMF **formato 0** (una sola pista), igual que legacy, para mantener bytes idénticos en los tests dorados.

| Elemento | Valor |
|---|---|
| Cabecera | `MThd`, longitud 6, formato 0, 1 pista, PPQ 480 |
| Unidad | 1 semicorchea = 120 ticks |
| Meta título (0x03) | Título en UTF-8 o "Atril" |
| Tempo (0x51) | `round(60 000 000 / tempo)` µs por negra |
| Compás (0x58) | `nn = numerador`, `dd = log2(denominador)`, 24 clocks, 8 fusas por negra |
| Armadura (0x59) | `sf = key` (byte con signo), `mi = 0` |
| Programa (0xC0) | `instrument.gmProgram` en canal 0 |
| Nota | `0x90 p 90` … `0x80 p 0` con duración `d·120` ticks |
| Silencios | Se acumulan como delta de la siguiente nota |
| Fin de pista | `FF 2F 00` |

### 5.2 Altura

**Sonido real** (`p` tal cual), porque el MIDI es audio. Las notas ligadas no existen en el modelo (cada `Note` es
una nota completa), así que no hay que unir fragmentos.

### 5.3 Cifrados

No se exportan en el MIDI del MVP (Q3: pista de acordes opcional).

### 5.4 Verificado

Ida y vuelta legacy `toMidi → parseMidi` conserva notas, tempo y compás (2026-10-18). Debe seguir valiendo (T-MID-05).

---

## 6. Exportar ABC

- Texto = `buildAbc(score, instrument, 'written', {})` (spec notation-core 10), **sin** nombres de notas ni
  dependencia de la vista actual: siempre la parte escrita del instrumento.
- Botón "Copiar texto ABC": `navigator.clipboard.writeText`; si falla, abre el `<details>` con el texto
  seleccionado y muestra "Selecciona y copia el texto".
- El `<details>` "Texto ABC (para otros programas)" muestra el ABC **de la vista actual** (con nombres si están
  activos), igual que legacy.

---

## 7. Exportar ZIP "para MuseScore"

### 7.1 Contenido

| Archivo | Contenido |
|---|---|
| `{base}.musicxml` | `toMusicXML(score, instrument)` |
| `{base}.mid` | `toMidi(score, instrument)` |
| `{base}.abc` | ABC de 6 |
| `LEEME.txt` | Instrucciones (CRLF para Windows) |

`LEEME.txt` (texto de legacy):

```
Partitura creada con Atril.

- {base}.musicxml: ábrelo con MuseScore (gratis), Finale, Sibelius o Dorico para seguir editándolo o imprimirlo.
- {base}.mid: el sonido, para cualquier programa de música o DAW.
- {base}.abc: texto ABC; también puedes volver a abrir cualquiera de estos archivos en Atril con «Buscar o abrir».
```

### 7.2 Nombre de archivo (`file-names.ts`)

```
base = limpiar(título || "partitura") + " - " + displayName(instrument)
limpiar = eliminar \ / : * ? " < > |, recortar espacios, máximo 80 caracteres; vacío → "partitura"
nombre = base + "." + extensión
```

Ejemplo: "Cielito lindo - Saxofón alto en Mib.zip".

### 7.3 Compresión

fflate `zipSync` con nivel 6; los archivos son texto pequeño (< 300 KB).

---

## 8. Exportar imagen (PNG)

### 8.1 Render limpio fuera de pantalla

```
contenedor oculto (posición −10 000 px, ancho 800 px, aria-hidden)
ABCJS.renderAbc(contenedor, buildAbc(score, instrument, vistaActual, {names: showNames}).abc, opcionesExport)
    opcionesExport = scoreRenderOptions('export') (spec notation-core 12.3) + tablatura si aplica
    si falla con tablatura → sin tablatura
svg = contenedor.querySelector('svg')
clon con xmlns, width/height = getBoundingClientRect()
img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(XMLSerializer)
canvas = (ancho + 2·30) × (alto + 2·30) a escala 2.5, fondo blanco, imagen en (30, 30)
```

- Se usa la **vista actual** (lo que el usuario ve), a diferencia del ABC del ZIP.
- Fuentes: abcjs dibuja con trazos SVG (no depende de fuentes web) → la imagen es fiel.

### 8.2 Overlay "Imagen"

- Muestra la imagen (`<img>` con `alt="Partitura como imagen"`).
- Texto: "Mantén presionada la imagen para guardarla o compartirla."
- Botones: **Descargar imagen** (PNG), **Copiar** (`ClipboardItem` con `image/png`; si no se puede: "Mantén
  presionada la imagen para guardarla"), **Compartir** (10.2, solo si Web Share con archivos está disponible).

---

## 9. Exportar PDF

### 9.1 Algoritmo (portado de legacy)

```
cargar jsPDF (import dinámico)
c = renderCanvas()                     # 8.1
pdf = new jsPDF({unit: 'pt', format: 'letter'})
PW, PH = tamaño de página; M = 36 pt
escala = (PW − 2M) / c.width
alturaCorte = floor((PH − 2M) / escala)        # en píxeles del canvas
y = 0
mientras y < c.height − 4:
    fin = min(c.height, y + alturaCorte)
    si fin < c.height:
        k = fin
        mientras k > y + alturaCorte·0.5 y !filaBlanca(k): k −= 2
        si k > y + alturaCorte·0.5: fin = k                 # cortar en un espacio entre sistemas
    parte = recorte [y, fin) → JPEG calidad 0.92
    si no es la primera página: addPage
    addImage(parte, M, M, c.width·escala, (fin − y)·escala)
    y = fin
guardar como Blob
```

`filaBlanca(y)`: todos los píxeles muestreados cada 4 (`i += 16` bytes RGBA) con canal R ≥ 245.

### 9.2 Tamaño de papel

Carta (Letter) en el MVP, como legacy. Ver Q4 (A4 es más común en Latinoamérica).

### 9.3 Metadatos

`pdf.setProperties({ title, author: composer, creator: 'Atril' })` (nuevo).

---

## 10. Descargar y compartir (`infra/download.ts`)

### 10.1 Descargar

```typescript
export async function saveBlob(filename: string, blob: Blob): Promise<void>;
```

```
url = URL.createObjectURL(blob)
a = <a href=url download=filename rel="noopener"> ; a.click()
setTimeout(() => URL.revokeObjectURL(url), 30 000)
```

- Funciona en Chrome, Firefox, Safari de escritorio y Safari de iOS ≥ 13.
- Legacy usaba la capacidad `downloads` del artifact; ya no existe fuera de Claude.

### 10.2 Compartir (nuevo, *Should*, inspirado en la persona Marco)

```typescript
export function canShareFiles(): boolean;     // navigator.canShare?.({ files: [archivoDePrueba] })
export async function shareBlob(filename: string, blob: Blob, title: string): Promise<'shared' | 'cancelled'>;
```

- Botón **Compartir** junto a "Descargar PDF" e "Imagen" solo si `canShareFiles()` (Android Chrome, Safari iOS).
- Permite mandar el PDF o la imagen directo a WhatsApp.
- Cancelar el menú del sistema (`AbortError`) no muestra error.

### 10.3 Mensajes

| Resultado | Toast |
|---|---|
| Descargado | "Listo: {nombre}" |
| Compartido | "Compartido" |
| Error | "No se pudo descargar" / "No se pudo compartir" |

---

## 11. Detección de formato y lectura de archivos

### 11.1 Por extensión

| Extensión | Formato | Lectura |
|---|---|---|
| `.mid`, `.midi` | MIDI | `arrayBuffer` |
| `.mxl` | MusicXML comprimido | `arrayBuffer` → unzip |
| `.musicxml`, `.xml` | MusicXML | `arrayBuffer` → `decodeText` |
| `.abc`, `.txt` | ABC (o MusicXML si empieza con `<`) | `arrayBuffer` → `decodeText` |
| Otra | Intentar por contenido (11.2) | |

`accept` del input: `.musicxml,.xml,.mxl,.mid,.midi,.abc,.txt`.

### 11.2 Por contenido (respaldo)

| Primeros bytes | Formato |
|---|---|
| `MThd` | MIDI |
| `PK\x03\x04` | ZIP → .mxl |
| `<` tras espacios/BOM | MusicXML |
| `X:` o `K:` en alguna línea | ABC |
| Otro | Error "Ese archivo no parece una partitura…" |

### 11.3 `decodeText(bytes)` (nuevo)

```
BOM EF BB BF → UTF-8
BOM FF FE → UTF-16LE ; FE FF → UTF-16BE
si no hay BOM y empieza con "<?xml": leer encoding="…" de la declaración (ASCII) → TextDecoder(etiqueta)
    etiqueta desconocida → UTF-8
si no: UTF-8 (fatal: false)
```

Motivo: algunos exportadores (Finale antiguos, Sibelius) escriben UTF-16 o ISO-8859-1; `file.text()` de legacy
asumía UTF-8 y rompía acentos o fallaba.

### 11.4 Descomprimir .mxl

```
entradas = unzip(bytes, filtro: f => f.originalSize ≤ 20 MB y suma ≤ 20 MB)
si se excede → Error "El archivo comprimido es demasiado grande."
container = entradas['META-INF/container.xml'] → primer rootfile full-path
si no: primera entrada *.musicxml|*.xml fuera de META-INF
si no: Error "El archivo .mxl no contiene una partitura."
```

---

## 12. Importar MusicXML y .mxl

### 12.1 Validaciones iniciales

| Condición | Resultado |
|---|---|
| El texto contiene `<!ENTITY` | Error "El archivo tiene un formato no permitido." (seguridad) |
| `parsererror` en el DOM | Error "No se pudo leer el archivo MusicXML." |
| Raíz `score-timewise` | Error "Solo se pueden abrir partituras MusicXML «partwise». Ábrela en MuseScore y expórtala de nuevo." |
| Raíz distinta | Error "No es un archivo MusicXML." |
| Sin `<part>` | Error "El archivo no tiene partes." |

### 12.2 Metadatos

| Campo | Fuente |
|---|---|
| Título | `work-title` → `movement-title` → `credit-words` del primer `credit` → nombre de archivo |
| Compositor | Primer `creator` con `type="composer"` (o sin tipo) |
| Instrumento | `guessInstrument(part-name)` (12.7) |
| Varias partes | Se usa la primera; warning `parts_more` con "Flauta (1 de 4)" |

### 12.3 Lectura por tiempo (corrige deuda 2)

Se procesa compás por compás manteniendo un **cursor de tiempo** en divisiones, como exige el formato:

```
div = 1; voiceSel = null; t = 0 (inicio de la medida en unidades absolutas)
eventos = []                                # {start, dur, midi|null, tieStart, tieStop, chord}
para cada <measure>:
    cursor = 0 ; maxCursor = 0
    para cada hijo:
        <attributes>: actualizar div, fifths (primera vez), meter (primera vez; cambios → warning), transpose
        <direction>/<sound tempo>: tempo (primera vez; cambios → warning)
        <backup duration=d>:  cursor −= d
        <forward duration=d>: si voice == voiceSel (o sin voice) → evento silencio [cursor, d]; cursor += d
        <note>:
            si grace o cue: ignorar
            voz = <voice> ?? '1'; voiceSel ??= voz
            si <chord/>: es otra nota en el mismo inicio que la anterior; no avanza el cursor
            si voz ≠ voiceSel: avanzar cursor (si no es chord) y continuar
            registrar evento {start: cursor, dur, midi o null, ties}
            si no es chord: cursor += dur
        maxCursor = max(maxCursor, cursor)
    duraciónMedida = maxCursor
    si es el primer compás y (implicit="yes" o duraciónMedida < barEsperado): pickup = duraciónMedida
    convertir los eventos de la medida a unidades: u = round(x · 4 / div) (con acumulado para no perder redondeo)
    t += duraciónMedida
```

### 12.4 Reducción a una voz (`mono.ts`, corrige deuda 3)

```
agrupar eventos con el mismo inicio (incluye <chord/>)
de cada grupo: la nota con altura más aguda (silencio solo si todo el grupo es silencio)
si algún grupo tenía > 1 nota: warning polyphony_reduced
huecos entre eventos → silencios
solapamientos (voz con notas superpuestas) → la nota anterior se corta en el inicio de la siguiente
ligaduras: si una nota tiene tieStop y la anterior es la misma altura con tieStart → se suman
```

### 12.5 Anacrusa (deuda 2)

Si `pickup > 0`: se antepone un silencio de `bar − pickup` unidades y warning `pickup_padded` ("La pieza empieza
con anacrusa; se completó el primer compás con silencio").

### 12.6 Alturas y armadura

| Dato | Cálculo |
|---|---|
| Altura (sonido real) | `(octave + 1)·12 + NAT[step] + round(alter) + chromatic + 12·octave-change` |
| Armadura (sonido real) | `normalizeFifths(fifths + 7·(chromatic + 12·octave-change))` |
| Compás | `pickMeter(beats, beat-type)`; no soportado → aproximación (12.8) + warning `unsupported_meter` |
| Tempo | Primer `<sound tempo>`; si no, `<metronome>` con `beat-unit` quarter; si no, 100 |

### 12.7 `guessInstrument(nombre)` (legacy, sin cambios)

Búsqueda por subcadena, en este orden (la primera que coincida gana):

| Subcadena | id |
|---|---|
| bajo, bass guitar, electric bass | bajo |
| contrab, double bass | contrabajo |
| ukul | ukulele |
| guitar, guitarra | guitarra |
| violonc, cello | cello |
| viola | viola |
| viol | violin |
| flaut, flute | flauta |
| oboe | oboe |
| clarinet | clarinete |
| alto sax, sax alto, saxofón alto | saxalto |
| tenor sax, sax tenor | saxtenor |
| trumpet, trompet | trompeta |
| horn, corno | corno |
| trombon, trombone | trombon |
| tuba | tuba |
| voice, voz, vocal, soprano | voz |
| piano | piano |

Sin coincidencia → `null` (se mantiene el instrumento actual). Si se aprueba la flauta dulce: agregar
"recorder", "flauta dulce", "dulce" **antes** de "flaut".

### 12.8 `pickMeter(num, den)`

Si `num/den` está en los 6 soportados → ese. Si no: `den == 8` → 6/8; otro → 4/4. (Legacy.)

---

## 13. Importar MIDI

### 13.1 Lectura (`midi-reader.ts`)

| Validación | Error |
|---|---|
| No empieza con `MThd` | "No es un archivo MIDI." |
| División SMPTE (bit 15) | "Formato MIDI no compatible." |
| Lectura fuera de rango | "El archivo MIDI está dañado." |

Procesamiento de eventos (corrige running status):

```
para cada pista (MTrk):
    tick = 0; running = 0
    mientras p < fin:
        tick += vlq()
        b = byte(p)
        si b ≥ 0x80: estado = b; p++ ; si b < 0xF0: running = b
        si no: estado = running           # running status (solo mensajes de canal)
        FF meta: tipo, longitud; leer 0x51 tempo, 0x58 compás, 0x59 armadura, 0x03 nombre
                 → NO modifica running
        F0/F7 sysex: saltar longitud → NO modifica running
        canal: hi = estado & F0; 1 o 2 bytes de datos según hi (C0, D0 = 1 byte)
              note on (vel > 0) / note off (o note on vel 0) por (canal, nota) con cola FIFO
```

Legacy asignaba `status = 0xFF` tras un meta y, si la pista seguía con running status, leía mal el resto.

### 13.2 Metadatos

| Dato | Regla | Warning |
|---|---|---|
| Tempo | Primer 0x51 | `tempo_changes` si hay más con valor distinto |
| Compás | Primer 0x58 → `pickMeter` | `meter_changes` si hay más distintos |
| Armadura | Primer 0x59, `normalizeFifths` | — |
| Título | Nombre (0x03) de la primera pista | — |
| Instrumento | `guessInstrument(nombre de la pista elegida)` | — |

### 13.3 Elección de la pista

- Grupos por (pista, canal), excluyendo canal 10 (índice 9, percusión).
- Se elige el grupo con **más notas** (legacy). Ver Q5 (preferir la más aguda o la que tenga nombre de melodía).
- Sin notas → "El MIDI no tiene notas."

### 13.4 Cuantización a semicorcheas

```
q = PPQ / 4
s = round(start / q); e = max(s + 1, round(end / q))
si |start/q − s| > 0.2 en > 5 % de las notas → warning tuplets_rounded
```

### 13.5 Reducción a una voz

Mismo `mono.ts` que 12.4 (nota más aguda por inicio; corte en el inicio de la siguiente). El silencio inicial va
desde el **inicio del compás** de la primera nota (`posT = s0 − s0 mod bar`, legacy), lo que preserva la alineación
de compases si el MIDI empieza con anacrusa.

---

## 14. Importar ABC

### 14.1 Entrada

- Archivo `.abc`/`.txt` o texto pegado (máximo 200 KB).
- Si el texto no tiene `X:`, se antepone `X:1\n` (legacy).
- `modules/import` llama `ABCJS.parseOnly(texto)`; si no hay melodías → "No se encontró ninguna melodía en el texto
  ABC." Si hay varias, se usa la primera (warning `parts_more` con "1 de N melodías").

### 14.2 `parseAbcTune(tune)` (legacy + mejoras)

| Aspecto | Regla |
|---|---|
| Compás | `getMeterFraction()` → `pickMeter` |
| Tempo | `bpm · (duración de la unidad, default 1/4) · 4` → negras por minuto |
| Armadura | Suma de alteraciones de la primera clave (sostenidos +1, bemoles −1) |
| Voz | `staff[0].voices[0]` de cada línea |
| Alteraciones | Por compás (`state` por letra+octava), reinicio en cada barra; cambios de `K:` en mitad |
| Tresillos | `tripletMultiplier`; posiciones redondeadas a 1/16 con acumulado → warning `tuplets_rounded` |
| Acordes | Nota más aguda (`polyphony_reduced`) |
| Ligaduras | `startTie` + misma letra/octava sin nueva alteración → se suma |
| Silencios invisibles (`x`) | Se ignoran (`rest.type === 'spacer'`) |
| Repeticiones / casillas | Se leen como están escritas (sin expandir) → warning `repeats_ignored` (nuevo) |
| Título / compositor | `metaText.title`, `metaText.composer` |

---

## 15. Convertir el resultado en partitura

`modules/import/services/import.service.ts`:

```
resultado = parse…()
score = {
  localId: nuevo, title: resultado.title || nombreArchivo || 'Sin título', composer,
  key, meter, tempo: clamp(tempo, 30, 240), notes, source: formato,
  instrumentId: resultado.instrumentId ?? instrumentoActual,
  showNames: false, showTab: false,
}
validateScore(score)
library.prepareReplace() → editor.replaceScore(score)
toast "Abierta: N notas. Pulsa Guardar para conservarla."
si hay warnings → panel de avisos (17)
```

---

## 16. UI de "Buscar o abrir"

Overlay con tres bloques (el bloque "Pedir la melodía a Claude" de legacy **se elimina**, R1):

### 16.1 Abrir un archivo

- Texto: "MusicXML o .mxl (de MuseScore, Finale, Sibelius), MIDI (.mid) o ABC. Se toma la melodía principal."
- Botón "Elegir archivo" (`<label>` con `<input type=file>` oculto).
- Mensaje de estado: "Abriendo {nombre}…" → error en rojo o cierre del overlay al abrir.

### 16.2 Dónde encontrar partituras (F13)

Campo "Nombre de la canción" que actualiza los enlaces en vivo (`encodeURIComponent`).

| Grupo | Sitio | URL |
|---|---|---|
| Gratis, de dominio público | IMSLP (clásica) | `https://imslp.org/index.php?title=Special:Search&search={q}` |
| | Mutopia | `https://www.mutopiaproject.org/cgibin/make-table.cgi?searchingfor={q}` |
| | abcnotation | `https://abcnotation.com/searchTunes?q={q}` |
| Canciones modernas, con permiso de los autores | MuseScore | `https://musescore.com/sheetmusic?text={q}` |
| | Ultimate Guitar (acordes y tabs) | `https://www.ultimate-guitar.com/search.php?search_type=title&value={q}` |
| | Songsterr (tabs) | `https://www.songsterr.com/?pattern={q}` |
| | Musicnotes | `https://www.musicnotes.com/search/go?w={q}` |

Enlaces con `target="_blank" rel="noopener noreferrer"`. Textos de ayuda de legacy, quitando la referencia a "De
oído" como alternativa a Claude.

### 16.3 Pegar texto ABC

`<textarea>` monoespaciado con placeholder de ejemplo, botón "Abrir texto", mensaje de error.

### 16.4 Cerrar

Botón "Cerrar", clic en el fondo, `Escape`.

---

## 17. Advertencias al usuario

Tras importar, si hay warnings, se muestra un panel discreto bajo la partitura (no un toast, para que se pueda leer):

| Código | Texto |
|---|---|
| truncated | "La pieza tenía más de 3 000 notas; se abrieron las primeras 3 000." |
| polyphony_reduced | "Había acordes o varias voces; se tomó la nota más aguda." |
| tempo_changes | "La pieza cambia de tempo; se usó el primero (♩ = N)." |
| meter_changes | "La pieza cambia de compás; se usó el primero (N/M)." |
| unsupported_meter | "El compás N/M no está disponible; se usó X." |
| tuplets_rounded | "Había tresillos u otros grupos irregulares; se ajustaron a la semicorchea más cercana." |
| pickup_padded | "La pieza empieza con anacrusa; se completó el primer compás con silencio." |
| repeats_ignored | "La pieza tiene repeticiones; se abrió tal como está escrita, sin repetir." |
| parts_more | "El archivo tiene varias partes; se abrió {detalle}." |

Botón "Entendido" lo cierra. Se cierra solo al editar la partitura.

---

## 18. Límites y seguridad

| Entrada | Límite | Al exceder |
|---|---|---|
| Archivo de texto (MusicXML, ABC) | 5 MB | "El archivo es demasiado grande (máximo 5 MB)." |
| .mxl comprimido | 5 MB | Ídem |
| .mxl descomprimido | 20 MB total | "El archivo comprimido es demasiado grande." |
| MIDI | 2 MB | "El archivo MIDI es demasiado grande (máximo 2 MB)." |
| ABC pegado | 200 KB | "El texto es demasiado largo." |
| Notas | 3 000 | warning `truncated` |
| Pistas MIDI | 64 | Se leen las primeras 64 |
| Compases MusicXML | 2 000 | Se leen los primeros 2 000 (+ `truncated`) |

- DOMParser del navegador no resuelve entidades externas; además se rechaza `<!ENTITY` (12.1).
- El parseo de archivos ocurre en el hilo principal (son pequeños). Si un MusicXML tarda > 500 ms en parsear se
  registra en diagnóstico (Q6: moverlo a Worker).
- Nunca se usa `innerHTML` con contenido del archivo; títulos y nombres pasan por React.

---

## 19. Edge cases

| # | Caso | Esperado |
|---|---|---|
| X1 | MusicXML de MuseScore con 2 voces en el mismo pentagrama (`<backup>`) | Solo la voz 1, tiempos correctos |
| X2 | Voz 1 con `<forward>` (hueco) | Silencio de esa duración |
| X3 | Primer compás `implicit="yes"` de 1 negra en 4/4 | Silencio de 12 + nota; barras alineadas |
| X4 | Acorde Do-Mi-Sol | Sol (la más aguda) + warning |
| X5 | Nota de adorno (`<grace/>`) | Ignorada |
| X6 | Ligadura entre compases | Una nota con duración sumada |
| X7 | `<divisions>` cambia a mitad de la pieza | Conversión correcta por compás |
| X8 | Clarinete escrito con `<transpose>` −2 | Alturas en sonido real (escrita − 2) y armadura de sonido real |
| X9 | Guitarra con `<octave-change>-1` | Alturas una octava abajo de lo escrito |
| X10 | MusicXML en UTF-16 con BOM | Se lee bien con acentos |
| X11 | MusicXML ISO-8859-1 declarado | Acentos correctos |
| X12 | `score-timewise` | Error con instrucción |
| X13 | .mxl sin `container.xml` | Usa el primer .xml |
| X14 | .mxl con entrada de 50 MB descomprimida | Error de tamaño, sin descomprimir |
| X15 | MIDI formato 0 con 3 canales | Canal con más notas (sin percusión) |
| X16 | MIDI con running status después de un meta | Notas correctas (corrige legacy) |
| X17 | MIDI solo con percusión | "El MIDI no tiene notas." |
| X18 | MIDI con 3 cambios de tempo | Primer tempo + warning |
| X19 | MIDI con tresillos de corchea | Redondeo + warning `tuplets_rounded` |
| X20 | MIDI con notas superpuestas (legato) | La anterior se corta |
| X21 | MIDI que empieza en el tiempo 3 del compás 1 | Silencio desde el inicio del compás |
| X22 | ABC sin `X:` | Se antepone |
| X23 | ABC con dos melodías | Primera + warning |
| X24 | ABC con `|: … :|` | Tal como está + warning |
| X25 | ABC con acorde `[CEG]` | G |
| X26 | Exportar con título vacío | "partitura - Piano.zip" y `Sin título` en el XML |
| X27 | Exportar título con `/` y `:` | Se eliminan del nombre de archivo |
| X28 | Exportar partitura vacía | MusicXML con compás de silencio; MIDI solo con metas |
| X29 | Exportar saxofón tenor | `<transpose>` −1/−2/−1 y alturas +14 |
| X30 | Exportar con último compás incompleto | Completado con silencio |
| X31 | Exportar nota con cifrado "Fa♯m" | `<harmony>` root F alter 1, kind minor (transpuesto si aplica) |
| X32 | Exportar con cifrado no reconocible "N.C." | `<words>N.C.</words>` |
| X33 | PDF de 1 compás | 1 página |
| X34 | PDF de 300 compases | Varias páginas, sin cortar sistemas por la mitad |
| X35 | Compartir no disponible (escritorio) | Botón oculto |
| X36 | Usuario cancela el menú de compartir | Sin mensaje de error |
| X37 | Import exitoso con partitura actual sin guardar | `prepareReplace` decide antes de reemplazar |

---

## 20. Errores y mensajes

| Código AppError | Mensaje (español) |
|---|---|
| import_unsupported_format | "Ese archivo no parece una partitura. Usa MusicXML, .mxl, MIDI o ABC." |
| import_file_too_large | Según tabla 18 |
| import_parse_failed | El mensaje específico del importador (12.1, 13.1, 14.1) o "No se pudo abrir el archivo." |
| import_no_notes | "No se encontraron notas en la primera parte." / "El MIDI no tiene notas." / "No se encontraron notas en el texto ABC." |
| export_render_failed | "No se pudo crear la imagen." |
| export_lib_load_failed | "No se pudo cargar una herramienta. Revisa tu conexión." (jsPDF diferido) |

Los mensajes de import se muestran **en el overlay** (bloque correspondiente), no en toast.

---

## 21. Performance

| Operación | Objetivo |
|---|---|
| `toMusicXML` 3 000 notas | ≤ 30 ms |
| `toMidi` 3 000 notas | ≤ 10 ms |
| `parseMusicXML` 1 MB | ≤ 300 ms (móvil referencia) |
| `parseMidi` 200 KB | ≤ 50 ms |
| ZIP | ≤ 50 ms |
| PNG 40 compases | ≤ 800 ms |
| PDF 100 compases | ≤ 2 s (incluye carga de jsPDF en caché) |

Construcción de strings con arreglos y `join('')` (no concatenación en bucle de cadenas grandes).

---

## 22. Testing scenarios

### 22.1 Dorados contra legacy

| ID | Función | Comparación |
|---|---|---|
| G-FMT-01 | toMusicXML | 18 instrumentos × fixtures; igual salvo D1 (`<harmony>`), D2 (relleno del último compás), D3 (negativos) |
| G-FMT-02 | toMidi | Bytes idénticos para los mismos fixtures |
| G-FMT-03 | parseMidi | Mismo `notes`, `tempo`, `meter`, `key` sobre `tests/fixtures/files/*.mid` sin running status tras meta |
| G-FMT-04 | parseMusicXML | Mismo resultado en archivos simples (1 voz, sin anacrusa ni acordes) |

Los dorados de `parseMusicXML` se generan en Node con `@xmldom/xmldom` como `DomParserLike` (MIT, solo
devDependency).

### 22.2 Unit

| ID | Escenario | Esperado |
|---|---|---|
| T-MXE-01 | Tabla 4.3 completa | `<transpose>` exacto |
| T-MXE-02 | Valida contra XSD MusicXML 3.1 con `xmllint` (fixtures × instrumentos) | 0 errores |
| T-MXE-03 | Orden de elementos de `<note>` | Según XSD (cubierto por 02) |
| T-MXE-04 | Partitura vacía | `<rest measure="yes"/>` |
| T-MXE-05 | X30 último compás | Suma = bar |
| T-MXE-06 | X31, X32 harmony | XML esperado |
| T-MXE-07 | Escapado `& < > "` | Correcto |
| T-HAR-01 | Parse de "Do", "Rem", "Fa♯7", "Si♭m7", "Soldim", "Lab" | step/alter/kind correctos |
| T-MID-01 | Cabecera, tempo, compás 6/8 (`dd = 3`), armadura −3 (`0xFD`) | Bytes esperados |
| T-MID-02 | Silencios acumulados | Delta correcto |
| T-MID-03 | Título con acentos | UTF-8 |
| T-MID-04 | Partitura vacía | Válido, sin notas |
| T-MID-05 | Ida y vuelta `toMidi → parseMidi` para todos los fixtures | Notas iguales |
| T-MID-06 | X16 running status tras meta | Notas correctas |
| T-MID-07 | X15, X17, X18, X19, X20, X21 | Según tabla |
| T-MID-08 | SMPTE, cabecera falsa, archivo truncado | Mensajes 13.1 |
| T-MXI-01 | X1-X9 | Según tabla |
| T-MXI-02 | 12.1 validaciones | Mensajes exactos |
| T-MXI-03 | Ida y vuelta `toMusicXML → parseMusicXML` 18 instrumentos | Mismas notas (sonido real), key, meter, tempo |
| T-MXI-04 | guessInstrument tabla 12.7 | Todos |
| T-TXT-01 | decodeText UTF-8, UTF-8 BOM, UTF-16LE, UTF-16BE, ISO-8859-1 | Texto con "Canción" correcto |
| T-ABC-I-01 | X22-X25 | Según tabla |
| T-ABC-I-02 | Tresillos de corchea en 4/4 | Total del compás = 16, warning |
| T-ABC-I-03 | Cambio de `K:` a mitad | Alteraciones correctas después |
| T-MONO-01 | Eventos solapados y acordes | Reglas 12.4 |
| T-FN-01 | Nombres de archivo X26, X27, ♭/♯ | Según 7.2 |

### 22.3 Servicios y UI

| ID | Escenario | Esperado |
|---|---|---|
| T-IMP-01 | Detección por extensión y por contenido (11.1, 11.2) | Formato correcto |
| T-IMP-02 | Límites de tamaño (18) | Mensajes exactos |
| T-IMP-03 | .mxl zip bomb (fixture generado en el test) | Error sin consumir memoria (filtro de fflate) |
| T-IMP-04 | Import exitoso llama `prepareReplace` y luego `replaceScore` | Orden |
| T-IMP-05 | Warnings se muestran y se cierran al editar | Sí |
| T-EXP-01 | ZIP contiene 4 archivos con nombres correctos y LEEME con CRLF | Sí |
| T-EXP-02 | PNG no vacío, ancho ≈ (svg + 60) × 2.5 | Sí |
| T-EXP-03 | PDF de 300 compases → > 1 página (jsPDF real en jsdom con canvas mock) | Sí |
| T-EXP-04 | Botón Compartir oculto sin `navigator.canShare` | Sí |
| T-EXP-05 | Cancelar compartir no muestra error | Sí |
| T-EXP-06 | Copiar ABC con clipboard fallido → abre details | Sí |
| T-LNK-01 | Enlaces con la consulta codificada y `rel=noopener noreferrer` | Sí |

### 22.4 E2E

| ID | Flujo |
|---|---|
| E2E-FM-01 | Abrir `tests/fixtures/files/himno.musicxml` → 62 notas, título correcto |
| E2E-FM-02 | Abrir un .mxl exportado por MuseScore 4 → abre |
| E2E-FM-03 | Abrir MIDI multipista → melodía, tempo correcto |
| E2E-FM-04 | Pegar ABC de abcnotation con repeticiones → abre + aviso |
| E2E-FM-05 | Exportar ZIP, descomprimir en el test, abrir el MusicXML con el propio importador → mismas notas |
| E2E-FM-06 | Exportar PDF → archivo descargado > 10 KB, empieza con `%PDF` |
| E2E-FM-07 | Exportar imagen → overlay con imagen visible |

### 22.5 Verificación manual con MuseScore Studio (gratis)

Antes de cerrar la épica, abrir en MuseScore Studio 4 el MusicXML de: piano, clarinete, saxofón alto, saxofón
tenor, guitarra (con tablatura), corno y (si se aprueba) flauta dulce. Criterios: sin avisos de archivo dañado,
"Concert pitch" muestra la altura real correcta, los cifrados aparecen como acordes. Registrar resultado en
`docs/development/current/`.

---

## 23. Quality Gates

| Métrica | Umbral |
|---|---|
| Cobertura `core/formats` | ≥ 95 % líneas, ≥ 90 % ramas |
| Cobertura `modules/import`, `modules/export` | ≥ 80 % |
| Validación XSD | 100 % de exportaciones de fixtures |
| Dorados | 100 % salvo excepciones registradas |
| Complejidad por función | ≤ 10 (lectores divididos por tipo de elemento/evento) |
| Bundle | fflate y jsPDF fuera del chunk inicial |

---

## 24. Trazabilidad

| Historia | Criterio | Sección | Tests |
|---|---|---|---|
| US-F01 | Abrir MusicXML/MIDI, melodía principal, aviso de acordes | 12, 13, 17 | T-MXI-*, T-MID-07, E2E-FM-01..03 |
| US-F01 | Anacrusa no desplaza barras | 12.5 | T-MXI-01 (X3) |
| US-F01 | Aviso de cambios de tempo/compás | 13.2, 17 | T-MID-07 (X18) |
| US-F02 | Pegar ABC | 14, 16.3 | T-ABC-I-*, E2E-FM-04 |
| US-F03 | PDF con nombre del instrumento | 7.2, 9 | T-FN-01, T-EXP-03, E2E-FM-06 |
| US-F04 | ZIP para MuseScore, abre sin advertencias | 4, 7 | T-MXE-02, T-EXP-01, 22.5 |
| US-F05 | Imagen para WhatsApp | 8, 10.2 | T-EXP-02/04/05, E2E-FM-07 |
| US-F06 | Enlaces a sitios | 16.2 | T-LNK-01 |

---

## 25. Diferencias intencionales con legacy

| # | Legacy | Nuevo | Motivo |
|---|---|---|---|
| D1 | Cifrados no se exportan a MusicXML | `<harmony>` | Se perdían los acordes de "De oído" al pasar a MuseScore (verificado) |
| D2 | Último compás incompleto | Completado con silencio | Compás irregular en otros programas (verificado: 10/16) |
| D3 | `<transpose>` sin octava para transposición negativa | Fórmula general 4.3 | Necesario para flauta dulce (verificado) |
| D4 | Ignora `<backup>`/`<forward>` y anacrusa | Cursor de tiempo + relleno | Deuda 2 |
| D5 | Acorde MusicXML: primera nota | Más aguda | Deuda 3 |
| D6 | Running status roto tras meta | Running separado | Deuda 9 / robustez |
| D7 | Sin avisos de cambios de tempo/compás, tresillos, repeticiones | Warnings | Deuda 9 |
| D8 | `file.text()` (UTF-8 fijo) | `decodeText` | Archivos UTF-16 / Latin-1 |
| D9 | JSZip | fflate | Tamaño y protección contra zip bombs |
| D10 | Descarga vía capacidad del artifact | `<a download>` + Web Share | Fuera de Claude |
| D11 | Bloque "Pedir la melodía a Claude" | Eliminado | R1 |
| D12 | PDF sin metadatos | Título/autor | Calidad |

---

## 26. Preguntas abiertas

| ID | Pregunta | Propuesta por defecto |
|---|---|---|
| Q1 | ¿Agregar la flauta dulce? (afecta 4.3 y 12.7) | Pendiente del usuario; la spec ya lo soporta |
| Q2 | ¿Emitir `<accidental>` explícito en MusicXML? | No (los programas lo calculan) |
| Q3 | ¿Pista de acordes en el MIDI? | No en el MVP |
| Q4 | ¿PDF en A4 o Carta? | Carta (legacy); considerar A4 por defecto según idioma del navegador `es-*` excepto `es-MX`/`es-US` |
| Q5 | MIDI: ¿elegir la pista con más notas o la más aguda? | Más notas (legacy) + permitir elegir pista post-MVP |
| Q6 | ¿Parsear MusicXML grandes en Worker? | No en el MVP; medir |
| Q7 | Varias partes en MusicXML: ¿selector de parte al abrir? | Should post-MVP; MVP abre la primera con aviso |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Spec Writer
