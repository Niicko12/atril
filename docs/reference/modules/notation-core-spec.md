---
name: atril-notation-core-spec
status: in-progress
created: 2026-10-18T12:35:48Z
updated: 2026-10-18T12:35:48Z
---

# Spec: Módulo `notation-core` (+ `score-view`)

**Estado:** 🟡 Lista para revisión
**Features:** F02 (instrumentos, transposición, rango, tablatura), F03 (vistas, nombres de notas), base de F04-F06
**Historias:** US-I01 … US-I06, soporte de US-W01, US-P01, US-F03, US-F05
**Referencia de comportamiento:** `legacy/index.html` líneas 380-520 (núcleo musical: catálogo, teoría,
compases, `buildAbc`) y 767-826 (render con abcjs, mapa de elementos, estado)
**Ubicación del código:** `src/core/theory`, `src/core/instruments`, `src/core/rhythm`, `src/core/notation`
(puros) y `src/modules/score-view` (React + abcjs)

---

## Índice

1. Alcance y responsabilidades
2. Code Structure
3. Catálogo de instrumentos
4. Tonalidades
5. Ortografía de notas (`spell`)
6. Nombres de notas
7. Transposición y vistas
8. Claves
9. Compases y división en medidas
10. Generación de ABC (`buildAbc`)
11. Mapa carácter → nota
12. `score-view`: dibujo con abcjs
13. Resaltados: selección, fuera de rango, reproducción
14. Tablatura
15. Barra de estado
16. Validaciones y reglas
17. Edge cases
18. Errores
19. Accesibilidad
20. Performance
21. Testing scenarios
22. Quality Gates
23. Trazabilidad
24. Diferencias intencionales con legacy
25. Preguntas abiertas

---

## 1. Alcance y responsabilidades

### 1.1 Qué hace

| Pieza | Responsabilidad |
|---|---|
| `core/instruments` | Catálogo de instrumentos (rango, transposición, clave, timbre, cuerdas, tablatura) y elección de clave |
| `core/theory` | Armaduras, ortografía (Do♯ vs Re♭), nombres en solfeo, nombres de tonalidades |
| `core/rhythm` | Compases soportados, división de notas en medidas con ligaduras |
| `core/notation` | Construcción del texto ABC que dibuja abcjs y del mapa carácter → índice de nota |
| `modules/score-view` | Dibujar la partitura, convertir clics en selección, aplicar resaltados, barra de estado |

### 1.2 Qué no hace

| No hace | Lo hace |
|---|---|
| Modificar la partitura | `editor` |
| MusicXML / MIDI | `formats` (usa `spell`, `toMeasures`, `clefFor` de este módulo) |
| Sonido | `playback` |
| Imagen / PDF | `export` (reutiliza `buildAbc` y las opciones de render de 12.3) |

### 1.3 Invariante central

> Las notas se guardan **siempre en sonido real**. La altura escrita se calcula solo al mostrar o exportar:
> `escrita = real + instrument.transpose`.

---

## 2. Code Structure

### 2.1 Archivos

```
src/core/
├── instruments/
│   ├── catalog.ts            # INSTRUMENTS (tabla, size-exception ≤ 300)     
│   ├── clef.ts               # clefFor
│   ├── lookup.ts             # getInstrument, isTransposing, displayName
│   └── index.ts
├── theory/
│   ├── keys.ts               # MAJOR_NAMES, MINOR_NAMES, ABC_KEYS, keyAccidentals, normalizeFifths, writtenFifths
│   ├── spelling.ts           # spell, abcPitch
│   ├── names.ts              # SOLFEGE, noteName, midiName, keyName
│   └── index.ts
├── rhythm/
│   ├── meters.ts             # METERS, meterOf
│   ├── measures.ts           # splitDuration, toMeasures
│   └── index.ts
└── notation/
    ├── abc-escape.ts         # escapeAbcText, escapeAnnotation
    ├── abc-header.ts         # buildHeader
    ├── abc-body.ts           # buildBody (medidas → tokens)
    ├── abc-builder.ts        # buildAbc (orquesta)
    └── index.ts

src/modules/score-view/
├── components/
│   ├── score-sheet.tsx       # contenedor .paper + abcjs                      (≤ 150)
│   ├── score-status.tsx      # barra de estado                                (≤ 100)
│   └── empty-hint.tsx        # "Toca el teclado de abajo…"                    (≤ 30)
├── hooks/
│   ├── use-abc-render.ts     # render programado por rAF + ResizeObserver     (≤ 100)
│   ├── use-note-elements.ts  # índice → elementos SVG                         (≤ 80)
│   └── use-highlights.ts     # clases sel / oor / play                        (≤ 80)
├── render-options.ts         # opciones de abcjs compartidas con export        (≤ 80)
├── strings.ts
└── index.ts
```

### 2.2 API pública

```typescript
// core/instruments
export { INSTRUMENTS, getInstrument, isTransposing, displayName, clefFor } from './...';
// core/theory
export { spell, abcPitch, noteName, midiName, keyName, keyAccidentals, normalizeFifths, writtenFifths,
         MAJOR_NAMES, MINOR_NAMES } from './...';
// core/rhythm
export { METERS, meterOf, splitDuration, toMeasures } from './...';
// core/notation
export { buildAbc } from './abc-builder';
// modules/score-view
export { ScoreSheet, ScoreStatus } from './components/...';
export { scoreRenderOptions } from './render-options';
```

### 2.3 Reglas

- `core/*` sin DOM, sin React, sin `Math.random`.
- `abcjs` solo se importa en `modules/score-view` y `modules/export` (y en `core/formats/abc-import` **solo como
  tipo**; el parseo lo hace `modules/import` y pasa el árbol).
