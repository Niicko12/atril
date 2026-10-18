---
name: atril-editor-spec
status: in-progress
created: 2026-10-18T12:29:49Z
updated: 2026-10-18T12:51:10Z
---

# Spec: Módulo `editor`

**Estado:** 🟡 Lista para revisión
**Features:** F01 (editor monofónico), F10 (deshacer/rehacer), F15 (aviso de recorte), parte de F11 (preferencia de
modo de entrada)
**Historias:** US-W01 … US-W09
**Referencia de comportamiento:** `legacy/index.html` líneas 733-875 (estado y edición), 1051-1184 (herramientas,
superficies de entrada, teclado), 1186-1223 (formulario), 1268-1274 (Nueva)
**Depende de:** `core/score`, `core/theory`, `core/instruments`, `core/rhythm`, módulo `playback`

---

## Índice

1. Alcance y responsabilidades
2. Code Structure del módulo
3. Modelo de estado
4. Acciones del store (contrato exacto)
5. Funciones puras de `core/score/score-ops.ts`
6. Historial: deshacer y rehacer
7. Máquina de estados de selección
8. Superficies de entrada
   - 8.1 Piano
   - 8.2 Diapasón
   - 8.3 Do-Re-Mi
   - 8.4 Teclado de computadora
9. Herramientas de duración
10. Formulario de metadatos y barra de vista
11. Nueva partitura y reemplazo
12. Integraciones con otros módulos
13. Validaciones y reglas de negocio
14. Edge cases
15. Manejo de errores y mensajes
16. Accesibilidad
17. Performance
18. Textos (strings.ts)
19. Testing scenarios
20. Quality Gates del módulo
21. Criterios de aceptación (trazabilidad)
22. Diferencias intencionales con legacy
23. Preguntas abiertas

---

## 1. Alcance y responsabilidades

### 1.1 Qué hace el módulo

El módulo `editor` es dueño de **la partitura en edición** y de **todas las formas de modificarla**:

| Responsabilidad | Descripción |
|---|---|
| Estado de la partitura | `Score` actual, selección, cursor de duración, vista, historial |
| Superficies de entrada | Piano, diapasón, botones Do-Re-Mi, teclado de computadora |
| Herramientas | Duraciones (redonda … semicorchea), puntillo, silencio, deshacer, rehacer, borrar, reproducir |
| Operaciones globales | Mover todo (±½ tono, ±8ª), octava de la última nota |
| Metadatos | Título, compositor, instrumento, tonalidad, compás, tempo, nombres, tablatura |
| Vista | "Para el instrumento" / "Sonido real" |
| Ciclo de vida | Nueva partitura, reemplazo desde import/ear/library |

### 1.2 Qué NO hace

| No hace | Lo hace |
|---|---|
| Dibujar el pentagrama | `score-view` |
| Generar ABC, MusicXML, MIDI | `core/notation`, `core/formats` |
| Sintetizar sonido | `playback` |
| Guardar en IndexedDB | `library` (se suscribe al store) |
| Leer archivos | `import` |
| Analizar audio | `ear` |

### 1.3 Principio de diseño

> **Un toque = una nota.** Ninguna acción frecuente debe requerir abrir un menú. La duración elegida se mantiene
> hasta que el usuario la cambie.

---

## 2. Code Structure del módulo

### 2.1 Archivos

```
src/modules/editor/
├── components/
│   ├── input-dock.tsx            # dock fijo inferior: tools + modebar + superficie activa      (≤ 150)
│   ├── duration-tools.tsx        # play, duraciones, puntillo, silencio, deshacer, rehacer, borrar (≤ 150)
│   ├── piano-keyboard.tsx        # teclado C2–C6                                                (≤ 150)
│   ├── fretboard.tsx             # diapasón 15 trastes                                          (≤ 150)
│   ├── name-buttons.tsx          # Do-Re-Mi + ♭♮♯ + 8↓8↑                                         (≤ 150)
│   ├── mode-switch.tsx           # Piano / Diapasón / Do Re Mi + pista                          (≤ 80)
│   ├── score-meta-form.tsx       # título, compositor, instrumento, tonalidad, compás, tempo     (≤ 180)
│   └── view-bar.tsx              # vista, nombres, tablatura, mover todo                        (≤ 150)
├── hooks/
│   ├── use-note-input.ts         # enter(midi, el): preview + flash + addNote                   (≤ 60)
│   ├── use-keyboard-shortcuts.ts # atajos globales                                              (≤ 100)
│   └── use-armed-button.ts       # confirmación por segundo toque                              (≤ 40)
├── store/
│   ├── score.store.ts            # Zustand: estado + acciones                                   (≤ 250)
│   ├── history.ts                # push/undo/redo/agrupación                                    (≤ 120)
│   └── selectors.ts              # selectores memoizados                                        (≤ 80)
├── strings.ts                    # textos en español                                            (≤ 120)
├── types.ts                      # tipos propios del módulo                                     (≤ 80)
└── index.ts                      # API pública
```

Total: 17 archivos de código → **supera el límite de 15** del documento de arquitectura (9.3). Resolución:
`types.ts` y `strings.ts` no cuentan como archivos de lógica según la regla de `scripts/check-module-size.mjs`
(se excluyen `strings.ts`, `types.ts`, `index.ts`). Lógica: 14 archivos ✅.

Las funciones puras viven fuera del módulo, en `src/core/score/score-ops.ts` (sección 5).

### 2.2 API pública (`index.ts`)

```typescript
export { InputDock } from './components/input-dock';
export { ScoreMetaForm } from './components/score-meta-form';
export { ViewBar } from './components/view-bar';
export { useScoreStore } from './store/score.store';
export {
  selectNotes, selectMeta, selectInstrument, selectSelection,
  selectView, selectCursor, selectCanUndo, selectCanRedo,
} from './store/selectors';
export { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
export type { ShiftReport, Cursor, EditorMode } from './types';
```

Nada más se importa desde fuera del módulo.

### 2.3 Dependencias permitidas

| Desde `editor` hacia | Permitido |
|---|---|
| `core/*` | ✅ |
| `modules/playback` (index) | ✅ preview, stopAll |
| `shared/*` | ✅ |
| `modules/score-view` | ✅ solo `import type` |
| `modules/library`, `ear`, `import`, `export`, `auth` | ❌ (ellos dependen de editor, no al revés) |
| `infra/*` | ❌ excepto `infra/idb` para la preferencia de modo (vía `usePrefsStore` en shared) |

---

## 3. Modelo de estado

### 3.1 Tipos del módulo (`types.ts`)

```typescript
import type { Units16, Midi } from '@/core/types/units';
import type { Note, ScoreMeta } from '@/core/types/score';

export type EditorMode = 'piano' | 'fret' | 'names';

export type BaseDuration = 16 | 8 | 4 | 2 | 1;   // redonda, blanca, negra, corchea, semicorchea

export interface Cursor {
  base: BaseDuration;
  dot: boolean;
}

export interface Snapshot {
  notes: Note[];
  meta: ScoreMeta;
}

export interface ShiftReport {
  /** Notas que quedaron en MIDI_MIN o MIDI_MAX por el recorte. */
  clipped: number;
}

/** Alteración pendiente para la próxima nota en modo Do-Re-Mi (null = la de la armadura). */
export type PendingAccidental = -1 | 0 | 1 | null;
```

### 3.2 Estado del store

