---
name: atril-library-spec
status: in-progress
created: 2026-10-18T12:56:17Z
updated: 2026-10-18T12:56:17Z
---

# Spec: Módulo `library` ("Mis partituras", sin login)

**Estado:** 🟡 Lista para revisión
**Features:** F09 ("Mis partituras" en el dispositivo + respaldo), F11 (recordar la partitura abierta), F12
(ejemplos), soporte de F14 (audios locales)
**Historias:** US-L01 … US-L07, US-W09 (CA2), US-F07
**Restricción rectora:** R3 — **sin login, cuentas ni backend** (decisión del usuario 2026-10-18)
**Deuda que corrige:** 1 ("Mis partituras" en localStorage)
**Referencia de comportamiento:** `legacy/index.html` líneas 746-765 (estado, `localStorage`) y 1225-1274 (biblioteca,
cargar, Nueva)
**Arquitectura:** `technical-decisions.md` secciones 7 (IndexedDB), 8.9, 11.3, 11.4, 12.4, 12.5

---

## Índice

1. Alcance
2. Code Structure
3. Modelo de datos
4. Capa de almacenamiento (`infra/idb.ts`)
5. Repositorio de partituras
6. Guardado automático
7. Arranque y cambio de partitura
8. Overlay "Mis partituras"
9. Papelera
10. Ejemplos
11. Respaldo: hacer copia
12. Respaldo: restaurar copia
13. Durabilidad de los datos
14. Varias pestañas
15. Preferencias
16. Espacio usado y "Borrar todo"
17. Audios guardados (F14)
18. Máquinas de estado
19. Validaciones
20. Edge cases
21. Errores y mensajes
22. Accesibilidad
23. Performance
24. Testing scenarios
25. Quality Gates
26. Trazabilidad
27. Diferencias intencionales con legacy
28. Preguntas abiertas

---

## 1. Alcance

| Hace | No hace |
|---|---|
| Guardar automáticamente la partitura en edición en IndexedDB | Login, cuentas, sincronización en la nube (R3) |
| Listar, abrir, duplicar, borrar (papelera), restaurar y purgar partituras | Editar notas (`editor`) |
| Abrir los ejemplos de dominio público | Importar MusicXML/MIDI/ABC (`import`) |
| Hacer y restaurar copias de respaldo en archivo | Exportar PDF/PNG/ZIP MuseScore (`export`) |
| Recordar la última partitura y las preferencias | Analizar audio (`ear`) |
| Proteger los datos frente al borrado del navegador (persistencia, instalación, recordatorios) | |
| Avisar cuando la misma partitura está abierta en otra pestaña | |
| Guardar audios en el dispositivo (F14, *Could*) | |

---

## 2. Code Structure

```
src/infra/
├── idb.ts                     (≤ 150)  # openDb, migraciones, tx(), requestToPromise
└── download.ts                (≤ 80)   # saveBlob, shareBlob, canShareFiles (spec formats 10)

src/modules/library/
├── components/
│   ├── library-overlay.tsx    (≤ 180)  # contenedor: pestañas Mis partituras / Papelera, ejemplos, respaldo
│   ├── score-row.tsx          (≤ 100)  # fila: título, instrumento, fecha, acciones
│   ├── trash-list.tsx         (≤ 120)
│   ├── backup-panel.tsx       (≤ 150)  # hacer copia, restaurar, recordatorio, informe
│   ├── save-badge.tsx         (≤ 60)   # "Guardada en este dispositivo"
│   ├── install-hint.tsx       (≤ 80)   # sugerencia de pantalla de inicio (iOS)
│   └── storage-usage.tsx      (≤ 80)   # espacio usado + "Borrar todo"
├── hooks/
│   ├── use-score-list.ts      (≤ 60)   # TanStack Query sobre el repositorio
│   ├── use-autosave.ts        (≤ 100)  # suscripción a editor.revision + debounce + flush
│   └── use-tab-guard.ts       (≤ 80)   # BroadcastChannel
├── services/
│   ├── score-repository.ts    (≤ 250)
│   ├── score-mapper.ts        (≤ 80)
│   ├── backup.service.ts      (≤ 200)
│   ├── persistence.ts         (≤ 100)  # storage.persist, estimate, detección iOS/standalone
│   └── prefs.service.ts       (≤ 80)
├── store/
│   └── save.store.ts          (≤ 80)   # SaveState + último error
├── strings.ts · types.ts · index.ts
```

Archivos de lógica: 15 ✅ (sin contar `strings.ts`, `types.ts`, `index.ts`).

### 2.1 API pública

```typescript
export { LibraryOverlay } from './components/library-overlay';
export { SaveBadge } from './components/save-badge';
export { InstallHint } from './components/install-hint';
export { useAutosave } from './hooks/use-autosave';
export { useTabGuard } from './hooks/use-tab-guard';
export { prepareReplace, bootLibrary } from './services/...';
export { prefs } from './services/prefs.service';
export type { SaveState, BackupReport } from './types';
```

### 2.2 Dependencias