- Funciones de `core` con tipos de retorno explícitos y parámetros `readonly`.

---

## 3. Catálogo de instrumentos

### 3.1 Tabla (portada de `INSTR` de legacy)

| id | Nombre visible | transpose | clave | low | high | timbre | GM | tab | cuerdas (aguda→grave) | nota |
|---|---|---|---|---|---|---|---|---|---|---|
| piano | Piano | 0 | auto | 21 | 108 | piano | 0 | — | — | — |
| voz | Voz | 0 | auto | 48 | 81 | voice | 52 | — | — | — |
| guitarra | Guitarra | 12 | treble | 40 | 88 | guitar | 24 | guitar | 64 59 55 50 45 40 | Escrita una octava arriba de como suena |
| bajo | Bajo eléctrico | 12 | bass | 28 | 67 | bass | 33 | bass | 43 38 33 28 | Escrito una octava arriba de como suena |
| ukulele | Ukulele | 0 | treble | 60 | 81 | guitar | 24 | — | 69 64 60 67 | — |
| violin | Violín | 0 | treble | 55 | 100 | bow | 40 | — | 76 69 62 55 | — |
| viola | Viola | 0 | alto | 48 | 88 | bow | 41 | — | 69 62 55 48 | — |
| cello | Violonchelo | 0 | bass | 36 | 81 | bow | 42 | — | 57 50 43 36 | — |
| contrabajo | Contrabajo | 12 | bass | 28 | 67 | bow | 43 | — | 43 38 33 28 | Escrito una octava arriba de como suena |
| flauta | Flauta | 0 | treble | 60 | 96 | flute | 73 | — | — | — |
| oboe | Oboe | 0 | treble | 58 | 91 | reed | 68 | — | — | — |
| clarinete | Clarinete en Si♭ | 2 | treble | 50 | 91 | reed | 71 | — | — | — |
| saxalto | Saxofón alto en Mi♭ | 9 | treble | 49 | 81 | reed | 65 | — | — | — |
| saxtenor | Saxofón tenor en Si♭ | 14 | treble | 44 | 76 | reed | 66 | — | — | — |
| trompeta | Trompeta en Si♭ | 2 | treble | 54 | 82 | brass | 56 | — | — | — |
| corno | Corno en Fa | 7 | treble | 34 | 77 | brass | 60 | — | — | — |
| trombon | Trombón | 0 | bass | 40 | 72 | brass | 57 | — | — | — |
| tuba | Tuba | 0 | bass | 28 | 58 | brass | 58 | — | — | — |

- `low`/`high` en **sonido real** (MIDI).
- `GM` es el programa General MIDI base 0 (MusicXML usa base 1: `gm + 1`).
- El orden de la tabla es el orden del selector.

### 3.2 Candidato pendiente de aprobación (US-I06, *Should*)

| id | Nombre | transpose | clave | low | high | timbre | GM | nota |
|---|---|---|---|---|---|---|---|---|
| flautadulce | Flauta dulce soprano | **−12** | treble | 72 | 98 | flute | 74 | Suena una octava arriba de como se escribe |

Es el **primer instrumento con transposición negativa**. Impacto revisado:
- `buildAbc`, `spell`, `writtenFifths`: funcionan con negativos (`normF(key + 7·(−12)) = key`).
- `toMusicXML` de legacy calcula `<transpose>` con `t % 12` y `octave-change` solo si `t ≥ 12` → con −12 **no
  emitiría la octava**. La spec de `formats` debe generalizar a negativos (registrado como requisito F-X1).
- El aviso "Escrita una octava arriba…" usa el texto de la columna `nota`.

> Se agrega al catálogo solo si el usuario lo aprueba. La spec y los tests se escriben para que agregar la fila no
> requiera tocar código.

### 3.3 Tipo y funciones

```typescript
export const INSTRUMENTS: readonly Instrument[];          // tabla 3.1, `as const satisfies`
export function getInstrument(id: string): Instrument;    // id desconocido → INSTRUMENTS[0] (piano)
export function isTransposing(i: Instrument): boolean;    // transpose !== 0
export function displayName(i: Instrument): string;       // para nombres de archivo: ♭→b, ♯→#
```

`displayName("Clarinete en Si♭")` → `"Clarinete en Sib"` (legacy `fname`).

---

## 4. Tonalidades

### 4.1 Tablas

Índice = `fifths + 7` (de −7 a 7). La app usa −6..6 en el selector; −7 y 7 existen solo por completitud de las
tablas (legacy las incluye).

| fifths | Mayor | Menor relativa | ABC |
|---|---|---|---|
| −7 | Do♭ | La♭ | Cb |
| −6 | Sol♭ | Mi♭ | Gb |
| −5 | Re♭ | Si♭ | Db |
| −4 | La♭ | Fa | Ab |
| −3 | Mi♭ | Do | Eb |
| −2 | Si♭ | Sol | Bb |
| −1 | Fa | Re | F |
| 0 | Do | La | C |
| 1 | Sol | Mi | G |
| 2 | Re | Si | D |
| 3 | La | Fa♯ | A |
| 4 | Mi | Do♯ | E |
| 5 | Si | Sol♯ | B |
| 6 | Fa♯ | Re♯ | F# |
| 7 | Do♯ | La♯ | C# |

Texto del selector: `"{Mayor} mayor / {Menor} menor"`, p. ej. "Mi♭ mayor / Do menor".

### 4.2 `keyAccidentals(fifths)`