```typescript
interface ScoreState {
  score: Score;               // ver technical-decisions 8.2
  selection: number;          // −1 = ninguna; 0..notes.length−1
  lastIndex: number;          // última nota escrita o modificada (para 8↑/8↓); −1 si ninguna
  cursor: Cursor;             // duración actual; inicial {base: 4, dot: false}
  view: View;                 // 'written' | 'concert'; inicial 'written'
  pendingAccidental: PendingAccidental;
  keyboardOctave: number;     // 2..6, inicial 4 (teclado de computadora)
  past: Snapshot[];           // ≤ 200
  future: Snapshot[];         // se vacía en cada cambio nuevo
  dirty: boolean;             // cambios desde la última carga o guardado
  revision: number;           // contador monotónico; sube en cada cambio de notes/meta
  loadedRevision: number;     // revision al cargar la partitura (replaceScore); library no guarda si revision == loadedRevision
}
```

`revision` permite a `library` y `score-view` suscribirse a "hubo un cambio" sin comparar arreglos.

### 3.3 Estado inicial

1. `library/draft.service` intenta leer el borrador de IndexedDB **antes** de montar la app.
2. Si hay borrador válido (`validateScore` ok) → `score = borrador`.
3. Si no → `score = fromSample(SAMPLES[0], defaultInstrument)` ("Himno de la alegría", como legacy).
4. `selection = −1`, `lastIndex = −1`, `cursor = {base: 4, dot: false}`, `view = 'written'`, historial vacío,
   `dirty = false`, `revision = 0`.

El modo de entrada (`EditorMode`) **no** vive en este store: vive en `usePrefsStore` (persistido, inicial
`'piano'`), guardado en `prefs.inputMode` de IndexedDB.

### 3.4 Derivados (selectores)

| Selector | Definición |
|---|---|
| `selectInstrument` | `INSTRUMENTS.find(i => i.id === score.instrumentId) ?? INSTRUMENTS[0]` |
| `selectCursorUnits` | `cursor.dot && cursor.base > 1 ? cursor.base * 1.5 : cursor.base` |
| `selectIsTransposing` | `instrument.transpose !== 0` |
| `selectEffectiveView` | `isTransposing ? view : 'written'` |
| `selectCanUndo` | `past.length > 0` |
| `selectCanRedo` | `future.length > 0` |
| `selectNoteCount` | `score.notes.length` |
| `selectMeasureCount` | `ceil(sum(d) / meter.bar)` |
| `selectOutOfRange` | índices con `p != null && (p < instrument.low || p > instrument.high)` |
| `selectWrittenKeyName` | `MAJ[normF(key + 7·transpose) + 7] + ' mayor'` |

Todos memoizados por referencia de entrada (`score.notes`, `score.instrumentId`, `score.key`…).

---

## 4. Acciones del store (contrato exacto)

Convenciones:
- **[H]** = la acción crea un snapshot en el historial antes de cambiar (sección 6).
- **[S]** = detiene la reproducción (`playback.stopAll()`) antes de cambiar.
- **[R]** = incrementa `revision` y pone `dirty = true`.
- Toda acción que no cambia nada (p. ej. borrar con la partitura vacía) **no** crea snapshot ni incrementa
  `revision`.

### 4.1 `addNote(midi: Midi | null): void` — [H][S][R]

Agrega o reemplaza una nota. `null` = silencio.

```
si notes.length >= MAX_NOTES y selection < 0:
    toast(LIMITE_NOTAS); return
si selection >= 0:
    notes[selection].p = midi            # la duración NO cambia
    lastIndex = selection
    selection = selection + 1 < notes.length ? selection + 1 : −1
si no:
    notes.push({ p: midi, d: cursorUnits })
    lastIndex = notes.length − 1
pendingAccidental = null
```

- El cifrado `c` de la nota reemplazada se conserva.
- Reemplazar con el mismo tono que ya tenía igualmente crea snapshot (es una acción del usuario; consistente con
  legacy y simple de explicar).

### 4.2 `deleteNote(): void` — [H][S][R]

```
si notes.length == 0: return (sin efecto)
si selection >= 0:
    notes.splice(selection, 1)
    selection = min(selection, notes.length − 1)     # puede quedar −1 si se vació
si no:
    notes.pop()
lastIndex = −1
```

### 4.3 `setDuration(base: BaseDuration): void` — [H si hay selección][R si hay selección]

```
cursor.base = base
si base == 1: cursor.dot = false
si selection >= 0:
    notes[selection].d = cursorUnits
```

Sin selección solo cambia el cursor (no entra al historial, no marca `dirty`).

### 4.4 `toggleDot(): void` — igual que 4.3 en historial

```
si cursor.base == 1: return
cursor.dot = !cursor.dot
si selection >= 0: notes[selection].d = cursorUnits
```

### 4.5 `select(index: number): void` — sin historial

```
si index fuera de [0, notes.length) o index == selection: selection = −1
si no: selection = index
```

Efecto lateral (en el componente, no en el store): si la nota seleccionada tiene tono, `playback.preview(p)`.

### 4.6 `moveSelection(direction: -1 | 1): void` — sin historial

| Estado | ← (−1) | → (+1) |
|---|---|---|
| `selection = −1` | `notes.length − 1` (o −1 si vacía) | sin cambio |
| `selection = i` | `max(0, i − 1)` | `i + 1 < length ? i + 1 : −1` |

### 4.7 `clearSelection(): void` — sin historial

`selection = −1`.

### 4.8 `octaveLast(direction: 1 | -1): void` — [H][R]

```
i = selection >= 0 ? selection
  : (0 <= lastIndex < length ? lastIndex : length − 1)
n = notes[i]
si !n o n.p == null: return
destino = n.p + 12·direction
si destino fuera de [MIDI_MIN, MIDI_MAX]: sin cambio, sin snapshot, toast(LIMITE_RANGO); return
   # no se recorta: recortar cambiaría la nota (p. ej. Sol♯7 → Do8), no la octava
n.p = destino
lastIndex = i
```

Efecto lateral: `playback.preview(n.p)`.

### 4.9 `shiftAll(semitones: number): ShiftReport` — [H][S][R]

`semitones ∈ {−12, −1, +1, +12}`.

```
si notes.length == 0: return {clipped: 0}
clipped = 0
para cada nota con p != null:
    target = p + semitones
    nuevo = clamp(target, MIDI_MIN, MIDI_MAX)
    si nuevo != target: clipped++
    p = nuevo
si |semitones| != 12:
    key = normF(key + 7·semitones)
return {clipped}
```

El componente muestra (F15, corrige deuda 7):
- `clipped == 0`: sin mensaje.
- `clipped > 0`: toast "N notas quedaron en el límite del rango (La0–Do8)" + botón "Deshacer".

### 4.10 `setMeta(patch: Partial<ScoreMeta>): void` — [H agrupado][R]

Aplica cambios a metadatos con validación (sección 13). Reglas de historial:

| Campo | Historial |
|---|---|
| `title`, `composer` | Agrupado: un snapshot por ráfaga (sin cambios del mismo campo en 1 000 ms) |
| `instrumentId`, `key`, `meter`, `tempo` | Un snapshot por cambio |
| `showNames`, `showTab` | Un snapshot por cambio |

Efectos de `instrumentId`:
- Si el nuevo instrumento no transpone → `view = 'written'`.
- Si `showTab` es `true` y el nuevo instrumento no tiene `tab` → se mantiene `showTab` (se ignora al dibujar) para
  que vuelva a aparecer si se regresa a guitarra.
- Si el modo de entrada es `fret`, el diapasón se reconstruye con las cuerdas del nuevo instrumento (componente).

Efectos de `key`: si el modo es `fret` o `names`, se reconstruye la superficie (nombres de notas cambian).

### 4.11 `setView(view: View): void` — sin historial

Si el instrumento no transpone, ignora y deja `'written'`.