| Hacia | Permitido |
|---|---|
| `modules/editor` (index) | ✅ leer score/revision, `replaceScore`, `markSaved` |
| `core/score` | ✅ `validateScore`, `SAMPLES`, `fromSample` |
| `core/instruments` | ✅ nombres para la lista |
| `infra/idb`, `infra/download` | ✅ |
| `shared/*` | ✅ |
| Otros módulos | ❌ (import, export, ear dependen de `library`, no al revés) |

---

## 3. Modelo de datos

Definido en `technical-decisions.md` 7.3 y 8.9. Resumen:

```typescript
interface ScoreRecord {
  id: string;                 // UUID v4
  title: string; composer: string;
  instrumentId: InstrumentId; key: Fifths; meter: MeterId; tempo: number;
  showNames: boolean; showTab: boolean;
  notes: Note[];
  source: ScoreSource;
  createdAt: string;          // ISO 8601 UTC
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: 1;
}

interface ScoreSummary {
  id: string; title: string; composer: string; instrumentId: InstrumentId;
  noteCount: number; updatedAt: string; deletedAt: string | null;
}
```

### 3.1 Mapper

| Función | Regla |
|---|---|
| `scoreToRecord(score, now, prev?)` | `createdAt = prev?.createdAt ?? now`; `updatedAt = now`; `deletedAt = prev?.deletedAt ?? null`; título vacío → "Sin título"; copia profunda de `notes` |
| `recordToScore(record)` | `validateScore`; `savedAt = record.updatedAt` |
| `recordToSummary(record)` | `noteCount = notes.length` |

---

## 4. Capa de almacenamiento (`infra/idb.ts`)

### 4.1 API

```typescript
export const DB_NAME = 'atril';
export const DB_VERSION = 1;

export function openDb(): Promise<IDBDatabase>;          // singleton por pestaña
export function tx<T>(
  db: IDBDatabase,
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  fn: (st: IDBObjectStore, all: Record<StoreName, IDBObjectStore>) => IDBRequest<T> | Promise<T>,
): Promise<T>;
export function deleteDatabase(): Promise<void>;
export function isIndexedDbAvailable(): Promise<boolean>;
```

### 4.2 Apertura

```
openDb():
    si ya hay promesa: devolverla
    req = indexedDB.open('atril', 1)
    onupgradeneeded: aplicar MIGRATIONS[v] para v en (oldVersion, newVersion]   (technical-decisions 7.5)
    onblocked: emitir evento 'db-blocked' → toast "Cierra las otras pestañas de Atril para actualizar."
    onsuccess: db.onversionchange = () => { db.close(); aviso "Atril se actualizó en otra pestaña. Recarga esta página." }
    onerror: rechazar con AppError('storage_unavailable')
```

### 4.3 Disponibilidad

`isIndexedDbAvailable()` intenta abrir y cerrar una base de prueba `atril-probe` con timeout de 2 s. Falla en:
- Firefox con "Nunca recordar historial" (versiones antiguas).
- Algunos navegadores integrados (in-app browsers de redes sociales).
- Cuota 0.

Si no está disponible → **modo en memoria** (6.6).

---

## 5. Repositorio de partituras

`ScoreRepository` (technical-decisions 8.9) sobre IndexedDB.

| Método | Implementación | Notas |
|---|---|---|
| `list()` | Índice `by_updated`, orden descendente, `deletedAt === null` | Devuelve `ScoreSummary[]` (sin notas al exterior) |
| `listTrash()` | `deletedAt !== null`, orden por `deletedAt` desc | |
| `get(id)` | `get` + `recordToScore`; inválido → `null` y registro en diagnóstico | |
| `save(score)` | `get(prev)` + `put(scoreToRecord(...))` en una transacción `readwrite` | Devuelve `updatedAt` |
| `duplicate(id)` | Copia con id nuevo, título "{título} (copia)" (máx. 120), fechas nuevas, `deletedAt: null` | Devuelve el nuevo id |
| `softDelete(id)` | `deletedAt = ahora` (no cambia `updatedAt`) | |
| `restore(id)` | `deletedAt = null` | |
| `purge(id)` | `delete` del registro y de sus audios (store `audio`, índice `by_score`) en la misma transacción | |
| `purgeExpired(30)` | Borra registros con `deletedAt` anterior a ahora − 30 días | Se llama al abrir el overlay |

Todos los errores de IndexedDB se convierten con `toAppError` (technical-decisions 14.1).

### 5.1 Lectura tolerante

Un registro que no pasa `validateScore` (corrupto, versión futura) se **omite** de `list()` y se cuenta; si hay
alguno, el overlay muestra "N partituras no se pudieron leer." con opción "Descargar datos dañados" (JSON crudo) para
soporte. Nunca se borran automáticamente.

---

## 6. Guardado automático

### 6.1 Reglas

| Regla | Detalle |
|---|---|
| Disparador | Cambio de `editor.revision` (cualquier acción [R] del editor) |
| Debounce | 800 ms desde el último cambio |
| Flush inmediato | `visibilitychange` a `hidden`, `pagehide`, `prepareReplace()`, abrir el overlay de biblioteca |
| Qué no se guarda | Partitura con `revision` igual a la de su carga (ejemplo o nueva sin tocar) |
| Qué se guarda | La partitura completa (`scoreToRecord`) |
| Tras guardar | `editor.markSaved(updatedAt)`; `prefs.lastOpenId = id`; invalidar `['scores']`; avisar a otras pestañas (14) |
| Concurrencia | Un guardado a la vez; si llega un cambio durante el guardado, se programa otro al terminar |