Devuelve la alteración de cada letra según la armadura:
- Sostenidos en orden F C G D A E B (los primeros `fifths`).
- Bemoles en orden B E A D G C F (los primeros `−fifths`).

### 4.3 `normalizeFifths(f)`

```
v = ((f mod 12) + 12) mod 12
si v > 6: v −= 12
return v      # rango −5..6
```

Consecuencia (legacy, se conserva): **−6 se normaliza a 6** (Sol♭ → Fa♯). Solo se aplica al **calcular**
armaduras (transposición, mover todo); el valor que el usuario elige en el selector (−6) se respeta tal cual en
sonido real.

### 4.4 `writtenFifths(key, transpose)`

`normalizeFifths(key + 7·transpose)`. Ejemplos:

| Sonido real | Instrumento | transpose | Escrita |
|---|---|---|---|
| Do (0) | Clarinete Si♭ | 2 | Re (2) |
| Mi♭ (−3) | Clarinete Si♭ | 2 | Fa (−1) |
| Do (0) | Saxofón alto | 9 | La (3) |
| Fa (−1) | Corno | 7 | Do (0) |
| Re (2) | Saxofón tenor | 14 | Mi (4) |
| Sol (1) | Guitarra | 12 | Sol (1) |
| Sol♭ (−6) | Trompeta | 2 | La♭ (−4) |

### 4.5 `keyName(fifths)`

`MAJOR_NAMES[fifths + 7] + ' mayor'`. Se usa en el estado ("Tonalidad escrita: La mayor") y en la pista de
Do-Re-Mi.

> El modo (mayor/menor) no se guarda; la armadura es la misma. La tonalidad menor se muestra solo como ayuda en el
> selector.

---

## 5. Ortografía de notas (`spell`)

### 5.1 Contrato

```typescript
export function spell(midi: Midi, fifths: number): Spelling;  // { letter, alter: −1|0|1, octave }
```

Decide si una altura se escribe, por ejemplo, Do♯ o Re♭ según la armadura.

### 5.2 Algoritmo (portado de legacy, no cambiar)

```
pc = midi mod 12 (positivo)
ka = keyAccidentals(fifths)
best = null; bestScore = 9
para L en C D E F G A B (en ese orden):
    a = ((pc − NAT[L] + 6) mod 12 + 12) mod 12 − 6      # alteración necesaria en −6..5
    si |a| > 1: continuar
    score =
        0 si a == ka[L]                     # coincide con la armadura
        1 si a == 0                         # natural (con becuadro si la armadura altera)
        2 si a == (fifths ≥ 0 ? +1 : −1)    # alteración del mismo tipo que la armadura
        3 en otro caso
    si score < bestScore: best = {L, a}; bestScore = score
best.octave = floor((midi − best.a) / 12) − 1
```

- Empates: gana la primera letra en orden C…B.
- Nunca produce dobles alteraciones (el tipo admite ±2 para el futuro; `ACC` del ABC las soporta).
- La octava se calcula sobre la nota natural: Si♯3 = MIDI 60 (letra B, octava 3); Do♭5 = MIDI 71 (letra C,
  octava 5).

### 5.3 Ejemplos verificados contra legacy (2026-10-18)

| MIDI | fifths | Resultado | Por qué |
|---|---|---|---|
| 61 | 0 (Do) | Do♯4 | Sostenido preferido en armaduras ≥ 0 |
| 70 | −1 (Fa) | Si♭4 | Coincide con la armadura |
| 65 | 6 (Fa♯) | Mi♯4 | Mi♯ coincide con la armadura; Fa sería becuadro |
| 71 | −6 (Sol♭) | Do♭5 | Do♭ coincide con la armadura |
| 66 | −1 (Fa) | Sol♭4 | Bemol preferido en armaduras < 0 |

### 5.4 `abcPitch(letter, octave)`

| Octava | Resultado | Ejemplo |
|---|---|---|
| ≥ 5 | minúscula + `'` × (octava − 5) | Do5 → `c`, Do6 → `c'` |
| 4 | mayúscula | Do4 → `C` |
| ≤ 3 | mayúscula + `,` × (4 − octava) | Do3 → `C,`, Mi2 → `E,,` |

---

## 6. Nombres de notas

### 6.1 Solfeo

`SOLFEGE = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' }`

### 6.2 Funciones

```typescript
export function noteName(s: Spelling): string;           // "Fa♯", "Si♭", "Do"
export function midiName(midi: Midi, fifths = 0): string; // "Fa♯4"
```

- `♯` U+266F y `♭` U+266D (no `#` ni `b`) en toda la UI.
- Octava científica: Do4 = Do central (MIDI 60).

### 6.3 Uso

| Lugar | Función | Armadura usada |
|---|---|---|
| Nombres debajo de las notas (`showNames`) | `noteName(spell(escrita, fifthsVista))` | La de la vista |
| Etiquetas del piano | `"Do" + octava` en los Do | — |
| `aria-label` del piano | `midiName(m)` | Do (0) |
| Diapasón | `noteName(spell(m, key))` | Sonido real |
| Barra de estado (selección) | `midiName(p, key)` | Sonido real |
| Rango fuera de rango | `midiName(low)–midiName(high)` | Do (0) |

---

## 7. Transposición y vistas

### 7.1 Definiciones

| Vista | transpose usado | Armadura | Cuándo existe |
|---|---|---|---|
| `written` ("Para el instrumento") | `instrument.transpose` | `writtenFifths(key, transpose)` | Siempre |
| `concert` ("Sonido real") | 0 | `key` | Solo si `isTransposing(instrument)` |

Si el instrumento no transpone, `written` y `concert` son idénticas y la UI solo ofrece la primera.