### 4.12 `setPendingAccidental(acc: PendingAccidental): void` — sin historial

Si `acc === pendingAccidental` → `null` (alternar). Si no → `acc`.

### 4.13 `setKeyboardOctave(direction: 1 | -1): number` — sin historial

`keyboardOctave = clamp(keyboardOctave + direction, 2, 6)`; devuelve el valor para el toast "Octava N".

### 4.14 `undo(): void` / `redo(): void` — [S]

Ver sección 6. Si no hay pasos: toast "Nada que deshacer" / "Nada que rehacer".

### 4.15 `replaceScore(next: Score, opts?: { keepHistory?: boolean }): void` — [S]

Reemplaza la partitura completa (import, ear, library, Nueva, ejemplo).

```
validateScore(next)  → si falla lanza AppError('internal')
score = next
selection = −1; lastIndex = −1; view = 'written'; pendingAccidental = null
si !keepHistory: past = []; future = []
dirty = false; revision++; loadedRevision = revision
```

- `keepHistory: true` lo usa solo "Reajustar ritmo al tempo" (ear), que además hace push manual de snapshot para
  poder deshacer el reajuste.
- Antes de llamar a `replaceScore`, `library.prepareReplace()` fuerza el guardado pendiente de la partitura actual
  (sección 11).

### 4.16 `markSaved(savedAt: string): void` — sin historial

Lo llama `library` tras el guardado automático: `score.savedAt = savedAt; dirty = false`. No incrementa
`revision`.

### 4.17 `replaceNotesKeepingMeta(notes: Note[]): void` — [H][S][R]

Para "Reajustar ritmo al tempo": sustituye las notas, conserva metadatos, `selection = −1`.

---

## 5. Funciones puras de `core/score/score-ops.ts`

Todas reciben y devuelven datos inmutables. El store las llama y aplica el resultado.

```typescript
export function cursorUnits(c: Cursor): Units16;
export function insertOrReplace(notes: readonly Note[], sel: number, midi: Midi | null, units: Units16):
  { notes: Note[]; selection: number; lastIndex: number };
export function removeAt(notes: readonly Note[], sel: number):
  { notes: Note[]; selection: number };
export function setDurationAt(notes: readonly Note[], index: number, units: Units16): Note[];
export function shiftNotes(notes: readonly Note[], semitones: number):
  { notes: Note[]; clipped: number };
export function shiftKey(key: Fifths, semitones: number): Fifths;   // normF(key + 7·s); |s|==12 → key
export function octaveAt(notes: readonly Note[], index: number, dir: 1 | -1):
  { notes: Note[]; changed: boolean };
export function nearestMidiForLetter(args: {
  letter: Letter; alter: Alter; reference: Midi;
}): Midi;
export function referencePitch(notes: readonly Note[], selection: number): Midi;
export function totalUnits(notes: readonly Note[]): number;
export function measureCount(notes: readonly Note[], meter: Meter): number;
export function outOfRangeIndices(notes: readonly Note[], low: Midi, high: Midi): number[];
```

### 5.1 `nearestMidiForLetter` (portado de `nearest()` de legacy)

```
best = null
para o en 1..7:
    m = (o + 1)·12 + NAT[letter] + alter
    si best == null o |m − reference| < |best − reference|: best = m
return best
```

- En empate gana la octava **más grave** (la primera encontrada), igual que legacy.
- `alter` = alteración pendiente si existe; si no, la de la armadura (`keyAcc(key)[letter]`).

### 5.2 `referencePitch`

```
si selection >= 0 y notes[selection].p != null: return notes[selection].p
última = última nota con p != null (recorriendo desde el final)
return última?.p ?? 60
```

### 5.3 Inmutabilidad

Prohibido mutar `notes[i]` en sitio. Cada operación copia el arreglo y la nota modificada
(`notes.map((n, i) => i === index ? { ...n, p } : n)`). Las demás notas conservan referencia (útil para
memoización).

---

## 6. Historial: deshacer y rehacer

### 6.1 Estructura

```typescript
interface History {
  past: Snapshot[];     // más reciente al final
  future: Snapshot[];   // más reciente al final
  group: { field: 'title' | 'composer'; until: number } | null;
}
const HISTORY_LIMIT = 200;
const GROUP_WINDOW_MS = 1000;
```

### 6.2 Algoritmo

```
pushSnapshot(state, groupField?):
    ahora = Date.now()
    si groupField y group?.field == groupField y ahora < group.until:
        group.until = ahora + GROUP_WINDOW_MS        # extiende la ráfaga, no crea snapshot
        return
    past.push({ notes: state.score.notes, meta: metaOf(state.score) })
    si past.length > HISTORY_LIMIT: past.shift()
    future = []
    group = groupField ? { field: groupField, until: ahora + GROUP_WINDOW_MS } : null

undo():
    si past vacío: toast; return
    future.push(snapshot actual)
    aplicar past.pop()
    selection = selection < notes.length ? selection : −1
    group = null; revision++; dirty = true

redo(): simétrico
```

- Como las notas son inmutables, el snapshot guarda **referencias**, no copias JSON (legacy hacía
  `JSON.stringify` en cada paso). Memoria aproximada: 200 × (arreglo de punteros) — despreciable.
- Cualquier acción [H] distinta de la ráfaga en curso cierra el grupo.

### 6.3 Qué entra y qué no

| Entra al historial | No entra |
|---|---|
| Notas (agregar, reemplazar, borrar, duración, puntillo con selección, octava, mover todo, reajustar ritmo) | Selección, cursor sin selección, vista |
| Título, compositor (agrupado), instrumento, tonalidad, compás, tempo, nombres, tablatura | Modo de entrada, octava del teclado de computadora |
| | Alteración pendiente |
| | `replaceScore` (limpia el historial) |

### 6.4 Interacción con el guardado automático

Deshacer y rehacer marcan `dirty`; el guardado automático de `library` guarda el estado resultante. No se sincroniza el
historial (vive solo en memoria y se pierde al recargar; ver pregunta abierta Q2).

---

## 7. Máquina de estados de selección

### 7.1 Estados

| Estado | Condición | Indicador visual |
|---|---|---|
| **Añadiendo** | `selection = −1` | Ninguna nota resaltada; status sin "seleccionada" |
| **Seleccionada(i)** | `0 ≤ selection < length` | Nota i en color `--mark`; status "Nota i+1 seleccionada (Mi4) · toca otra nota para cambiarla" |

### 7.2 Transiciones

```
                         select(i) / tocar nota i en la partitura / ←
  ┌──────────────┐ ───────────────────────────────────────────────► ┌──────────────────┐
  │  Añadiendo   │                                                  │ Seleccionada(i)  │
  │ (sel = −1)   │ ◄─────────────────────────────────────────────── │                  │
  └──────┬───────┘   Esc · select(i) otra vez · → en la última      └───┬──────────┬───┘
         │           · addNote en la última · replaceScore              │          │
         │           · deleteNote que vacía la partitura                │          │
         │ addNote(m)                                       addNote(m)  │          │ ← / →
         ▼                                                  (no última) ▼          ▼
   push nota al final                                    Seleccionada(i+1)   Seleccionada(i∓1)
   (sigue Añadiendo)
```

### 7.3 Tabla completa evento × estado