### 6.2 `use-autosave.ts`

```
useAutosave():
    revision = useScoreStore(s => s.revision)
    loadedRevision = useScoreStore(s => s.loadedRevision)   # revision al cargar (replaceScore la fija)
    efecto [revision]:
        si revision == loadedRevision: return
        programar guardado en 800 ms (cancelando el anterior)
    efecto montaje: listeners visibilitychange/pagehide → flush()
    flush(): si hay guardado programado → ejecutarlo ya (await)
```

`loadedRevision` es un campo del store del editor (spec editor 3.2), fijado en `replaceScore`.

### 6.3 `pagehide` y escrituras asíncronas

IndexedDB es asíncrono; en `pagehide` el navegador puede cerrar la página antes de terminar. Mitigación: como el
debounce es corto (800 ms), en la práctica el último cambio ya está guardado; el flush en `visibilitychange: hidden`
ocurre antes de `pagehide` en móviles (cambio de app). Riesgo residual documentado: perder < 1 s de edición al
cerrar la pestaña de golpe en escritorio.

### 6.4 Indicador (`save-badge.tsx`)

Junto al título de la partitura:

| SaveState | Texto | Estilo |
|---|---|---|
| unsaved | "Sin guardar (aún no la editaste)" | gris, solo en ejemplos/nuevas |
| saving | "Guardando…" | gris |
| saved | "Guardada en este dispositivo" | gris con ✓ |
| error | Mensaje del error (21) | color `--oor` |

`aria-live="polite"`, pero solo anuncia transiciones a `error` (no cada guardado).

### 6.5 Sin botón "Guardar"

El botón "Guardar" de legacy desaparece. En su lugar, en la barra de exportación queda "Mis partituras" (abre el
overlay). Motivo: con guardado automático, un botón Guardar confunde ("¿se guardó o no?").

### 6.6 Modo en memoria (IndexedDB no disponible)

- El editor funciona igual; no se guarda nada.
- Aviso persistente (no se cierra solo) arriba de la partitura: "En esta ventana tus partituras no se guardan. Usa
  una ventana normal del navegador, o descarga tu trabajo (PDF o «Descargar para MuseScore»)."
- "Mis partituras" muestra solo los ejemplos y el aviso.
- Respaldo deshabilitado (no hay nada que respaldar).

---

## 7. Arranque y cambio de partitura

### 7.1 `bootLibrary()` (antes del primer render del editor)

```
disponible = await isIndexedDbAvailable()
si !disponible: editor.replaceScore(fromSample(SAMPLES[0], 'piano')); modo memoria; return
id = await prefs.get('lastOpenId')
score = id ? await repo.get(id) : null
si score y score.deletedAt == null: editor.replaceScore(score)
si no: editor.replaceScore(fromSample(SAMPLES[0], await prefs.get('defaultInstrument') ?? 'piano'))
purgeExpired(30) en segundo plano
persistence.maybeShowInstallHint()   (13.2)
```

Presupuesto: ≤ 150 ms hasta tener la partitura (en paralelo con la carga de abcjs). Mientras tanto la hoja muestra
"Cargando…".

### 7.2 `prepareReplace()`

Llamado por `editor` (Nueva), `import`, `ear` y el propio overlay antes de `replaceScore`:

```
prepareReplace():
    await autosave.flush()          # la actual queda guardada (si tenía cambios)
```

No pregunta nada: con guardado automático no hay cambios que perder. Si el flush falla (cuota llena), se muestra el
error y **no** se reemplaza la partitura (devuelve `false`), para no perder trabajo.

### 7.3 Mensaje tras reemplazar

Si la partitura anterior tenía cambios recién guardados en el flush: toast "La anterior quedó en Mis partituras"
(legacy).

---

## 8. Overlay "Mis partituras"

### 8.1 Estructura

```
┌───────────────────────────────────────────────────┐
│ Mis partituras                          [Cerrar]  │
│ Se guardan solas en este dispositivo.             │
│ [Recordatorio de copia, si aplica]                │
│ ┌─────────────┬──────────┐                        │
│ │ Partituras  │ Papelera │  (segmentado)          │
│ └─────────────┴──────────┘                        │
│ ─ Cielito… ─ Saxofón alto en Mi♭ · 18 oct  [Abrir] [⋯] │
│ ─ …                                               │
│ Ejemplos                                          │
│ ─ Himno de la alegría · L. van Beethoven [Abrir]  │
│ ─ La cucaracha · Tradicional mexicana   [Abrir]   │
│ Copia de respaldo                                 │
│ [Hacer copia]  [Restaurar copia]                  │
│ Última copia: 4 oct · 12 partituras               │
│ Espacio usado: 1,2 MB · [Borrar todo]             │
└───────────────────────────────────────────────────┘
```

### 8.2 Fila (`score-row.tsx`)