### 7.2 Altura mostrada

`mostrada = p + (vista == written ? instrument.transpose : 0)`

### 7.3 Nombre de la parte (segundo `T:` del ABC)

| Caso | Texto |
|---|---|
| `written`, instrumento con `nota` | `"{nombre} · {nota en minúscula}"`, p. ej. "Guitarra · escrita una octava arriba de como suena" |
| `written`, sin `nota` | `"{nombre}"` |
| `concert`, instrumento transpositor | `"{nombre} · sonido real"` |

### 7.4 Rango

El rango se evalúa siempre en **sonido real** contra `low`/`high`, independiente de la vista.

---

## 8. Claves

### 8.1 `clefFor(instrument, notes, transpose)`

```
si instrument.clef != 'auto': return instrument.clef
alturas = notas con p != null, mapeadas a p + transpose
promedio = alturas vacías ? 60 : media(alturas)
return promedio < 57 ? 'bass' : 'treble'
```

- Solo Piano y Voz usan `auto`.
- 57 = La3. La clave se recalcula en cada render (puede cambiar mientras el usuario escribe notas graves).
- Viola usa `alto` (clave de Do en 3.ª).

### 8.2 Decisión pendiente

El cambio automático de clave mientras se escribe puede desorientar (Q1).

---

## 9. Compases y división en medidas

### 9.1 Compases soportados

| id | bar (semicorcheas) | beat (agrupación) | ABC `M:` |
|---|---|---|---|
| 4/4 | 16 | 4 | `C` |
| 3/4 | 12 | 4 | `3/4` |
| 2/4 | 8 | 4 | `2/4` |
| 6/8 | 12 | 6 | `6/8` |
| 3/8 | 6 | 6 | `3/8` |
| 12/8 | 24 | 6 | `12/8` |

`meterOf(id)` con un id desconocido devuelve 4/4.

### 9.2 `splitDuration(units)`

Descompone en valores escribibles, de mayor a menor: 16, 12, 8, 6, 4, 3, 2, 1.

| Entrada | Salida |
|---|---|
| 16 | [16] |
| 10 | [8, 2] |
| 7 | [6, 1] |
| 5 | [4, 1] |
| 24 | [16, 8] |

### 9.3 `toMeasures(notes, meter)`

Recorre las notas acumulando posición. Si una nota no cabe en lo que queda del compás, se parte: lo que cabe va en
el compás actual (descompuesto con `splitDuration`) y el resto sigue en los siguientes. Todos los fragmentos de una
misma nota quedan **ligados** entre sí.

```
out = []; cur = []; pos = 0
para cada (n, idx):
    rem = n.d; first = true
    mientras rem > 0:
        take = min(rem, bar − pos)
        partes = splitDuration(take)
        para cada (p, k) en partes:
            last = (rem − take == 0) y k == último
            cur.push({idx, p: n.p, d: p, first, last, pos})
            first = false; pos += p
            si pos ≥ bar: out.push(cur); cur = []; pos = 0
        rem −= take
si cur no vacío: out.push(cur)
```

- `first` / `last` indican si el fragmento es el primero / último de la nota original. Para notas con tono, un
  fragmento con `last = false` lleva ligadura hacia el siguiente.
- Los silencios también se parten, pero nunca se ligan.
- El último compás puede quedar incompleto (no se rellena con silencios).
- **Anacrusa:** no soportada en el MVP (ver technical-decisions 18, deuda 2: el importador rellena con silencio).

### 9.4 Ejemplo

4/4, notas `[{60,12}, {61,8}]`:

| Compás | Fragmentos |
|---|---|
| 1 | Do4 12 (first, last) · Do♯4 4 (first, ¬last) |
| 2 | Do♯4 4 (¬first, last) |

---

## 10. Generación de ABC (`buildAbc`)

### 10.1 Contrato

```typescript
export function buildAbc(
  score: Pick<Score, 'title' | 'composer' | 'key' | 'meter' | 'tempo' | 'notes'>,
  instrument: Instrument,
  view: View,
  opts?: AbcBuildOptions,          // { names?: boolean; chords?: boolean (default true) }
): AbcBuildResult;                  // { abc, charMap, fifths, transpose }
```

### 10.2 Encabezado

```
X:1
T:{título escapado o "Sin título"}
T:{nombre de la parte (7.3)}
C:{compositor escapado}            ← solo si hay compositor
M:{C | 3/4 | ...}
L:1/16
Q:1/4={tempo o 100}
K:{ABC_KEYS[fifths + 7]} clef={treble|bass|alto}
```

### 10.3 Partitura vacía

Cuerpo = `x{bar}|]` (silencio invisible de un compás completo), para que se dibuje un pentagrama vacío.

### 10.4 Cuerpo

Por cada compás de `toMeasures`:

1. `estado = {}`: alteraciones vigentes en el compás, por clave `letra+octava`.
2. Por cada fragmento:
   1. Si `pos mod beat == 0` y el cuerpo no está vacío → espacio (separa grupos de corcheas).
   2. `inicio = longitud(encabezado + cuerpo)` → `charMap.set(inicio, idx)`.
   3. **Prefijo** (solo en el primer fragmento):
      - Cifrado: si `opts.chords !== false` y la nota tiene `c` → `"^{c sin comillas}"`.
      - Nombre: si `opts.names` y es nota con tono → `"_{noteName}"`.
   4. **Nota:**
      - `sp = spell(p + transpose, fifths)`.
      - `vigente = estado[letra+oct] ?? armadura[letra]`.
      - Si `sp.alter != vigente` → emitir alteración (`^^ ^ = _ __`) y `estado[k] = sp.alter`.
        **Cambio respecto a legacy (D1):** esto se evalúa en **todos** los fragmentos, no solo en el primero. Así la
        continuación ligada al otro lado de la barra lleva la alteración, y abcjs (y la tablatura) le asignan la
        altura correcta.
      - `abcPitch` + duración (omitida si es 1) + `-` si `last == false`.
   5. **Silencio:** `z` + duración (omitida si es 1).
   6. Si hubo prefijo → `charMap.set(inicio + longitud(prefijo), idx)` (abcjs reporta el `startChar` de la nota
      sin la anotación).