| Evento | Añadiendo | Seleccionada(i), i < last | Seleccionada(last) |
|---|---|---|---|
| Tecla de nota m | push {m, cursor} | p[i]=m → Sel(i+1) | p[i]=m → Añadiendo |
| Silencio | push {null, cursor} | p[i]=null → Sel(i+1) | p[i]=null → Añadiendo |
| Duración / puntillo | cursor | cursor + d[i] | cursor + d[i] |
| Borrar | pop | splice(i) → Sel(i) | splice(i) → Sel(i−1) o Añadiendo si vacía |
| ← | Sel(last) | Sel(max(0,i−1)) | Sel(last−1) |
| → | — | Sel(i+1) | Añadiendo |
| ↑ / ↓ | octava de lastIndex o última | octava de i | octava de i |
| Esc | — | Añadiendo | Añadiendo |
| Tocar nota j en partitura | Sel(j) | j==i ? Añadiendo : Sel(j) | ídem |
| Reproducir | desde 0 | desde i | desde i |
| Deshacer / rehacer | — | Sel(i) si i < length, si no Añadiendo | ídem |
| `replaceScore` | Añadiendo | Añadiendo | Añadiendo |

---

## 8. Superficies de entrada

Todas comparten `useNoteInput().enter(midi, element?)`:

```
enter(midi, el):
    playback.unlock()          # idempotente; necesario en iOS
    playback.preview(midi, instrument.timbre)
    flash(el, 170 ms)          # clase .down
    store.addNote(midi)
```

- Evento: `pointerdown` (no `click`), delegado en el contenedor.
- `contextmenu` bloqueado en el contenedor (pulsación larga en móvil).
- `-webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation` en las teclas.
- La superficie activa la determina `EditorMode`, persistido en `usePrefsStore`.

### 8.1 Piano (`piano-keyboard.tsx`)

| Parámetro | Valor | Legacy |
|---|---|---|
| Rango | MIDI 36 (Do2) – 84 (Do6), 49 teclas | Igual |
| Ancho tecla blanca | **40 px** | 36 px (cambio: objetivo táctil ≥ 40 px, análisis competitivo 11.1) |
| Alto tecla blanca | 112 px | Igual |
| Tecla negra | 26 × 68 px, centrada en el borde (left = índiceBlanca·40 − 13) | 24 × 68, −12 |
| Etiquetas | "Do2", "Do3"… solo en los Do, en negrita | Igual |
| Scroll inicial | Centrado en Do4: `scrollLeft = 14·40 − max(0, (ancho − 14·40)/2)` | Igual con 36 |
| `aria-label` por tecla | `midiName(m)` en armadura de Do, p. ej. "Do♯4" | Igual |

Comportamiento:
- El contenedor tiene `overflow-x: auto` con desplazamiento suave por inercia.
- Una tecla presionada muestra `--key-w-down` / `--key-b-down` durante 170 ms.
- **Multitáctil:** cada `pointerdown` es una nota; dos dedos casi simultáneos producen dos notas en el orden de los
  eventos (monofonía: no se crea acorde).
- No hay sonido sostenido mientras se mantiene el dedo (la duración la define el cursor).

Pista en la barra de modo: "Desliza para ver más octavas".

### 8.2 Diapasón (`fretboard.tsx`)

| Parámetro | Valor |
|---|---|
| Trastes | 0 (al aire) … 15 |
| Marcas | 3, 5, 7, 9, 12, 15 (número en color de acento) |
| Cuerdas | `instrument.strings` (aguda arriba); si el instrumento no tiene cuerdas → las de la guitarra |
| Columnas | 34 px (nombre de cuerda, fija al hacer scroll) · 46 px (al aire) · 15 × 48 px |
| Alto de fila | 24 px (revisar ≥ 40 px táctil: ver Q1) |
| Grosor de cuerda | `1 + índice·0.45` px (las graves más gruesas) |
| Texto en cada posición | `nameOf(spell(m, key))` |
| `aria-label` | "Cuerda N, traste F: Mi4" |

Pista en la barra de modo:
- Con cuerdas propias: "Afinación de violín" (nombre del instrumento en minúscula).
- Sin cuerdas propias: "Afinación de guitarra".
- Para violín, viola, violonchelo y contrabajo la cabecera de números dice **"Posición"** en lugar de mostrar
  trastes como si fuera guitarra (cambio menor de legacy, ver technical-decisions 18).

Afinaciones (sonido real, aguda → grave), del catálogo:

| Instrumento | Cuerdas |
|---|---|
| Guitarra | 64, 59, 55, 50, 45, 40 (Mi4 Si3 Sol3 Re3 La2 Mi2) |
| Bajo eléctrico / Contrabajo | 43, 38, 33, 28 (Sol2 Re2 La1 Mi1) |
| Ukulele | 69, 64, 60, 67 (La4 Mi4 Do4 Sol4, re-entrante) |
| Violín | 76, 69, 62, 55 |
| Viola | 69, 62, 55, 48 |
| Violonchelo | 57, 50, 43, 36 |

Se reconstruye cuando cambian `instrumentId` o `key`.

### 8.3 Do-Re-Mi (`name-buttons.tsx`)

Disposición:

```
┌────┬────┬────┬────┬────┬────┬────┐
│ Do │ Re │ Mi │ Fa │Sol │ La │ Si │   ← fila de 7, 52 px de alto; muestra la alteración vigente (p. ej. "Fa♯")
│ C  │ D  │ E  │ F  │ G  │ A  │ B  │     y la letra anglosajona pequeña
└────┴────┴────┴────┴────┴────┴────┘
   [♭] [♮] [♯]  |  [8↓] [8↑]   "Elige la octava más cercana; corrígela con 8↓ 8↑"
```

Comportamiento:
1. Al tocar una letra: `midi = nearestMidiForLetter({letter, alter, reference: referencePitch(...)})`, donde
   `alter = pendingAccidental ?? keyAcc(key)[letter]`. Luego `enter(midi)` y la alteración pendiente vuelve a
   `null`.
2. ♭ ♮ ♯ alternan la alteración pendiente (`aria-pressed`). Tocar la misma la desactiva.
3. 8↓ / 8↑ llaman a `octaveLast(−1 | 1)`.
4. La letra de cada botón refleja la alteración que se aplicará (pendiente o de armadura).
5. Pista en la barra de modo: "Usa la armadura de Sol mayor" (nombre de la tonalidad en sonido real).

Nota de diseño: la armadura que se usa es la de **sonido real** (`score.key`), porque las notas se guardan en
sonido real. Para instrumentos transpositores esto puede confundir (el saxofonista piensa en escrito). Ver Q3.

### 8.4 Teclado de computadora (`use-keyboard-shortcuts.ts`)

Se registra un único listener `keydown` en `document` desde `AppShell`.

**Se ignora el evento si:**
- Tiene `metaKey`, `ctrlKey` o `altKey` (excepto los atajos de deshacer/rehacer, abajo).
- El foco está en `input`, `select`, `textarea` o un elemento `contenteditable`.
- Hay un overlay abierto: en ese caso solo `Escape` cierra el overlay.

**Mapa (igual que legacy salvo lo marcado como nuevo):**

| Tecla | Acción |
|---|---|
| A W S E D F T G Y H U J K O L | Notas desde Do de la octava actual: A=Do, W=Do♯, S=Re, E=Re♯, D=Mi, F=Fa, T=Fa♯, G=Sol, Y=Sol♯, H=La, U=La♯, J=Si, K=Do+1, O=Do♯+1, L=Re+1 |
| Z / X | Octava −1 / +1 (2..6), toast "Octava N" |
| 1 2 3 4 5 | Redonda, blanca, negra, corchea, semicorchea |
| `.` | Puntillo |
| 0 o R | Silencio |
| Backspace / Delete | Borrar (preventDefault) |
| Espacio | Reproducir / detener (preventDefault) |
| ← / → | Mover selección |
| ↑ / ↓ | Octava de la nota seleccionada o la última |
| Esc | Quitar selección (o cerrar overlay) |
| **Ctrl/Cmd + Z** | Deshacer (nuevo) |
| **Ctrl/Cmd + Shift + Z** o **Ctrl + Y** | Rehacer (nuevo) |