| Elemento | Contenido |
|---|---|
| Título | `title` o "Sin título", una línea con elipsis |
| Subtítulo | `{nombre del instrumento} · {fecha}` |
| Fecha | Hoy → "hoy, 14:05"; este año → "18 oct"; otro año → "18 oct 2025" (`Intl.DateTimeFormat('es', …)`) |
| Marca | "Abierta" si es la partitura actual |
| Botón principal | "Abrir" (deshabilitado si es la actual) |
| Menú ⋯ | "Duplicar", "Mover a la papelera" |

- Orden: `updatedAt` descendente.
- Lista vacía: "Aún no tienes partituras guardadas. Empieza a escribir y se guardarán solas."
- La lista se renderiza completa hasta 200 filas; más de 200 → virtualización simple por ventana (Q3).

### 8.3 Acciones

| Acción | Efecto | Mensaje |
|---|---|---|
| Abrir | `prepareReplace()` → `editor.replaceScore(get(id))` → cerrar overlay → scroll arriba | — |
| Duplicar | `duplicate(id)` → la copia aparece arriba | "Se creó una copia" |
| Mover a la papelera | `softDelete(id)`; si era la actual, la partitura sigue abierta y se marca `deletedAt` (se guardará en papelera) | "Se movió a la papelera" + [Deshacer] (5 s) |
| Abrir ejemplo | `prepareReplace()` → `replaceScore(fromSample(s, instrumentoActual))` | — |

"Mover a la papelera" de la partitura **abierta**: se mantiene abierta; si el usuario la edita, se restaura
automáticamente de la papelera (al guardar, `deletedAt = null`) y se avisa "Se restauró de la papelera porque la
editaste."

### 8.4 Cierre

Botón "Cerrar", clic en el fondo, `Escape` (como legacy). El foco vuelve al botón que abrió el overlay.

---

## 9. Papelera

| Regla | Detalle |
|---|---|
| Retención | 30 días desde `deletedAt` |
| Purga automática | `purgeExpired(30)` al arrancar y al abrir el overlay |
| Fila | Título, instrumento, "Se borrará en N días" |
| Acciones | "Restaurar"; "Borrar para siempre" (confirmación por segundo toque: "¿Seguro?", como legacy) |
| Vaciar | "Vaciar papelera" con confirmación por segundo toque |
| Lista vacía | "La papelera está vacía." |

---

## 10. Ejemplos

- Fuente: `core/score/samples.ts` (technical-decisions 3.2): Himno de la alegría, Estrellita, Escala de Sol mayor,
  La cucaracha.
- Se abren con el **instrumento actual** (legacy `fresh(sample, S.instr)`).
- Cada apertura crea una partitura con **id nuevo** y `source: 'sample'`; no se guarda hasta que se edita.
- "La cucaracha" lleva la marca interna `verified: false` hasta que alguien la verifique al oído (tarea del plan);
  mientras sea `false`, solo aparece en builds de desarrollo.

---

## 11. Respaldo: hacer copia

### 11.1 Flujo

```
"Hacer copia"
  → opciones: [ ] Incluir audios (solo si F14 activo y hay audios; muestra el tamaño)
              [ ] Incluir la papelera (desmarcada)
  → flush del guardado automático
  → leer registros (y audios si se marcó)
  → construir ZIP (technical-decisions 7.7) con fflate
  → nombre "atril-respaldo-2026-10-18.zip"
  → si canShareFiles(): botones "Compartir" y "Descargar"; si no: descarga directa
  → prefs.lastBackupAt = ahora; prefs.lastBackupCount = N
  → "Copia lista: 12 partituras."
```

### 11.2 Contenido de `atril-backup.json`

```json
{
  "format": "atril-backup",
  "version": 1,
  "exportedAt": "2026-10-18T12:56:17Z",
  "app": "Atril",
  "scores": [ { "id": "…", "title": "…", "notes": [ { "p": 67, "d": 4 } ], "…": "…" } ],
  "audio": [ { "id": "…", "scoreId": "…", "fileName": "…", "mimeType": "audio/mp4", "path": "audio/….m4a" } ]
}
```

### 11.3 `LEEME.txt`

```
Copia de respaldo de Atril.

Para recuperar tus partituras en otro teléfono o computadora:
1. Abre Atril.
2. Toca «Mis partituras» → «Restaurar copia».
3. Elige este archivo .zip.

No hace falta descomprimirlo.
```

### 11.4 Rendimiento

200 partituras ≈ 2-5 MB de JSON → ZIP en ≤ 1 s. Con audios puede pesar hasta 200 MB: se muestra progreso y se
construye con `zip` asíncrono de fflate.

---

## 12. Respaldo: restaurar copia

### 12.1 Flujo

```
"Restaurar copia" → elegir archivo (.zip o .json)
  → validar tamaño (≤ 300 MB; JSON ≤ 20 MB)
  → si .zip: descomprimir con filtro de tamaño (spec formats 11.4) y leer atril-backup.json
  → JSON.parse → validar format === 'atril-backup' y version ≤ 1
  → por cada partitura: validateScore; inválidas se cuentan y se omiten
  → fusionar (12.2) en una sola transacción readwrite
  → audios: escribir los que correspondan a partituras restauradas (si vienen)
  → informe "Restaurada: N nuevas, M actualizadas, K sin cambios, E con errores."
  → invalidar lista; si la partitura abierta fue actualizada → ofrecer "Abrir la versión restaurada"
```