3. Al final del compás: `|`.

Cierre: se reemplaza el último `|` por `|]`.

### 10.5 Escapado (`abc-escape.ts`)

| Campo | Regla |
|---|---|
| Título, compositor | Reemplazar `\r` `\n` por espacio; **eliminar `%`** (comentario en ABC, D2); recortar a 120 |
| Cifrado (`c`) | Eliminar `"`; recortar a 12 |
| Nombre de la parte | Generado internamente; no requiere escape |

### 10.6 Ejemplo verificado (legacy, 2026-10-18)

Entrada: título "A%B", Mi♭ mayor (−3), 6/8, ♩=90, Clarinete en Si♭, `[{63,6}, {64,2,c:'Do'}, {66,16}]`,
`names: true`.

Legacy produce:

```
X:1
T:A%B
T:Clarinete en Si♭
M:6/8
L:1/16
Q:1/4=90
K:F clef=treble
"_Fa"F6 "^Do""_Sol♭"_G2"_La♭"_A4-| A12|]
```

Problemas que corrige esta spec:
- `T:A%B` → abcjs muestra solo "A" → nuevo: `T:AB` (D2).
- `_A4-| A12` → la continuación se lee como La natural → nuevo: `_A4-| _A12` (D1).

### 10.7 Valores de retorno

| Campo | Significado |
|---|---|
| `abc` | Texto completo |
| `charMap` | `Map<posición de carácter, índice de nota>` |
| `fifths` | Armadura usada |
| `transpose` | Semitonos aplicados |

---

## 11. Mapa carácter → nota

### 11.1 Para qué sirve

abcjs entrega, para cada elemento dibujado, `startChar` (posición en el texto ABC). El `charMap` traduce esa
posición al índice de la nota en `Score.notes`. Así:
- Un clic en la partitura selecciona la nota correcta.
- Las clases de resaltado se aplican a los elementos SVG de cada nota.

### 11.2 Reglas

- Cada fragmento registra su posición de inicio. Una nota partida en 3 fragmentos tiene 3 entradas.
- Con prefijo, también se registra la posición tras el prefijo.
- Las barras, espacios y encabezado no tienen entrada (clic ahí → deseleccionar).

### 11.3 Construcción de `noteElements` (score-view)

```
noteElements: Element[][] = []
para cada línea de visual.lines, staff[0].voices[0]:
    para cada el con el_type == 'note':
        idx = charMap.get(el.startChar); si no hay: continuar
        noteElements[idx].push(...el.abselem.elemset)
```

Una nota ligada tiene los elementos de todos sus fragmentos → se resalta completa.

---

## 12. `score-view`: dibujo con abcjs

### 12.1 Componente `ScoreSheet`

```
<section class="sheet">
  <div class="paper">               ← fondo --paper siempre claro, sombra, padding 14/12/10
    <div ref={target} />            ← abcjs dibuja aquí
  </div>
  <EmptyHint visible={notes.length == 0} />
</section>
```

### 12.2 Ciclo de render (`use-abc-render`)

```
entradas: abc (memo de buildAbc), opciones (memo), ancho
efecto:
    cancelar rAF pendiente
    rAF → t0 = performance.now()
          visual = ABCJS.renderAbc(target, abc, opciones)[0]
          si falla con tablatura → reintentar sin tablatura
          si vuelve a fallar → mostrar "No se pudo dibujar la partitura." y salir
          noteElements = construir(visual, charMap)
          performance.measure('abc-render', t0)
          aplicar resaltados (13)
```

- `ResizeObserver` sobre `.paper`: nuevo render solo si el ancho cambia más de 20 px.
- Si el render tarda > 50 ms con más de 400 notas, los renders siguientes se programan con `requestIdleCallback`
  (fallback `setTimeout(…, 0)`) y se muestra "Dibujando…" en el estado.

### 12.3 Opciones (`render-options.ts`, compartidas con `export`)

| Opción | Pantalla | Exportación (imagen/PDF) |
|---|---|---|
| `staffwidth` | `max(260, anchoPaper − 30)` | 740 |
| `paddingleft` / `paddingright` | 0 / 0 | 10 / 10 |
| `paddingtop` | 4 | default |
| `wrap.minSpacing` | 1.5 | 1.6 |
| `wrap.maxSpacing` | 2.6 | 2.6 |
| `wrap.preferredMeasuresPerLine` | < 480 px: 2 · < 720 px: 3 · resto: 4 | 4 |
| `foregroundColor` | `#16181a` | `#000000` |
| `selectionColor` | `#b3123e` | — |
| `add_classes` | `true` | — |
| `clickListener` | sí | — |
| `tablature` | según 14 | según 14 |

### 12.4 Clic en la partitura

```
clickListener(abcelem):
    idx = charMap.get(abcelem.startChar)
    setTimeout(0):            ← abcjs aplica su propia selección después del callback
        editor.select(idx ?? −1)   (select alterna si es la misma)
```

---

## 13. Resaltados