MIDI de cada tecla: `12·(keyboardOctave + 1) + offset`. Si la tecla del piano en pantalla correspondiente está
visible, se le aplica el `flash`.

`e.repeat === true` (tecla mantenida) se ignora para notas, silencio y borrar, para no escribir ráfagas
accidentales (cambio respecto a legacy, que escribía una nota por cada repetición del sistema operativo).

---

## 9. Herramientas de duración (`duration-tools.tsx`)

### 9.1 Orden visual (dock superior)

```
[▶]  |  [𝅝] [𝅗𝅥] [♩] [♪] [𝅘𝅥𝅯]  [•]  [silencio]  |  [↶] [↷] [⌫]
play     redonda … semicorchea   puntillo          deshacer rehacer borrar
```

- **Rehacer (↷) es nuevo** respecto a legacy.
- Botones de 40 × 40 px; play 46 px circular.
- Iconos SVG de nota portados de `noteIcon()` de legacy.

### 9.2 Estados de los botones

| Botón | `aria-pressed` | `disabled` | `title` (tooltip escritorio) |
|---|---|---|---|
| Duración | `cursor.base === u` | nunca | "Negra (3)" |
| Puntillo | `cursor.dot` | `cursor.base === 1` | "Puntillo (.)" |
| Silencio | — | nunca | "Silencio (0)" |
| Deshacer | — | `!canUndo` | "Deshacer (Ctrl+Z)" |
| Rehacer | — | `!canRedo` | "Rehacer (Ctrl+Shift+Z)" |
| Borrar | — | `notes.length === 0` | "Borrar (⌫)" |
| Play | — | `notes.length === 0` | "Reproducir (espacio)" / "Detener (espacio)" |

### 9.3 Duraciones resultantes

| Base | Sin puntillo | Con puntillo |
|---|---|---|
| Redonda (16) | 16 | 24 |
| Blanca (8) | 8 | 12 |
| Negra (4) | 4 | 6 |
| Corchea (2) | 2 | 3 |
| Semicorchea (1) | 1 | — (puntillo deshabilitado) |

Una redonda con puntillo (24) en 4/4 se escribe como redonda ligada a blanca en el compás siguiente (lo resuelve
`toMeasures`). Es válido.

---

## 10. Formulario de metadatos y barra de vista

### 10.1 `score-meta-form.tsx`

| Campo | Control | Validación | Al cambiar |
|---|---|---|---|
| Título | `input text`, `autocomplete=off` | 0-120 caracteres; vacío se guarda como "Sin título" al exportar/guardar, no al escribir | `setMeta({title})` con debounce visual de 250 ms para el re-render |
| Compositor | `input text` | 0-120 | Ídem |
| Instrumento | `select` con los 19 nombres | Debe existir en el catálogo | `setMeta({instrumentId})` |
| Tonalidad (sonido real) | `select` de −6 a 6: "Sol mayor / Mi menor" | −6..6 | `setMeta({key})` |
| Compás | `select`: "4/4 (compasillo, C)", 3/4, 2/4, 6/8, 3/8, 12/8 | Uno de los 6 | `setMeta({meter})` |
| Tempo ♩ = | `input number` 30-240, `inputmode=numeric` | Se aplica en `change` (al salir), no en cada tecla. Vacío o no numérico → 100. Fuera de rango → recorta a 30/240 y corrige el campo | `setMeta({tempo})` |

Layout: grilla de 4 columnas (título y compositor ocupan 2); en < 640 px, 2 columnas (como legacy).

### 10.2 `view-bar.tsx`

| Control | Comportamiento |
|---|---|
| Segmentado "Para el instrumento" / "Sonido real" | `setView`; "Sonido real" deshabilitado con `title` "Este instrumento se lee en sonido real" si no transpone |
| Casilla "Nombres de notas" | `setMeta({showNames})` |
| Casilla "Tablatura" | Visible solo si `instrument.tab`; `setMeta({showTab})` |
| "Mover todo" −½ +½ 8↓ 8↑ | `shiftAll(−1 / +1 / −12 / +12)`; deshabilitados si no hay notas con tono |

---

## 11. Nueva partitura y reemplazo

### 11.1 Botón "Nueva" (confirmación por segundo toque)

`use-armed-button.ts`:

```
primer toque: armed = true; texto "¿Empezar de cero?"; estilo .warn; timeout 3 500 ms → desarmar
segundo toque dentro del plazo: desarmar; onConfirm()
```

`onConfirm` lo provee `AppShell` y delega en `library.prepareReplace()` (fuerza el guardado pendiente, ver
technical-decisions 11.4) y luego:

```typescript
replaceScore({
  id: crypto.randomUUID(), title: 'Mi canción', composer: '', instrumentId: current.instrumentId,
  key: 0, meter: '4/4', tempo: 96, showNames: false, showTab: false, notes: [], source: 'manual', savedAt: null,
});
```

- Mantiene el instrumento actual (como legacy).
- Hace scroll al inicio de la página.

### 11.2 Partitura vacía

- El pentagrama muestra un compás vacío (lo resuelve `buildAbc`).
- Mensaje superpuesto en la hoja: "Toca el teclado de abajo para escribir notas".
- Deshabilitados: play, borrar, mover todo, 8↑/8↓.

### 11.3 Reemplazo desde otros módulos

| Origen | Llamada | `source` |
|---|---|---|
| Ejemplo (library) | `replaceScore(fromSample(s, instrumentId))` | `'sample'` |
| Abrir de "Mis partituras" (library) | `replaceScore(recordToScore(record))` | el guardado |
| Importar archivo (import) | `replaceScore(fromImport(result))` | `'musicxml' / 'midi' / 'abc'` |
| De oído (ear) | `replaceScore(fromEar(...))` | `'ear_solo' / 'ear_mix' / 'ear_parts'` |
| Reajustar ritmo (ear) | `replaceNotesKeepingMeta(notes)` | sin cambio |

---

## 12. Integraciones con otros módulos

### 12.1 `playback`

| Momento | Llamada |
|---|---|
| Primer gesto del usuario | `unlock()` (también lo registra `AppShell` en captura) |
| Tocar tecla / seleccionar nota / octava | `preview(midi, timbre)` |
| Acciones [S] | `stopAll()` |
| Play | `play({notes, fromIndex: max(selection, 0), tempo, timbre, onPosition, onEnd})` |

El índice que suena (`onPosition`) se pasa a `score-view` por un store efímero `usePlaybackPositionStore` (no en
`useScoreStore`, para no provocar renders del editor a 60 fps).

### 12.2 `score-view`

- Lee `notes`, `meta`, `view`, `selection` con selectores.
- Al tocar una nota de la partitura llama `select(index)`.
- Muestra el status: "N notas · M compases", tonalidad escrita, notas fuera de rango, selección.

### 12.3 `library`

- Se suscribe a `revision` para el guardado automático en IndexedDB (debounce 800 ms).
- Llama `markSaved(savedAt)` tras guardar.
- Ejecuta `prepareReplace()` antes de cualquier `replaceScore` iniciado por el usuario.

### 12.4 `export`

Lee el estado actual (incluida la vista efectiva) para nombrar archivos y generar ABC/MusicXML/MIDI. No modifica el
store.

---

## 13. Validaciones y reglas de negocio