### 12.2 Reglas de fusión

| Caso | Resultado |
|---|---|
| id no existe localmente | Se agrega tal cual (incluido `deletedAt`) |
| id existe, el de la copia tiene `updatedAt` más reciente | Se reemplaza el local |
| id existe, el local es más reciente o igual | Se conserva el local (`unchanged`) |
| Partitura inválida en la copia | Se omite (`invalid`) |
| Copia de una versión futura (`version > 1`) | Error "Esta copia es de una versión más nueva de Atril. Actualiza la página e inténtalo de nuevo." |

Nunca se borra nada local por restaurar.

### 12.3 Copias de legacy

Legacy guardaba en `localStorage` del artifact (otro origen), así que esos datos no son accesibles. Los usuarios de
legacy pueden migrar abriendo cada ZIP "para MuseScore" con "Buscar o abrir". Se agrega a la ayuda.

---

## 13. Durabilidad de los datos

### 13.1 Almacenamiento persistente

```
al primer guardado exitoso (prefs.persistAsked == false):
    si navigator.storage?.persist: granted = await navigator.storage.persist()
    prefs.persistAsked = true ; prefs.persistGranted = granted
```

Chrome concede según el uso; Firefox puede preguntar al usuario; Safari lo concede a apps instaladas.

### 13.2 Sugerencia de instalar (iOS) — `install-hint.tsx`

| Condición | Valor |
|---|---|
| Plataforma | iPhone/iPad (Safari) |
| No instalada | `!navigator.standalone` y `!matchMedia('(display-mode: standalone)').matches` |
| Tiene partituras | ≥ 1 guardada |
| No se mostró antes | `prefs.installHintShownAt == null` o hace > 30 días y se tocó "Más tarde" |

Contenido: "Agrega Atril a tu pantalla de inicio para que tus partituras no se borren: toca Compartir ⬆︎ y luego
«Agregar a inicio»." Botones "Entendido" (no volver a mostrar) y "Más tarde" (30 días).

En Android/Chrome se usa el evento `beforeinstallprompt` si está disponible: botón "Instalar Atril" en el overlay.

### 13.3 Manifiesto web

`public/manifest.webmanifest`: `name: "Atril"`, `short_name: "Atril"`, `display: "standalone"`, `start_url: "/"`,
`lang: "es"`, colores de tema de los tokens, iconos 192/512 y `apple-touch-icon`. Sin service worker en el MVP (Q2).

### 13.4 Recordatorio de copia

| Condición | Valor |
|---|---|
| Partituras guardadas | ≥ 1 |
| Última copia | `lastBackupAt == null` o hace > 14 días |
| Cambios desde la última copia | Alguna partitura con `updatedAt > lastBackupAt` |

Aviso en el overlay (no intrusivo, sin bloquear): "Hace más de 2 semanas que no haces una copia. Si cambias de
teléfono o el navegador borra sus datos, podrías perder tus partituras." [Hacer copia]

---

## 14. Varias pestañas (`use-tab-guard.ts`)

### 14.1 Canal

`BroadcastChannel('atril')` (si no existe, se omite la función sin errores).

| Mensaje | Cuándo | Efecto en las demás pestañas |
|---|---|---|
| `{type: 'open', id, tab}` | Al cargar una partitura y cada 10 s (latido) | Registrar qué pestaña tiene qué partitura |
| `{type: 'saved', id, updatedAt, tab}` | Tras guardar | Invalidar la lista; si tienen abierta la misma → aviso |
| `{type: 'close', tab}` | `pagehide` | Olvidar la pestaña |

### 14.2 Aviso

Si otra pestaña tiene abierta la misma partitura (latido < 25 s): banda arriba de la hoja: "Esta partitura está
abierta en otra pestaña. Si editas en las dos, se guardará la última." Si llega `saved` de la otra pestaña con
`updatedAt` más reciente: "Se guardaron cambios en otra pestaña." [Cargar esos cambios].

---

## 15. Preferencias (`prefs.service.ts`)

Store `prefs` de IndexedDB (technical-decisions 7.3), con caché en memoria.

| Clave | Default | Escrita por |
|---|---|---|
| `inputMode` | 'piano' | editor (modo de entrada) |
| `defaultInstrument` | 'piano' | al cambiar de instrumento (último usado) |
| `lastOpenId` | null | guardado automático |
| `lastBackupAt`, `lastBackupCount` | null, 0 | respaldo |
| `persistAsked`, `persistGranted` | false | 13.1 |
| `installHintShownAt`, `installHintDismissed` | null, false | 13.2 |

API: `get<K>(key)`, `set<K>(key, value)`, `subscribe(key, fn)`. En modo memoria funciona solo en memoria.

---

## 16. Espacio usado y "Borrar todo"

### 16.1 Espacio

`navigator.storage.estimate()` → "Espacio usado: 1,2 MB" (si no existe la API, se omite). Si `usage/quota > 0,8` →
aviso "El espacio de este dispositivo para Atril está casi lleno."