| Clase | Significado | Color (token) | Prioridad |
|---|---|---|---|
| `.oor` | Nota fuera del rango del instrumento | `--oor` (#c25400) | Baja |
| `.sel` | Nota seleccionada | `--mark` (#b3123e) | Media (quita `.oor` de esa nota) |
| `.play` | Nota que suena en la reproducción | `--mark` | Alta (no requiere render) |

Reglas:
- `.oor` y `.sel` se aplican tras cada render.
- `.play` lo aplica `use-highlights` al cambiar el índice de `usePlaybackPositionStore`: quita la clase del índice
  anterior y la pone en el nuevo, sin volver a dibujar.
- CSS: `#score .sel, #score .sel * { fill: var(--mark) !important; stroke: var(--mark); }` y equivalentes (legacy).

---

## 14. Tablatura

### 14.1 Cuándo se muestra

`score.showTab && instrument.tab && vistaEfectiva == 'written'`

En "Sonido real" no se muestra (la tablatura se calcula desde la altura escrita).

### 14.2 Configuración de abcjs

| `instrument.tab` | Opción |
|---|---|
| `guitar` | `[{ instrument: 'guitar', label: 'TAB' }]` (afinación estándar de abcjs: `E, A, D G B e`) |
| `bass` | `[{ instrument: 'guitar', label: 'TAB', tuning: ['E,,', 'A,,', 'D,', 'G,'] }]` |

Verificación de octavas: la guitarra se escribe una octava arriba (Mi2 real → Mi3 escrito = `E,`), que coincide con
la cuerda grave de la afinación de abcjs. El bajo se escribe una octava arriba (Mi1 real → Mi2 escrito = `E,,`).
✅ coherente.

### 14.3 Fallo

Si abcjs lanza al dibujar la tablatura, se dibuja sin ella y el estado muestra "No se pudo dibujar la tablatura".

### 14.4 Dependencia de D1

La tablatura asigna traste según la altura que abcjs interpreta. Sin la corrección D1 (10.4), una nota ligada con
alteración al otro lado de la barra recibe un traste equivocado. El test T-TAB-03 cubre este caso.

---

## 15. Barra de estado (`ScoreStatus`)

Elementos, en orden, separados visualmente (`aria-live="polite"`):

| Elemento | Condición | Texto |
|---|---|---|
| Conteo | Siempre | "N notas · M compases" (M = `ceil(totalUnits / bar)`) |
| Tonalidad escrita | Instrumento transpositor | "Tonalidad escrita: La mayor" |
| Fuera de rango | ≥ 1 nota | "N nota(s) fuera del rango de saxofón alto en mi♭ (Re♭3–La5)" en color `--oor` |
| Selección | Hay selección | "Nota i+1 seleccionada (Mi4) · toca otra nota para cambiarla" (o "(silencio)") en color de acento |
| Dibujo diferido | Render lento | "Dibujando…" |
| Error de tablatura | 14.3 | "No se pudo dibujar la tablatura" |

- El nombre del instrumento va en minúscula (legacy).
- "1 nota fuera" / "N notas fuera" (singular/plural).

---

## 16. Validaciones y reglas

| ID | Regla |
|---|---|
| N1 | `getInstrument` nunca devuelve `undefined` (piano por defecto) |
| N2 | `spell` siempre devuelve alteración en −1..1 |
| N3 | `buildAbc` nunca lanza con una partitura válida (`validateScore`); con notas vacías devuelve compás vacío |
| N4 | Toda nota con tono fuera de 0..127 tras transponer se recorta a 0..127 solo para el ABC (no se modifica la partitura). Con el catálogo actual el máximo posible es 108 + 14 = 122 ✅ |
| N5 | El `charMap` contiene al menos una entrada por nota de la partitura |
| N6 | El texto ABC es determinista: la misma entrada produce exactamente el mismo texto |

---

## 17. Edge cases

| # | Caso | Esperado |
|---|---|---|
| C1 | Partitura vacía | Pentagrama de un compás vacío, sin `charMap` |
| C2 | Una sola nota de 48 semicorcheas en 4/4 | Tres redondas ligadas en 3 compases |
| C3 | Nota de 5 en 3/8 empezando en pos 4 | 2 en el compás actual + 3 en el siguiente, ligadas |
| C4 | Silencio de 20 en 4/4 | Redonda + negra de silencio, sin ligadura |
| C5 | Do♯ ligado sobre la barra | `^C4-|^C4` (D1) |
| C6 | Mismo Fa♯ dos veces en un compás de Do mayor | Solo el primero lleva `^` |
| C7 | Fa♯ y luego Fa natural en el mismo compás | Segundo lleva `=` |
| C8 | Fa♯4 y Fa♯5 en el mismo compás | Ambos llevan `^` (estado por letra+octava, como la notación tradicional en ABC) |
| C9 | Tonalidad Sol♭ (−6) + trompeta | Escrita La♭ (−4) |
| C10 | Tonalidad Do + saxofón tenor, nota Do4 | Escrita Re5 (60 + 14 = 74) |
| C11 | Piano con promedio de alturas 56,9 | Clave de Fa |
| C12 | Piano sin notas | Clave de Sol (promedio 60) |
| C13 | Título vacío | `T:Sin título` |
| C14 | Título "Canción\n2" | `T:Canción 2` |
| C15 | Cifrado `Do"m` | `"^Dom"` |
| C16 | `names` activado con silencios | Silencios sin nombre |
| C17 | Nombres + cifrado en la misma nota | Primero `"^cifrado"`, luego `"_nombre"` (orden de legacy) |
| C18 | Vista `concert` con instrumento no transpositor | Igual que `written` (el editor no lo permite, pero `buildAbc` lo tolera) |
| C19 | Clic sobre una barra de compás | Deselecciona |
| C20 | Clic sobre la continuación ligada de una nota | Selecciona la nota original |
| C21 | Ancho de pantalla 320 px | `staffwidth` 260 mínimo, 2 compases por línea |
| C22 | Cambio de 4/4 a 6/8 | Agrupación de corcheas de 3 (beat 6) |
| C23 | Tablatura activa y cambio a vista "Sonido real" | Desaparece la tablatura; la casilla sigue marcada |
| C24 | 3 000 notas | Render diferido + "Dibujando…" si supera 50 ms |

---

## 18. Errores

| Situación | Manejo |
|---|---|
| abcjs no cargó (no debería pasar: va empaquetado) | Mensaje "No se pudo cargar el motor de partituras. Recarga la página." |
| `renderAbc` lanza con tablatura | Reintento sin tablatura + aviso en estado |
| `renderAbc` lanza sin tablatura | "No se pudo dibujar la partitura." + error al diagnóstico con el ABC |
| `charMap` sin entrada para un `startChar` | Ignorar (clic deselecciona) |

---

## 19. Accesibilidad

- El SVG de abcjs recibe `role="img"` y `aria-label` con un resumen: "Partitura: {título}, {instrumento},
  {N} compases".
- La lista de notas para lectores de pantalla está en una región oculta visualmente (`.sr-only`) con las notas como
  texto ("Compás 1: Mi4 negra, Mi4 negra, Fa4 negra, Sol4 negra"), actualizada con debounce de 1 s. Nuevo respecto a
  legacy.
- Colores `.sel`, `.oor`, `.play` con contraste ≥ 3:1 sobre `--paper`.
- La barra de estado es `aria-live="polite"`.

---

## 20. Performance

| Operación | Objetivo | Notas |
|---|---|---|
| `buildAbc` 200 notas | ≤ 2 ms | Puro, memoizado |
| `buildAbc` 3 000 notas | ≤ 20 ms | |
| `renderAbc` 200 notas (móvil referencia) | ≤ 40 ms | Parte del objetivo global de 50 ms |
| Construir `noteElements` | ≤ 5 ms | |
| Aplicar `.play` | ≤ 1 ms por cambio | Solo toggles de clase |
| `spell` | ≤ 1 µs | Llamada por fragmento |

Memoización: `buildAbc` se memoiza por `(notes, title, composer, key, meter, tempo, instrumentId, view, showNames)`.

---

## 21. Testing scenarios

### 21.1 Tests dorados contra legacy

Para cada combinación de: 18 instrumentos × 2 vistas × entradas de `tests/fixtures/scores/*.json` (ejemplos +
casos C1-C17), se compara la salida de `buildAbc` (`abc` y `charMap`) con la de legacy.

Diferencias permitidas, registradas en `tests/fixtures/golden/EXCEPTIONS.md`:
- D1: alteración en continuaciones ligadas.
- D2: `%` eliminado del título.
- Cualquier fila nueva del catálogo (flauta dulce) no tiene dorado.

### 21.2 Unit

| ID | Función | Escenario | Esperado |
|---|---|---|---|
| T-KEY-01 | keyAccidentals | 2 | F y C sostenidos |
| T-KEY-02 | keyAccidentals | −3 | B, E, A bemoles |
| T-KEY-03 | normalizeFifths | −6, 6, 7, −7, 13 | 6, 6, −5, 5, 1 |
| T-KEY-04 | writtenFifths | Tabla 4.4 | Todos |
| T-KEY-05 | keyName | −3 | "Mi♭ mayor" |
| T-SPL-01 | spell | Tabla 5.3 | Todos |
| T-SPL-02 | spell | 12 clases × 13 armaduras | Igual que legacy (dorado) |
| T-SPL-03 | spell | MIDI 60 en Do♯ mayor (7) | Si♯3 |
| T-SPL-04 | abcPitch | Do2…Do7 | `C,, C, C c c' c''` |
| T-NAM-01 | midiName | 61, 0 | "Do♯4" |
| T-NAM-02 | noteName | usa ♯/♭ Unicode | sí |
| T-INS-01 | getInstrument | "xyz" | piano |
| T-INS-02 | displayName | "Saxofón alto en Mi♭" | "Saxofón alto en Mib" |
| T-INS-03 | catálogo | 18 filas, ids únicos, low < high, cuerdas dentro del rango | sí |
| T-CLF-01 | clefFor | C11, C12, viola, tuba | bass, treble, alto, bass |
| T-MEA-01 | splitDuration | Tabla 9.2 | Todos |
| T-MEA-02 | toMeasures | Ejemplo 9.4 | Igual |
| T-MEA-03 | toMeasures | C2, C3, C4 | Igual |
| T-MEA-04 | toMeasures | Suma de duraciones por compás ≤ bar | Propiedad (fast-check) |
| T-MEA-05 | toMeasures | Suma total de fragmentos = suma de notas | Propiedad |
| T-ABC-01 | buildAbc | C1 | `x16|]` |
| T-ABC-02 | buildAbc | C5 (D1) | `^C4-|^C4` |
| T-ABC-03 | buildAbc | C6, C7, C8 | Alteraciones correctas |
| T-ABC-04 | buildAbc | C13, C14, C15, D2 | Escapado |
| T-ABC-05 | buildAbc | C16, C17 | Orden de anotaciones |
| T-ABC-06 | buildAbc | Ejemplo 10.6 corregido | Texto esperado exacto |
| T-ABC-07 | buildAbc | N6 determinismo | Dos llamadas iguales |
| T-ABC-08 | buildAbc | N5 charMap | Cada índice aparece |
| T-ABC-09 | buildAbc | 6/8: espacio cada 6 semicorcheas | Sí |
| T-ABC-10 | buildAbc | Parte con `nota` y vista concert | Textos 7.3 |
| T-ABC-11 | buildAbc | abcjs `parseOnly` del resultado no reporta warnings | Para todos los fixtures |

### 21.3 score-view (jsdom + abcjs real)

| ID | Escenario | Esperado |
|---|---|---|
| T-SV-01 | Render de 8 notas | 8 entradas en `noteElements` |
| T-SV-02 | Nota ligada | `noteElements[i]` contiene elementos de ambos fragmentos |
| T-SV-03 | Clic simulado en la 3.ª nota | `select(2)` |
| T-SV-04 | Clic en la misma nota | `select(2)` → editor alterna |
| T-SV-05 | Nota fuera de rango | clase `oor` |
| T-SV-06 | Seleccionada fuera de rango | `sel` sin `oor` |
| T-SV-07 | Cambio de índice de reproducción | `play` se mueve sin nuevo render (espía en `renderAbc`) |
| T-SV-08 | Resize de 18 px | sin render; de 25 px | render |
| T-SV-09 | Error simulado con tablatura | render sin tablatura + aviso |
| T-TAB-01 | Guitarra + tab + written | opción `tablature` presente |
| T-TAB-02 | Guitarra + tab + concert | sin tablatura |
| T-TAB-03 | Do♯ ligado sobre la barra con tablatura | ambos fragmentos con el mismo traste |
| T-STA-01 | Estado con saxofón alto, 2 notas fuera de rango y selección | Los 4 elementos con textos exactos |
| T-STA-02 | Singular "1 nota fuera" | Sí |

### 21.4 E2E

| ID | Flujo |
|---|---|
| E2E-NC-01 | Himno de la alegría en Clarinete: armadura Re mayor visible y estado "Tonalidad escrita: Re mayor" |
| E2E-NC-02 | Activar "Nombres de notas": aparecen nombres en solfeo bajo cada nota |
| E2E-NC-03 | Guitarra + Tablatura: aparece la línea TAB con 6 cuerdas |
| E2E-NC-04 | "Sonido real" con saxofón tenor: la armadura vuelve a Do |
| E2E-NC-05 | Captura visual (screenshot) de 3 partituras fijas comparada con la referencia (tolerancia 0,1 %) |

---

## 22. Quality Gates

| Métrica | Umbral |
|---|---|
| Cobertura `core/theory`, `core/rhythm`, `core/notation` | ≥ 95 % líneas, ≥ 90 % ramas |
| Cobertura `core/instruments` | 100 % |
| Cobertura `score-view` | ≥ 80 % |
| Dorados contra legacy | 100 % iguales salvo excepciones registradas |
| Complejidad por función | ≤ 8 (`buildBody` dividido en `emitPrefix`, `emitPitch`, `emitRest`) |
| `buildAbc` 3 000 notas | ≤ 20 ms en CI (Node) |

---

## 23. Trazabilidad

| Historia | Sección | Tests |
|---|---|---|
| US-I01 Parte escrita para saxofón alto | 4.4, 7, 15 | T-KEY-04, T-STA-01, E2E-NC-01 |
| US-I02 Alternar vistas | 7.1 | T-ABC-10, E2E-NC-04 |
| US-I03 Fuera de rango | 7.4, 13, 15 | T-SV-05/06, T-STA-01 |
| US-I04 Tablatura | 14 | T-TAB-*, E2E-NC-03 |
| US-I05 Nombres de notas | 6, 10.4 | T-ABC-05, E2E-NC-02 |
| US-I06 Flauta dulce (pendiente) | 3.2 | T-INS-03 (al agregar) |
| US-W05 Seleccionar tocando la partitura | 11, 12.4 | T-SV-03/04 |
| US-P01 Ver qué nota suena | 13 | T-SV-07 |

---

## 24. Diferencias intencionales con legacy

| # | Legacy | Nuevo | Motivo |
|---|---|---|---|
| D1 | Alteración solo en el primer fragmento de una nota ligada | En todos los fragmentos cuando difiere de la vigente | La continuación tras la barra se leía como natural; tablatura con traste equivocado |
| D2 | `%` en el título rompe el ABC | Se elimina | `%` es comentario en ABC |
| D3 | Sin resumen accesible de la partitura | `aria-label` + lista oculta de notas | Accesibilidad |
| D4 | Render síncrono en cada cambio | rAF + diferido para partituras largas | Performance |

> Nota sobre D1: en notación tradicional impresa, la continuación ligada no repite la alteración. Se prefiere la
> claridad para el público objetivo (aficionados) y la corrección de la tablatura. Si se quisiera el estilo
> tradicional, la alternativa es emitir la alteración solo cuando hay tablatura (Q2).

---

## 25. Preguntas abiertas

| ID | Pregunta | Propuesta por defecto |
|---|---|---|
| Q1 | ¿Fijar la clave del piano/voz al primer cálculo en vez de recalcularla con cada nota? | Mantener recálculo (legacy) en el MVP |
| Q2 | D1: ¿alteración en continuación ligada siempre o solo con tablatura? | Siempre |
| Q3 | ¿Agregar la flauta dulce (3.2)? | Pendiente de aprobación del usuario |
| Q4 | ¿Mostrar el nombre de la tonalidad menor si la pieza está en menor (detección)? | No en el MVP |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Spec Writer