| ID | Regla | Dónde se aplica |
|---|---|---|
| V1 | Máximo 3 000 notas; al llegar, `addNote` sin selección muestra "Llegaste al máximo de 3 000 notas" | `addNote` |
| V2 | `p` ∈ [21, 108] o `null` para notas escritas en el editor | Superficies (rango limitado) + `clamp` en octavas y mover todo |
| V3 | `d` entero ∈ {1, 2, 3, 4, 6, 8, 12, 16, 24} desde el editor; otros valores (p. ej. 5, 7) pueden venir de import/ear y se aceptan si 1 ≤ d ≤ 48 | `cursorUnits`; `validateScore` |
| V4 | Tempo 30-240 | Formulario |
| V5 | Tonalidad −6..6 | Formulario, `shiftKey` (normF) |
| V6 | Compás ∈ 6 valores | Formulario |
| V7 | Título y compositor ≤ 120 | `maxLength` en input |
| V8 | Notas fuera del rango del instrumento se permiten pero se marcan | `score-view` |
| V9 | El puntillo no aplica a semicorchea | `toggleDot`, `setDuration(1)` |
| V10 | La vista "Sonido real" solo existe para instrumentos transpositores | `setView`, `setMeta(instrumentId)` |

`validateScore(score): asserts score is Score` (en `core/score/validate.ts`) comprueba V1-V7 y lanza con un mensaje
técnico; se usa en `replaceScore`, en el mapper de IndexedDB y al restaurar respaldos.

---

## 14. Edge cases

| # | Caso | Comportamiento esperado |
|---|---|---|
| E1 | Borrar con la partitura vacía | Sin efecto, sin snapshot; botón deshabilitado |
| E2 | Borrar la única nota estando seleccionada | Partitura vacía, `selection = −1` |
| E3 | Borrar la última nota seleccionada (i = last) | `selection = last − 1` |
| E4 | Seleccionar y luego deshacer un borrado que hizo la lista más larga | Selección se mantiene si el índice sigue existiendo |
| E5 | Deshacer después de `replaceScore` | "Nada que deshacer" (historial limpio) |
| E6 | Cambiar de instrumento con "Sonido real" activo a uno no transpositor | Vista vuelve a "Para el instrumento" |
| E7 | 8↑ sobre una nota en Do8, o en Sol♯7 (la octava no cabe) | Sin cambio, toast "Esa nota ya está en el límite del rango", sin snapshot |
| E8 | Mover todo +½ con una nota en Do8 | Esa nota queda en Do8, `clipped = 1`, toast con deshacer; la tonalidad sí cambia |
| E9 | Mover todo +8 con todas las notas en silencio | Botones deshabilitados (no hay notas con tono) |
| E10 | Do-Re-Mi sin notas previas | Referencia Do4 (60): "Re" → Re4 (62) |
| E11 | Do-Re-Mi: "Si" con referencia Do4 | Si3 (59) más cercano que Si4 (71) |
| E12 | Do-Re-Mi con empate (referencia Fa♯4=66, letra Do → Do4=60 a 6, Do5=72 a 6) | Gana Do4 (la más grave) |
| E13 | Tecla mantenida en el teclado de computadora | Solo una nota (`e.repeat` ignorado) |
| E14 | Escribir en el campo Título con la letra "a" | No escribe una nota (foco en input) |
| E15 | Overlay abierto + tecla "a" | No escribe nota; Esc cierra el overlay |
| E16 | Tempo vacío al salir del campo | 100 y el campo se corrige |
| E17 | Tempo "300" | 240 y el campo se corrige |
| E18 | 3 000 notas + tocar tecla sin selección | Toast de límite; no se agrega |
| E19 | 3 000 notas + tocar tecla con selección | Reemplaza normalmente |
| E20 | Dos dedos tocan dos teclas en el mismo frame | Dos notas consecutivas |
| E21 | Instrumento sin tablatura y `showTab = true` | La casilla se oculta; el valor se conserva |
| E22 | Partitura importada con `d = 5` y el usuario selecciona esa nota y pulsa "negra" | Pasa a `d = 4` |
| E23 | Seleccionar nota con cifrado `c` y reemplazar el tono | El cifrado se conserva |
| E24 | Reproducción en curso + tocar tecla | Se detiene la reproducción y se agrega la nota |
| E25 | Cambiar compás de 4/4 a 3/4 | Mismas notas, barras recalculadas; un snapshot |
| E26 | Pulsar "Nueva" una vez y esperar 4 s | Se desarma; no pasa nada |
| E27 | `AudioContext` bloqueado (iOS antes del primer toque) | El primer toque desbloquea y suena (unlock antes de preview) |
| E28 | Pantalla de 320 px de ancho | Dock con scroll horizontal en herramientas si no caben; sin scroll horizontal de página |
| E29 | Cambiar tonalidad en modo diapasón | Nombres del diapasón se actualizan con la nueva ortografía |
| E30 | Ráfaga de escritura en Título 3 s continuos y luego deshacer | Un solo paso restaura el título anterior a la ráfaga |

---

## 15. Manejo de errores y mensajes

El editor casi no tiene errores de IO; sus mensajes son avisos de reglas.

| Situación | Tipo | Mensaje | Dónde |
|---|---|---|---|
| Límite de notas | Aviso | "Llegaste al máximo de 3 000 notas." | Toast |
| Octava en el límite | Aviso | "Esa nota ya está en el límite del rango." | Toast |
| Mover todo recortó | Aviso + acción | "N notas quedaron en el límite del rango (La0–Do8)." [Deshacer] | Toast con botón |
| Nada que deshacer / rehacer | Info | "Nada que deshacer" / "Nada que rehacer" | Toast |
| Octava del teclado | Info | "Octava 5" | Toast |
| `replaceScore` con partitura inválida | Error interno | "No se pudo abrir la partitura." (el detalle técnico va al diagnóstico) | Lo muestra el módulo llamador |

Toasts: 4 s, `aria-live="polite"`, uno a la vez (el nuevo reemplaza al anterior).

---

## 16. Accesibilidad

| Elemento | Requisito |
|---|---|
| Teclas de piano | `<button>` con `aria-label` = nombre de nota; foco visible; Enter/Espacio sobre una tecla enfocada la toca |
| Posiciones del diapasón | `<button>` con `aria-label` "Cuerda 1, traste 3: Sol4" |
| Botones Do-Re-Mi | Texto visible + `aria-label` completo con alteración ("Fa sostenido") |
| Duraciones | `aria-pressed`, `aria-label` en español, grupo con `role="group" aria-label="Duración"` |
| Segmentados | `role="group"` + `aria-pressed` |
| Status de selección | `aria-live="polite"` en `score-view` |
| Contraste | Tokens de legacy (AA verificado con axe) |
| Movimiento | `prefers-reduced-motion`: sin transiciones en flash (cambio instantáneo de color) |
| Lector de pantalla | Al agregar nota se anuncia "Mi4 negra" en una región `aria-live` discreta (nuevo) |

El atajo de teclado de notas no debe interferir con lectores de pantalla: se desactiva mientras el foco está en un
control de formulario (regla 8.4).

---

## 17. Performance

| Métrica | Objetivo | Cómo |
|---|---|---|
| Tecla → sonido | ≤ 30 ms | `preview` antes de `addNote`; `pointerdown` |
| Tecla → store actualizado | ≤ 2 ms con 3 000 notas | Copia de arreglo O(n) con notas inmutables; sin JSON |
| Renders del editor por nota | ≤ 2 componentes (DurationTools si cambia `canUndo`; nada más) | Selectores finos; superficies memoizadas |
| Construcción del piano | 1 vez por montaje | Layout calculado con `useMemo` |
| Construcción del diapasón | Solo al cambiar instrumento o tonalidad | `useMemo([strings, key])` |
| Memoria del historial | < 1 MB con 200 pasos y 3 000 notas | Snapshots por referencia |