### 16.2 Borrar todo

- Botón "Borrar todo" al final del overlay, estilo de advertencia.
- Confirmación en dos pasos: primer toque → "¿Borrar todas tus partituras y audios de este dispositivo? No se puede
  deshacer." con botones "Hacer copia primero" y "Borrar todo"; segundo → `deleteDatabase()` y recarga.

---

## 17. Audios guardados (F14, *Could*)

Solo con `features.audioUpload`. Detalle de captura en la spec `ear` (21). En `library`:

| Función | Detalle |
|---|---|
| Guardar | `audio` store: `{id, scoreId, fileName, mimeType, sizeBytes, durationSec, blob, createdAt}` |
| Cuota | 20 MB por archivo, 200 MB total (suma de `sizeBytes`) |
| Mostrar | En la fila de la partitura, icono 🎵 "con audio" |
| Borrar | Al purgar la partitura (5) o desde el menú ⋯ "Quitar audio guardado" |
| Respaldo | Opcional (11.1) |

---

## 18. Máquinas de estado

### 18.1 Guardado

Ver `technical-decisions.md` 12.4. Estados: `unsaved` → (cambio) → dirty → `saving` → `saved` / `error`. Desde
`error`, el siguiente cambio reintenta.

### 18.2 Restauración

```
 Inactivo ─elegir archivo─► Leyendo ─ok─► Validando ─ok─► Fusionando ─ok─► Informe ─► Inactivo
                              │              │                 │
                              └──────────────┴───── error ─────┴──► Error (mensaje) ─► Inactivo
```

### 18.3 Partitura respecto a la papelera

```
 activa ──mover a papelera──► en papelera ──30 días──► purgada
   ▲                              │
   └──── restaurar / editar ──────┘
```

---

## 19. Validaciones

| ID | Regla |
|---|---|
| L1 | Toda escritura pasa `validateScore` |
| L2 | Toda lectura pasa `validateScore`; inválidas se omiten (5.1) |
| L3 | Título ≤ 120 (duplicar recorta "(copia)" si hace falta) |
| L4 | Respaldo: `format`, `version`, tamaño, cada partitura válida |
| L5 | Audio: `mimeType` `audio/*` o `video/*`, tamaño y cuota |
| L6 | Ids: UUID v4 (`crypto.randomUUID`); ids de respaldos se aceptan si cumplen `^[0-9a-f-]{36}$` |

---

## 20. Edge cases

| # | Caso | Esperado |
|---|---|---|
| B1 | Primera visita | Abre Himno de la alegría, sin guardar; "Mis partituras" vacía |
| B2 | Abrir un ejemplo y cerrarlo sin tocar | No aparece en la lista |
| B3 | Abrir un ejemplo y cambiar el título | Se guarda como partitura nueva |
| B4 | Recargar la página | Abre la última partitura editada |
| B5 | La última partitura fue purgada | Abre el ejemplo |
| B6 | Cambiar de app en el celular a los 300 ms de editar | Flush por `visibilitychange`: se guarda |
| B7 | Cuota llena al guardar | Estado error + mensaje; no se reemplaza la partitura al abrir otra |
| B8 | Modo privado de Safari (IndexedDB disponible pero efímero) | Funciona; los datos se borran al cerrar (el navegador lo decide; aviso no detectable de forma fiable) |
| B9 | Navegador integrado sin IndexedDB | Modo memoria con aviso |
| B10 | Dos pestañas con la misma partitura | Aviso 14.2 |
| B11 | Otra pestaña actualiza la versión de la base | `versionchange` → aviso de recargar |
| B12 | Restaurar la misma copia dos veces | Segunda vez: todo "sin cambios" |
| B13 | Restaurar copia con una partitura corrupta | Se omite y se informa; el resto se restaura |
| B14 | Restaurar un .json suelto (sin ZIP) | Aceptado |
| B15 | Restaurar un ZIP que no es de Atril | "Ese archivo no es una copia de Atril." |
| B16 | Restaurar copia de versión futura | Mensaje de actualizar |
| B17 | Restaurar copia con la partitura abierta más nueva en la copia | Ofrece "Abrir la versión restaurada" |
| B18 | Mover a la papelera la partitura abierta y editarla | Se restaura sola + aviso |
| B19 | Duplicar una partitura de 120 caracteres de título | Título recortado + "(copia)" |
| B20 | 500 partituras | Lista fluida (≤ 100 ms carga; virtualización si > 200) |
| B21 | Fecha del dispositivo mal configurada (año 2000) | Funciona; el orden puede ser raro; la fusión del respaldo usa `updatedAt` tal cual (limitación documentada) |
| B22 | Borrar todo | Base eliminada, recarga, primera visita |
| B23 | iPhone, app instalada en la pantalla de inicio | No se muestra la sugerencia de instalar |
| B24 | Abrir resultado de "De oído" | `prepareReplace` → la anterior queda guardada → toast |
| B25 | Usuario de legacy | Ayuda: abrir sus ZIP "para MuseScore" |

---

## 21. Errores y mensajes