---

## 18. Textos (`strings.ts`)

```typescript
export const S = {
  durations: { 16: 'Redonda', 8: 'Blanca', 4: 'Negra', 2: 'Corchea', 1: 'Semicorchea' },
  dot: 'Puntillo',
  rest: 'Silencio',
  undo: 'Deshacer',
  redo: 'Rehacer',
  del: 'Borrar',
  play: 'Reproducir',
  stop: 'Detener',
  modes: { piano: 'Piano', fret: 'Diapasón', names: 'Do Re Mi' },
  hintPiano: 'Desliza para ver más octavas',
  hintFret: (instr: string) => `Afinación de ${instr}`,
  hintNames: (key: string) => `Usa la armadura de ${key} mayor`,
  namesInfo: 'Elige la octava más cercana; corrígela con 8↓ 8↑',
  accidentals: { '-1': 'Bemol para la próxima nota', '0': 'Becuadro para la próxima nota', '1': 'Sostenido para la próxima nota' },
  octaveDown: 'Bajar la última nota una octava',
  octaveUp: 'Subir la última nota una octava',
  openString: 'Al aire',
  position: 'Posición',
  newScore: 'Nueva',
  newConfirm: '¿Empezar de cero?',
  newTitle: 'Mi canción',
  emptySheet: 'Toca el teclado de abajo para escribir notas',
  nothingToUndo: 'Nada que deshacer',
  nothingToRedo: 'Nada que rehacer',
  octaveToast: (n: number) => `Octava ${n}`,
  maxNotes: 'Llegaste al máximo de 3 000 notas.',
  atRangeLimit: 'Esa nota ya está en el límite del rango.',
  clipped: (n: number) => `${n} ${n === 1 ? 'nota quedó' : 'notas quedaron'} en el límite del rango (La0–Do8).`,
  view: { written: 'Para el instrumento', concert: 'Sonido real' },
  concertDisabled: 'Este instrumento se lee en sonido real',
  showNames: 'Nombres de notas',
  showTab: 'Tablatura',
  moveAll: 'Mover todo',
  semiDown: 'Bajar medio tono', semiUp: 'Subir medio tono',
  octDown: 'Bajar una octava', octUp: 'Subir una octava',
  fields: { title: 'Título', composer: 'Compositor', instrument: 'Instrumento',
            key: 'Tonalidad (sonido real)', meter: 'Compás', tempo: 'Tempo ♩ =' },
  meterCommon: '4/4 (compasillo, C)',
  announceNote: (name: string, dur: string) => `${name} ${dur}`,
} as const;
```

---

## 19. Testing scenarios

### 19.1 Unit — `core/score/score-ops.test.ts`

| ID | Escenario | Esperado |
|---|---|---|
| T-OPS-01 | `insertOrReplace([], −1, 60, 4)` | `[{p:60,d:4}]`, sel −1, last 0 |
| T-OPS-02 | Reemplazo en medio | `p` cambia, `d` no, sel i+1 |
| T-OPS-03 | Reemplazo en la última | sel −1 |
| T-OPS-04 | Reemplazo conserva `c` | `c` intacto |
| T-OPS-05 | `removeAt` sin selección | pop |
| T-OPS-06 | `removeAt` última seleccionada | sel = last−1 |
| T-OPS-07 | `removeAt` única nota | `[]`, sel −1 |
| T-OPS-08 | `shiftNotes(+1)` sin recorte | todas +1, clipped 0 |
| T-OPS-09 | `shiftNotes(+12)` con Do8 | queda 108, clipped 1 |
| T-OPS-10 | `shiftNotes` ignora silencios | `p: null` intacto |
| T-OPS-11 | `shiftKey(0, +1)` | −5 (Re♭) |
| T-OPS-12 | `shiftKey(0, −1)` | 5 (Si) |
| T-OPS-13 | `shiftKey(3, ±12)` | 3 |
| T-OPS-14 | `octaveAt` en el límite | `changed: false` |
| T-OPS-15 | `nearestMidiForLetter` E10, E11, E12 | 62, 59, 60 |
| T-OPS-16 | `referencePitch` con selección en silencio | última nota con tono |
| T-OPS-17 | `cursorUnits` 5 × 2 combinaciones | tabla 9.3 |
| T-OPS-18 | Inmutabilidad: notas no tocadas conservan referencia | `===` |
| T-OPS-19 | `measureCount` con 4/4 y 17 semicorcheas | 2 |
| T-OPS-20 | `outOfRangeIndices` | índices correctos, ignora silencios |

### 19.2 Unit — `store/history.test.ts`

| ID | Escenario | Esperado |
|---|---|---|
| T-HIS-01 | push + undo | estado anterior |
| T-HIS-02 | undo + redo | estado posterior |
| T-HIS-03 | nueva acción tras undo | `future` vacío |
| T-HIS-04 | 201 pushes | `past.length === 200`, el más viejo descartado |
| T-HIS-05 | ráfaga de título (10 cambios en 800 ms) | 1 snapshot |
| T-HIS-06 | título, espera 1,2 s, título | 2 snapshots |
| T-HIS-07 | título y luego tempo dentro de 1 s | 2 snapshots (otro campo cierra el grupo) |
| T-HIS-08 | undo con selección fuera de rango | selección −1 |
| T-HIS-09 | undo de cambio de instrumento | instrumento anterior |

### 19.3 Unit — `store/score.store.test.ts`

| ID | Escenario | Esperado |
|---|---|---|
| T-STO-01 | `addNote` llama `playback.stopAll` | mock llamado |
| T-STO-02 | `addNote` incrementa `revision` y `dirty` | sí |
| T-STO-03 | `setDuration` sin selección no crea snapshot | `past` igual |
| T-STO-04 | `setDuration(1)` apaga puntillo | `dot false` |
| T-STO-05 | `toggleDot` con semicorchea | sin cambio |
| T-STO-06 | `setMeta({instrumentId:'piano'})` con view concert | view written |
| T-STO-07 | `setView('concert')` con piano | sigue written |
| T-STO-08 | `shiftAll` devuelve clipped | valor correcto |
| T-STO-09 | `replaceScore` limpia historial y selección | sí |
| T-STO-10 | `replaceScore` con score inválido | lanza AppError |
| T-STO-11 | `markSaved` no incrementa revision | sí |
| T-STO-12 | `addNote` con 3 000 notas sin selección | sin cambio + toast |
| T-STO-13 | `octaveLast` sin notas con tono | sin efecto |
| T-STO-14 | `moveSelection` tabla 4.6 completa | sí |
| T-STO-15 | `setPendingAccidental` alterna | null tras segundo toque |
| T-STO-16 | `setKeyboardOctave` límites 2 y 6 | recorta |

### 19.4 Componentes