| AppError | Mensaje |
|---|---|
| storage_unavailable | "En esta ventana tus partituras no se guardan. Usa una ventana normal del navegador, o descarga tu trabajo (PDF o «Descargar para MuseScore»)." |
| storage_quota | "No queda espacio en este dispositivo. Borra partituras o audios guardados, o haz una copia de respaldo." |
| backup_invalid | "Ese archivo no es una copia de Atril." / "La copia está dañada." / mensaje de versión futura |
| backup_too_large | "La copia es demasiado grande (máximo 300 MB)." |
| internal | "No se pudo completar la acción. Inténtalo de nuevo." |

Mensajes de éxito (toast 4 s): "Se creó una copia", "Se movió a la papelera", "Se restauró", "Copia lista: N
partituras.", "Restaurada: …".

---

## 22. Accesibilidad

- Overlay con `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título; foco atrapado; Escape cierra; foco
  devuelto al abrir/cerrar.
- Segmentado Partituras/Papelera con `role="tablist"`/`tab`/`tabpanel`.
- Cada fila es un `<li>` con botones etiquetados: "Abrir Cielito lindo", "Más opciones para Cielito lindo".
- Menú ⋯ con `aria-haspopup="menu"`, navegación con flechas.
- Informe de restauración en `aria-live="polite"`.

---

## 23. Performance

| Operación | Objetivo |
|---|---|
| `bootLibrary` hasta tener partitura | ≤ 150 ms |
| Guardado automático (3 000 notas) | ≤ 30 ms |
| `list()` con 200 partituras | ≤ 100 ms |
| Abrir overlay con 200 partituras | ≤ 150 ms hasta primer render |
| Hacer copia de 200 partituras sin audios | ≤ 1 s |
| Restaurar copia de 200 partituras | ≤ 2 s |

`list()` lee registros completos (incluye notas) porque IndexedDB no proyecta campos; con > 500 partituras se
agregará un store `summaries` (Q4).

---

## 24. Testing scenarios

Todos con `fake-indexeddb` en Vitest salvo E2E.

### 24.1 idb

| ID | Escenario | Esperado |
|---|---|---|
| T-IDB-01 | Primera apertura | Stores `scores`, `audio`, `prefs` e índices creados |
| T-IDB-02 | Reapertura | Sin migraciones |
| T-IDB-03 | `onblocked` | Evento emitido |
| T-IDB-04 | `versionchange` | db cerrada + aviso |
| T-IDB-05 | No disponible | `isIndexedDbAvailable() === false` |

### 24.2 Repositorio

| ID | Escenario | Esperado |
|---|---|---|
| T-REP-01 | save + get | Igual (con `savedAt`) |
| T-REP-02 | save dos veces | `createdAt` fijo, `updatedAt` cambia |
| T-REP-03 | list orden | Por `updatedAt` desc, sin papelera |
| T-REP-04 | softDelete / listTrash / restore | Correcto |
| T-REP-05 | purge borra audios asociados | Sí |
| T-REP-06 | purgeExpired(30) | Solo los vencidos |
| T-REP-07 | duplicate | id nuevo, título "(copia)", fechas nuevas |
| T-REP-08 | Registro inválido en la base | Omitido en list, `get` → null |
| T-REP-09 | QuotaExceeded simulado | `storage_quota` |

### 24.3 Guardado automático

| ID | Escenario | Esperado |
|---|---|---|
| T-AUT-01 | 5 cambios en 500 ms | 1 guardado a los 800 ms del último |
| T-AUT-02 | Ejemplo sin cambios | 0 guardados |
| T-AUT-03 | `visibilitychange: hidden` con guardado pendiente | Guardado inmediato |
| T-AUT-04 | Cambio durante un guardado | Segundo guardado al terminar |
| T-AUT-05 | Tras guardar | `markSaved`, `lastOpenId`, invalidación, mensaje `saved` al canal |
| T-AUT-06 | prepareReplace con error de cuota | Devuelve false; no se reemplaza |
| T-AUT-07 | Editar partitura en papelera | `deletedAt = null` + aviso |

### 24.4 Respaldo

| ID | Escenario | Esperado |
|---|---|---|
| T-BAK-01 | Ida y vuelta en base limpia | Todas iguales |
| T-BAK-02 | Fusión: nueva / más reciente / más vieja / igual | added / updated / unchanged / unchanged |
| T-BAK-03 | Partitura inválida en la copia | invalid + resto restaurado |
| T-BAK-04 | `format` distinto, `version: 2` | Mensajes 21 |
| T-BAK-05 | JSON suelto | Aceptado |
| T-BAK-06 | ZIP bomb | Rechazado sin descomprimir |
| T-BAK-07 | Con audios | Blobs restaurados y asociados |
| T-BAK-08 | Nombre de archivo con fecha local | `atril-respaldo-AAAA-MM-DD.zip` |
| T-BAK-09 | `lastBackupAt` actualizado | Sí |

### 24.5 Durabilidad y pestañas

| ID | Escenario | Esperado |
|---|---|---|
| T-DUR-01 | `storage.persist` se pide una sola vez | Sí |
| T-DUR-02 | Sugerencia iOS: condiciones 13.2 | Se muestra / no se muestra |
| T-DUR-03 | Recordatorio de copia: condiciones 13.4 | Se muestra / no se muestra |
| T-TAB-01 | Dos canales simulados con la misma partitura | Aviso |
| T-TAB-02 | `saved` de otra pestaña | Lista invalidada; aviso si es la misma |
| T-TAB-03 | Sin `BroadcastChannel` | Sin errores |

### 24.6 Componentes

| ID | Escenario |
|---|---|
| T-UI-01 | Lista vacía muestra el texto de ayuda |
| T-UI-02 | Fechas "hoy, 14:05" / "18 oct" / "18 oct 2025" |
| T-UI-03 | "Abrir" deshabilitado en la partitura actual |
| T-UI-04 | Mover a la papelera + Deshacer en 5 s |
| T-UI-05 | Borrar para siempre con segundo toque |
| T-UI-06 | Borrar todo en dos pasos |
| T-UI-07 | Modo memoria: aviso persistente y respaldo deshabilitado |
| T-UI-08 | SaveBadge en sus 4 estados |
| T-UI-09 | axe sin violaciones en el overlay |

### 24.7 E2E

| ID | Flujo | Navegadores |
|---|---|---|
| E2E-LIB-01 | Escribir 3 notas → recargar → siguen ahí y está en "Mis partituras" | Chromium, WebKit móvil |
| E2E-LIB-02 | Abrir ejemplo sin tocar → no aparece en la lista | Chromium |
| E2E-LIB-03 | Hacer copia en contexto A → restaurar en contexto B limpio → mismas partituras | Chromium |
| E2E-LIB-04 | Papelera: mover, restaurar, borrar para siempre | Chromium |
| E2E-LIB-05 | Dos pestañas con la misma partitura → aviso | Chromium |
| E2E-LIB-06 | Interceptar red: ninguna petición al guardar, hacer copia o restaurar | Chromium |

---

## 25. Quality Gates

| Métrica | Umbral |
|---|---|
| Cobertura `infra/idb.ts`, `services/*` | ≥ 90 % |
| Cobertura `components/*`, `hooks/*` | ≥ 80 % |
| Formato de respaldo | Test de compatibilidad con un archivo fijo `tests/fixtures/backup-v1.zip` (no debe romperse nunca) |
| Migraciones | Test por versión |
| Privacidad | E2E-LIB-06 verde |
| Complejidad por función | ≤ 10 |

---

## 26. Trazabilidad

| Historia | Criterio | Sección | Tests |
|---|---|---|---|
| US-L01 | Recordar lo que escribía sin cuenta | 6, 7.1 | T-AUT-*, E2E-LIB-01 |
| US-L02 | Sin login nunca | 1, R3 | Revisión: no existe UI de login |
| US-L03 | Ver y abrir mis partituras | 5, 8 | T-REP-03, T-UI-01..03 |
| US-L04 | Guardado automático, ejemplos sin tocar fuera de la lista | 6 | T-AUT-01/02, E2E-LIB-02 |
| US-L05 | Pasar a otro dispositivo con respaldo + recordatorio | 11, 12, 13.4 | T-BAK-*, T-DUR-03, E2E-LIB-03 |
| US-L06 | Papelera 30 días | 9 | T-REP-04/06, E2E-LIB-04 |
| US-L07 | Duplicar | 5, 8.3 | T-REP-07 |
| US-W09 CA2 | La actual queda guardada al crear otra | 7.2 | T-AUT-06 |
| US-F07 | Ejemplos (incluida La cucaracha) | 10 | T-UI ejemplos |

---

## 27. Diferencias intencionales con legacy

| # | Legacy | Nuevo | Motivo |
|---|---|---|---|
| D1 | `localStorage` (5 MB, síncrono, se pierde con facilidad) | IndexedDB + persistencia | Deuda 1 |
| D2 | Botón "Guardar" + guardado silencioso al cambiar de partitura | Guardado automático con indicador | Claridad |
| D3 | Borrar es definitivo | Papelera 30 días | US-L06 |
| D4 | Sin duplicar | Duplicar | US-L07 |
| D5 | Sin forma de pasar a otro dispositivo | Respaldo en archivo | US-L05 sin login |
| D6 | Sin protección contra borrado del navegador | persist + instalar + recordatorio | RK9 |
| D7 | Fecha "18 oct" siempre | Hoy con hora; otro año con año | Claridad |
| D8 | Sin aviso de varias pestañas | BroadcastChannel | Evitar pérdidas |
| D9 | `innerHTML` con escape manual | React | Seguridad |

---

## 28. Preguntas abiertas

| ID | Pregunta | Propuesta por defecto |
|---|---|---|
| Q1 | ~~`loadedRevision` en el store del editor~~ | **Resuelta:** agregado a la spec del editor (3.2, 4.15) |
| Q2 | ¿Service worker para que la app abra sin conexión? | No en el MVP; post-MVP junto con PWA completa |
| Q3 | Virtualizar la lista desde cuántas filas | 200 |
| Q4 | Store `summaries` para listas muy grandes | Solo si se superan 500 partituras |
| Q5 | ¿Pedir confirmación al restaurar si hay partituras locales más nuevas que se conservarán? | No: el informe lo explica |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Spec Writer