| ID | Componente | Escenario |
|---|---|---|
| T-CMP-01 | PianoKeyboard | Renderiza 49 teclas (29 blancas, 20 negras) con aria-labels |
| T-CMP-02 | PianoKeyboard | pointerdown en Do4 llama `onNote(60)` |
| T-CMP-03 | PianoKeyboard | contextmenu bloqueado |
| T-CMP-04 | Fretboard | Guitarra: 6 filas × 16 columnas; cuerda 1 traste 0 = Mi4 |
| T-CMP-05 | Fretboard | Violín muestra "Posición" |
| T-CMP-06 | Fretboard | Piano (sin cuerdas) usa afinación de guitarra y pista "Afinación de guitarra" |
| T-CMP-07 | NameButtons | En Sol mayor el botón Fa muestra "Fa♯" |
| T-CMP-08 | NameButtons | ♯ pendiente se refleja en las 7 letras y se apaga tras tocar |
| T-CMP-09 | DurationTools | Puntillo deshabilitado con semicorchea |
| T-CMP-10 | DurationTools | Deshacer/rehacer habilitados según historial |
| T-CMP-11 | ScoreMetaForm | Tempo "300" → 240 al salir |
| T-CMP-12 | ScoreMetaForm | Tempo vacío → 100 |
| T-CMP-13 | ViewBar | "Sonido real" deshabilitado con piano, habilitado con clarinete |
| T-CMP-14 | ViewBar | Casilla Tablatura oculta con flauta |
| T-CMP-15 | ViewBar | Mover todo con recorte muestra toast con botón Deshacer funcional |
| T-CMP-16 | InputDock | Cambiar modo persiste en prefs y muestra la superficie |
| T-CMP-17 | use-armed-button | Segundo toque confirma; a los 3,5 s se desarma |

### 19.5 Hook de teclado

| ID | Escenario | Esperado |
|---|---|---|
| T-KEY-01 | "a" con octava 4 | addNote(60) |
| T-KEY-02 | "l" con octava 4 | addNote(74) |
| T-KEY-03 | "z" ×3 desde 4 | octava 2 (no baja de 2) |
| T-KEY-04 | "3" | negra |
| T-KEY-05 | "r" y "0" | silencio |
| T-KEY-06 | foco en input + "a" | nada |
| T-KEY-07 | overlay abierto + "a" | nada; Esc cierra |
| T-KEY-08 | Ctrl+Z / Cmd+Z | undo |
| T-KEY-09 | Ctrl+Shift+Z / Ctrl+Y | redo |
| T-KEY-10 | keydown con `repeat: true` en "a" | nada |
| T-KEY-11 | espacio | play/stop y preventDefault |
| T-KEY-12 | Backspace | delete y preventDefault |

### 19.6 E2E (Playwright)

| ID | Flujo | Navegadores |
|---|---|---|
| E2E-ED-01 | Escribir Do Re Mi Fa con el piano (negras), reproducir, ver 4 notas y "1 compás" | Chromium, WebKit móvil |
| E2E-ED-02 | Seleccionar la 2.ª nota tocándola en la partitura, tocar Sol: la 2.ª pasa a Sol y se selecciona la 3.ª | Chromium |
| E2E-ED-03 | Escribir 3 notas, deshacer 2, rehacer 1 → 2 notas | Chromium |
| E2E-ED-04 | Cambiar a Saxofón alto: estado "Tonalidad escrita: La mayor" | Chromium |
| E2E-ED-05 | Modo Do-Re-Mi en Sol mayor: Fa escribe Fa♯ | WebKit móvil |
| E2E-ED-06 | Teclado de computadora completo (A…L, Z/X, 1-5, ., R, ⌫) | Chromium |
| E2E-ED-07 | Nueva con doble toque deja partitura vacía con el mismo instrumento | Chromium |
| E2E-ED-08 | Viewport 320 px: sin scroll horizontal de página | WebKit móvil |

### 19.7 Fixtures dorados

`scripts/legacy-fixtures.mjs` no cubre el editor (es estado + DOM). La paridad del editor se valida con la tabla
7.3 contra la lectura de legacy (líneas 829-874 y 1162-1184) en revisión de código.

---

## 20. Quality Gates del módulo

| Métrica | Umbral |
|---|---|
| Cobertura `core/score/score-ops.ts` | ≥ 95 % líneas, ≥ 90 % ramas |
| Cobertura `store/*` | ≥ 90 % |
| Cobertura `components/*` y `hooks/*` | ≥ 80 % |
| Complejidad máxima por función | 8 (más estricto que el global 10) |
| Líneas por archivo | Según 2.1 |
| Archivos de lógica | ≤ 15 (14 previstos) |
| Renders por nota escrita | ≤ 2 componentes (React Profiler en test) |
| Accesibilidad | 0 violaciones axe en PianoKeyboard, NameButtons, DurationTools, ScoreMetaForm |

---

## 21. Criterios de aceptación (trazabilidad)

| Historia | Criterio | Sección | Test |
|---|---|---|---|
| US-W01 | Sonido ≤ 30 ms, nota en partitura | 8, 17 | T-CMP-02, E2E-ED-01 |
| US-W01 | Sin zoom ni menú contextual en móvil | 8 | T-CMP-03, E2E-ED-08 |
| US-W01 | Centrado en Do4 | 8.1 | revisión visual |
| US-W02 | Armadura, octava cercana, alteración de un uso | 8.3, 5.1 | T-OPS-15, T-CMP-07/08, E2E-ED-05 |
| US-W03 | Diapasón con afinación del instrumento | 8.2 | T-CMP-04/05/06 |
| US-W04 | Atajos legacy + deshacer/rehacer | 8.4 | T-KEY-* , E2E-ED-06 |
| US-W05 | Seleccionar y reemplazar | 4.1, 7 | T-OPS-02/03, E2E-ED-02 |
| US-W06 | Deshacer/rehacer completo, 200 pasos, título agrupado | 6 | T-HIS-*, E2E-ED-03 |
| US-W07 | Mover todo con aviso de recorte | 4.9 | T-OPS-08..13, T-CMP-15 |
| US-W08 | Silencios y puntillos | 4.1, 4.4, 9 | T-STO-04/05, T-KEY-05 |
| US-W09 | Nueva con confirmación | 11.1 | T-CMP-17, E2E-ED-07 |

---

## 22. Diferencias intencionales con legacy

| # | Legacy | Nuevo | Motivo |
|---|---|---|---|
| D1 | Deshacer solo notas, sin rehacer | Notas + metadatos, con rehacer | Deuda 8 |
| D2 | Mover todo recorta en silencio | Informa y ofrece deshacer | Deuda 7 |
| D3 | Tecla blanca 36 px | 40 px | Objetivo táctil |
| D4 | Tecla mantenida escribe ráfagas | Se ignora `repeat` | Evitar errores |
| D5 | Sin Ctrl+Z | Ctrl/Cmd+Z y Shift+Z | Convención |
| D6 | Snapshots con `JSON.stringify` | Referencias inmutables | Performance |
| D7 | Sin límite de notas al escribir | 3 000 | Consistencia con BD |
| D8 | Diapasón de violín rotulado como trastes | "Posición" | Precisión |
| D9 | Sin anuncio para lectores de pantalla | Región `aria-live` | Accesibilidad |
| D10 | 8↑ cerca del límite recorta (Sol♯7 → Do8) o crea un paso vacío | Si la octava no cabe: sin cambio, sin paso, aviso | Correcto musicalmente |

Cada diferencia debe aparecer en `tests/fixtures/golden/EXCEPTIONS.md` si afecta a una salida comparada.

---

## 23. Preguntas abiertas

| ID | Pregunta | Propuesta por defecto |
|---|---|---|
| Q1 | El diapasón tiene filas de 24 px (< 40 px táctil). ¿Agrandar a 36-40 px aunque ocupe más alto en el dock? | Subir a 34 px en móvil y medir con usuarios; mantener 24 px en escritorio |
| Q2 | ¿Conservar el historial de deshacer al recargar (en IndexedDB)? | No en el MVP |
| Q3 | En Do-Re-Mi con instrumento transpositor, ¿los botones deberían pensar en notas **escritas**? | Mantener sonido real (legacy) en el MVP; evaluar con la persona Marco |
| Q4 | ¿Agregar un botón visible de "ligadura" para unir dos notas iguales? | No en el MVP (no-objetivo) |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Spec Writer
