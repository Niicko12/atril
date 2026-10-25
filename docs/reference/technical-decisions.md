---
name: atril-technical-decisions
status: in-progress
created: 2026-10-18T12:11:33Z
updated: 2026-10-18T13:03:42Z
---

# Technical Decisions - Atril

**Estado:** 🟡 En Progreso (arquitectura completa; faltan specs de módulos)
**Última actualización:** 2026-10-18
**Autor:** Technical Architect (Oden Forge)

---

## Índice

1. Visión General
2. Stack Tecnológico
3. Features V1 (MVP)
4. Integraciones
5. Competidores a Analizar
6. Arquitectura
7. Persistencia local (IndexedDB)
8. Interfaces TypeScript
9. Code Structure Guidelines
10. Internal Organization Patterns
11. Patrones de Arquitectura
12. Máquinas de Estado
13. Seguridad
14. APIs
15. Performance
16. Testing Requirements per Layer
17. Quality Enforcement Rules
18. Resolución de la deuda de legacy
19. Dependencias y Riesgos
20. Glosario
21. Próximos Pasos

---

## 1. Visión General

### 1.1 Descripción

Atril es un editor de partituras para músicos aficionados y estudiantes de habla hispana. Permite:

- **Escribir** una melodía con un piano en pantalla, un diapasón, botones Do-Re-Mi o el teclado de la computadora.
- **Escuchar** la melodía con un sintetizador que imita la familia del instrumento elegido.
- **Transportar** automáticamente para instrumentos transpositores (Si♭, Mi♭, Fa, octava) y avisar de notas fuera
  de rango.
- **Abrir** partituras existentes (MusicXML, .mxl, MIDI, ABC) y **exportarlas** (PDF, PNG, texto ABC).
- **Sacar canciones de oído** a partir de un audio: detección de tono de una voz sola, melodía principal de una mezcla,
  o separación melodía/bajo/acordes con el modelo Basic Pitch ejecutado en el navegador.
- **Guardar** sus partituras automáticamente en su propio dispositivo, sin cuenta ni login, y moverlas a otro
  dispositivo con un archivo de respaldo.

Existe una versión funcional como artifact de Claude (HTML único, ~2 000 líneas), guardada en `legacy/index.html`
junto con el modelo Basic Pitch (`legacy/bp-model.json`). Este proyecto la migra a una aplicación independiente,
manteniendo la paridad de funcionalidades y corrigiendo la deuda técnica detectada (sección 18).

### 1.2 Objetivo Principal

- **Tipo de producto:** productividad / herramienta creativa.
- **Acceso principal:** navegador móvil (iPhone y Android). Escritorio como canal secundario con soporte completo de
  teclado.
- **Usuario objetivo:** músico aficionado o estudiante que lee poco o nada de partitura, que necesita la parte de su
  instrumento (p. ej. saxofón alto) de una melodía que conoce o que escuchó.

### 1.3 Scope

- **Modalidad:** MVP.
- **Timeline estimado:** 6-8 semanas.
- **Principio rector:** primero la funcionalidad base, después las mejoras.
- **Monofónico:** una sola voz por partitura en el MVP. Los acordes existen solo como etiquetas de texto encima de
  las notas (cifrado), igual que en legacy.

### 1.4 Restricciones duras

| ID | Restricción | Motivo |
|---|---|---|
| R1 | No usar la API de Claude/Anthropic ni ninguna IA externa | Decisión del usuario 2026-10-18 |
| R2 | Toda la lógica musical y de audio corre en el navegador | Sin servidor propio; privacidad del audio |
| R3 | **Sin login ni cuentas.** No hay usuarios, contraseñas, OAuth ni identidad | Decisión del usuario 2026-10-18 |
| R4 | UI y textos en español | Público objetivo |
| R5 | `legacy/index.html` no se modifica | Es la referencia del comportamiento |
| R6 | Licencias compatibles con uso comercial (MIT, Apache-2.0, BSD) | Basic Pitch es Apache-2.0, abcjs es MIT |
| R7 | **Todo con planes gratuitos (US$0/mes):** GitHub (repositorio + Actions) y Vercel Hobby. Sin backend | Decisión del usuario 2026-10-18 (ver 2.5) |
| R8 | Código en GitHub y despliegue en Vercel desde `main` | Decisión del usuario 2026-10-18 |

### 1.5 No-objetivos del MVP

- Edición polifónica (varias voces, acordes en el pentagrama, sistemas de piano a dos manos).
- Tresillos al escribir, ligaduras manuales, letra, repeticiones, casillas, dinámicas, articulaciones.
- Colaboración en tiempo real o compartir partituras públicas.
- Sincronización automática entre dispositivos (requeriría identidad; ver R3). Se reemplaza por el respaldo en archivo.
- App nativa o instalable (PWA completa queda para después; sí se guarda un borrador local).
- "Pedir melodía a Claude" (eliminado por R1).

---

## 2. Stack Tecnológico

### 2.1 Frontend

| Pieza | Elección | Justificación |
|---|---|---|
| Lenguaje | TypeScript (strict) | El núcleo musical tiene muchas unidades (MIDI, 1/16, quintas); los tipos evitan mezclarlas |
| UI | React 18 | Ecosistema, conocimiento del equipo, Testing Library |
| Build | Vite 5 | Arranque y HMR rápidos, Web Workers con `?worker`, code splitting simple |
| Estado global | Zustand | Store pequeño y explícito para la partitura; middleware simple para deshacer |
| Datos remotos | TanStack Query 5 | Caché, reintentos y estados de carga para "Mis partituras" |
| Render de partitura | abcjs 6.4.4 | Ya probado en legacy: pentagrama, tablatura, clic en notas, clases CSS |
| IA de audio | TensorFlow.js 3.21 + Basic Pitch | El modelo actual fue convertido con TF.js Converter 3.13 (graph-model) |
| Archivos | JSZip 3.10, jsPDF 2.5 | Ya usados en legacy; carga diferida |
| Estilos | CSS Modules + tokens CSS | Portar los tokens de legacy (`--accent`, `--paper`, etc.) sin una librería de UI |
| Router | Ninguno en el MVP | Una sola pantalla con paneles; se evalúa React Router si crece |

### 2.2 Backend

**No hay backend** (decisión 2026-10-18: sin login, R3). Consecuencias:

| Antes (con Supabase) | Ahora |
|---|---|
| Postgres con tabla `scores` por usuario | IndexedDB en el navegador del usuario (sección 7) |
| Supabase Auth | Nada: no hay identidad |
| Supabase Storage para audios (F14) | Audio guardado en IndexedDB del dispositivo (F14 pasa a ser local) |
| Sincronización entre dispositivos | Archivo de respaldo exportable/importable (F09) |
| RLS, migraciones SQL, pgTAP | No aplica |

La app es un **sitio 100 % estático**: HTML, JS, CSS, el modelo de Basic Pitch y fuentes.

### 2.3 Hosting

- **Plataforma:** Vercel plan **Hobby (gratis)**, sitio estático (salida de `vite build`), sin funciones de servidor.
- **Repositorio:** GitHub `Niicko12/atril` (público), conectado a Vercel por la integración de Git.
- **Justificación:** despliegue por push, preview por rama, CDN global para el modelo y las librerías.
- **Dominios/entornos:**
  - `main` → producción.
  - Cualquier otra rama → preview.
- **Variables de entorno:** ninguna. No hay secretos ni servicios externos.

### 2.4 Herramientas de desarrollo

| Herramienta | Uso |
|---|---|
| npm | Gestor de paquetes (ya instalado con Node; sin herramientas globales extra) |
| ESLint (typescript-eslint, react-hooks, import) | Reglas de estructura (sección 17) |
| Prettier | Formato |
| Vitest | Unit tests del núcleo y de hooks |
| Testing Library | Tests de componentes |
| Playwright | E2E en Chromium y WebKit (iPhone) |
| dependency-cruiser | Validar dirección de capas y ciclos |
| fake-indexeddb | IndexedDB en tests de Node |

> Las versiones exactas se fijan en `package.json` al crear el proyecto y se registran en `docs/development/current/`.

### 2.5 Costos: todo en planes gratuitos (R7)

| Servicio | Plan | Límites relevantes (verificar en la página oficial) | Cómo se respeta |
|---|---|---|---|
| GitHub | Free | Repos privados ilimitados; Actions ~2 000 min/mes en repos privados | CI corta (Playwright solo en PR a `main`); si se agotan los minutos, hacer el repo público o correr E2E local |
| Vercel | Hobby | Uso personal / no comercial; ancho de banda mensual limitado | Sitio estático, modelo con caché inmutable; si Atril se monetiza hay que pasar a un plan pago (decisión futura) |
| Dominio | Subdominio gratis `*.vercel.app` | — | Sin dominio propio en el MVP |
| Backend / base de datos / login | — | No existen | R3 |

Costo total: **US$0/mes**, sin cuentas de terceros además de GitHub y Vercel.

### 2.6 Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir como artifact | El usuario quiere una app propia, independiente de Claude, en GitHub y Vercel |
| Next.js | No se necesita SEO ni SSR en el MVP; añade complejidad de servidor |
| VexFlow / OpenSheetMusicDisplay | Más potentes para polifonía, pero abcjs ya resuelve el MVP y la conversión a ABC existe |
| Redux Toolkit | Más ceremonia que Zustand para un store principal |
| Supabase / Firebase | Requieren identidad para separar datos de usuarios; el usuario no quiere login (R3) |
| Login anónimo (Supabase anonymous sign-in) | Da identidad por dispositivo, que es lo mismo que IndexedDB pero con servidor, costo de mantenimiento y sin sincronizar entre equipos |
| Tone.js | El sintetizador propio de legacy ya está afinado; añadirlo duplicaría lógica |
| Spotify Basic Pitch npm (`@spotify/basic-pitch`) | Válido; se evalúa en semana 1. Si funciona con el modelo empaquetado, reemplaza el código minificado embebido |

---

## 3. Features V1 (MVP)

### 3.1 Lista priorizada

| ID | Feature | Prioridad | Paridad legacy | Cambios respecto a legacy |
|---|---|---|---|---|
| F01 | Editor monofónico: piano, diapasón, Do-Re-Mi, teclado de computadora | Must | Sí | Deshacer completo (F10) |
| F02 | 19 instrumentos con transposición, rango y tablatura | Must | Sí | + Flauta dulce soprano (aprobada 2026-10-18) |
| F03 | Vista "para el instrumento" / "sonido real", nombres de notas | Must | Sí | — |
| F04 | Reproducción sintetizada por familia, resaltado de nota en curso | Must | Sí | Motor en módulo propio |
| F05 | Importar MusicXML/.mxl/MIDI/ABC | Must | Sí | Corrige deuda 2, 3, 9 |
| F06 | Exportar PDF, PNG y ABC | Must | Sí | Descarga nativa del navegador |
| F07 | De oído: YIN (voz sola), melodía en mezcla, Basic Pitch (partes) | Must | Sí | En Web Worker; corrige deuda 4, 5, 6 |
| F08 | Reproductor de audio: onda, A-B, velocidad sin cambio de tono | Must | Sí | WSOLA en Worker |
| F09 | "Mis partituras" con guardado automático en el dispositivo + respaldo en archivo | Must | Parcial (era localStorage) | Corrige deuda 1 sin login (R3) |
| F10 | Deshacer/rehacer completo (notas + metadatos) | Must | Parcial | Corrige deuda 8 |
| F11 | Recordar la partitura abierta al volver | Must | Sí | IndexedDB en vez de localStorage |
| F12 | Ejemplos de dominio público | Should | Sí | + "La cucaracha" (tradicional mexicana, aprobado 2026-10-18) |
| F13 | Enlaces a sitios de partituras | Should | Sí | — |
| F14 | Guardar el audio original junto a la partitura | Could | No | En IndexedDB del dispositivo; solo si sobra tiempo |
| F15 | Aviso al recortar notas en "Mover todo" | Must | No | Corrige deuda 7 |
| F16 | La partitura sigue al audio original en "De oído" (US-E09) | Should | No | Aprobado 2026-10-18 |
| F17 | Compartir PDF/imagen con el menú del sistema (WhatsApp) | Should | No | Aprobado 2026-10-18 |

### 3.2 Ejemplos incluidos (F12)

Formato `MIDI:duración` (duración en semicorcheas, `r` = silencio), igual que `seq()` de legacy. Van en
`src/core/score/samples.ts`.

| Título | Compositor | Tonalidad | Compás | Tempo | Origen |
|---|---|---|---|---|---|
| Himno de la alegría | L. van Beethoven | Do | 4/4 | 100 | Legacy |
| Estrellita | Tradicional | Do | 4/4 | 96 | Legacy |
| Escala de Sol mayor | Ejercicio | Sol | 4/4 | 80 | Legacy |
| La cucaracha | Tradicional mexicana | Sol (1) | 4/4 | 120 | Nuevo (aprobado 2026-10-18) |

"La cucaracha" — **transcripción propia** de la melodía tradicional (dominio público). No se copió ninguna
transcripción publicada. La anacrusa ("la cu-ca-") se escribe dentro del compás porque el MVP no soporta anacrusa.
**Verificar al oído en la app antes de publicarla** (tarea en el plan):

```
62:2 62:2 62:2 67:6 71:4
62:2 62:2 62:2 67:6 71:4
67:2 67:2 66:2 66:2 64:2 64:2 62:4
62:2 62:2 62:2 66:6 69:4
62:2 62:2 62:2 66:6 69:4
69:2 69:2 67:2 67:2 66:2 66:2 67:4
67:16
```

Se descartó "Cielito lindo": su autor (Quirino Mendoza y Cortés) murió en 1957 y en México los derechos patrimoniales
duran 100 años tras la muerte del autor.

### 3.3 Criterio para F14

F14 entra solo si al terminar la semana 5 el resto de Must está aprobado. El store `audio` de IndexedDB (7.3) se
crea desde la versión 1 de la base para no migrar después; la UI queda oculta tras el flag `features.audioUpload`.

## 4. Integraciones

| Servicio | Uso | Notas |
|---|---|---|
| GitHub | Repositorio público `Niicko12/atril` y CI | Gratis |
| Vercel | Hosting estático, despliegue al hacer push a `main` | Hobby, gratis |
| Backend / login / IA externa | **Ninguno** (R1, R3) | Basic Pitch corre local |

## 5. Competidores a Analizar

- MuseScore / musescore.com
- Flat.io
- Noteflight
- Soundslice / Moises

[Pendiente: /oden:analyze]

---

## 6. Arquitectura

### 6.1 Vista de alto nivel

```
┌────────────────────────────── Navegador ──────────────────────────────┐
│                                                                       │
│  ┌─────────────────────── UI (React) ───────────────────────┐         │
│  │  AppShell                                                │         │
│  │  ├─ ScoreMetaForm   ├─ ViewBar      ├─ ScoreSheet (abcjs)│         │
│  │  ├─ EarPanel        ├─ ExportBar    ├─ InputDock          │         │
│  │  └─ Overlays: Find/Open · Library · Image · Backup       │         │
│  └───────────────┬──────────────────────────────────────────┘         │
│                  │ hooks                                              │
│  ┌───────────────▼──────────── Business ─────────────────────┐        │
│  │ score-store (Zustand + history)   playback-engine          │        │
│  │ library-service (TanStack Query)  ear-service ──┐          │        │
│  │ import-service  export-service    draft-service │          │        │
│  └───────┬───────────────────────────────┬─────────┼──────────┘        │
│          │                               │         │ postMessage       │
│  ┌───────▼────────── Core (puro) ─────┐  │  ┌──────▼─────────────┐     │
│  │ theory · instruments · measures    │  │  │ Workers            │     │
│  │ abc-builder · musicxml · midi      │  │  │ pitch.worker (YIN, │     │
│  │ importers · quantize · key/tempo   │◄─┼──┤ mezcla, cuantizar) │     │
│  │ chords · skyline                   │  │  │ basic-pitch.worker │     │
│  └────────────────────────────────────┘  │  │ (TF.js)            │     │
│                                          │  │ stretch.worker     │     │
│  Web Audio API ◄── playback-engine       │  │ (WSOLA)            │     │
│  IndexedDB ◄────── library (partituras,  │  └────────────────────┘     │
│                    preferencias, audios) │                             │
└──────────────────────────────────────────┼─────────────────────────────┘
                                           │
                                (sin servidor: sitio estático en Vercel;
                                 los datos nunca salen del dispositivo)
```

### 6.2 Capas

| Capa | Carpeta | Contenido | Puede importar |
|---|---|---|---|
| UI | `src/modules/*/components`, `src/app` | Componentes React | Business, Core, Shared |
| Business | `src/modules/*/hooks`, `*/services`, `*/store` | Estado, efectos, IO | Core, Shared, Data |
| Workers | `src/workers` | Cómputo pesado | Core |
| Core | `src/core` | Funciones puras sin DOM ni React | Solo Core |
| Data/Infra | `src/infra` | IndexedDB, descargas, compartir | Shared types |
| Shared | `src/shared` | Componentes UI genéricos, utils, tipos comunes | Shared |

Regla central: **`src/core` no importa nada fuera de `src/core`**, ni `window`, ni `document`, ni React. Así se
ejecuta igual en el hilo principal, en Workers y en Node (tests).

### 6.3 Flujo de datos: escribir una nota

```
pointerdown en tecla (InputDock)
  → useNoteInput.enter(midi)
     → playbackEngine.preview(midi, instrument.timbre)      (sonido inmediato, < 30 ms)
     → scoreStore.addNote(midi)                              (acción con historial)
         → si hay selección: reemplaza tono y avanza
         → si no: agrega {p, d: duraciónActual}
  → ScoreSheet se suscribe a (notes, meta, view)
     → core.buildAbc(score, instrument, view) memoizado
     → abcjs.renderAbc (debounce por frame: requestAnimationFrame)
     → reconstruye noteElementMap (índice de nota → elementos SVG)
  → library.autosave(score)  (debounce 800 ms, IndexedDB; ver 11.4)
```

### 6.4 Flujo de datos: De oído (partes)

```
EarPanel: usuario elige archivo
  → decodeAudioData (hilo principal; requisito de Web Audio)
  → mezcla a mono Float32Array → transferible
EarPanel: "Escribir la melodía sola" con modo "parts"
  → earService.analyzeParts(region)
     → basic-pitch.worker: carga TF.js + modelo (una vez, caché)
        → remuestreo a 22 050 Hz (OfflineAudioContext en hilo principal, antes de enviar)
        → evaluateModel → eventos polifónicos
        → progreso por postMessage {type:'progress', value}
     ← {events}
     → core: skyline(melodía), skyline(bajo), guessTempo, guessKey, chordsFor
  → EarPanel muestra partes → "Abrir" → core.quantize → scoreStore.replaceScore(importado)
```

### 6.5 Flujo de datos: guardado automático y respaldo

```
Cualquier cambio en la partitura (revision++)
  → library.autosave (debounce 800 ms)
     → si la partitura nunca se editó (ejemplo intacto): no se guarda
     → si no: put en IndexedDB `scores` con updatedAt = ahora
     → indicador "Guardada en este dispositivo"
"Mis partituras" → "Hacer copia de respaldo"
  → leer todos los scores (y audios si F14) → ZIP `atril-respaldo-AAAA-MM-DD.zip` → descargar o compartir
Otro dispositivo → "Mis partituras" → "Restaurar copia"
  → leer ZIP → validar → fusionar por id (gana la de updatedAt más reciente) → informe "N nuevas, M actualizadas"
```

### 6.6 Estructura de carpetas

```
atril/
├── legacy/                       # Referencia; no se modifica
├── docs/
├── public/
│   └── models/basic-pitch/
│       ├── model.json            # topología + manifest (sin base64)
│       └── group1-shard1of1.bin  # pesos binarios (~742 KB)
├── scripts/
│   ├── split-bp-model.mjs        # convierte legacy/bp-model.json → public/models/...
│   └── legacy-fixtures.mjs       # genera fixtures dorados desde legacy (16.2)
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── app-shell.tsx
│   │   ├── providers.tsx         # QueryClient
│   │   └── theme.css             # tokens portados de legacy
│   ├── core/                     # PURO
│   │   ├── theory/
│   │   │   ├── spelling.ts       # spell, keyAcc, normF, nameOf, midiName
│   │   │   ├── keys.ts           # MAJ, MIN, ABCKEY
│   │   │   └── index.ts
│   │   ├── instruments/
│   │   │   ├── catalog.ts        # INSTR (19)
│   │   │   ├── clef.ts           # clefFor
│   │   │   └── index.ts
│   │   ├── rhythm/
│   │   │   ├── meters.ts         # METERS
│   │   │   ├── measures.ts       # toMeasures, splitDur
│   │   │   └── index.ts
│   │   ├── notation/
│   │   │   ├── abc-builder.ts    # buildAbc + charMap
│   │   │   ├── abc-escape.ts
│   │   │   └── index.ts
│   │   ├── formats/
│   │   │   ├── musicxml-export.ts
│   │   │   ├── musicxml-import.ts
│   │   │   ├── midi-export.ts
│   │   │   ├── midi-import.ts
│   │   │   ├── abc-import.ts     # parseAbcTune (recibe el árbol de abcjs)
│   │   │   └── index.ts
│   │   ├── analysis/
│   │   │   ├── yin.ts
│   │   │   ├── melody-mix.ts     # fft + saliencia + Viterbi
│   │   │   ├── segment.ts        # segmentNotes
│   │   │   ├── quantize.ts
│   │   │   ├── tempo.ts          # guessTempo
│   │   │   ├── key.ts            # guessKey (Krumhansl)
│   │   │   ├── skyline.ts
│   │   │   ├── chords.ts         # chordsFor, attachChords
│   │   │   ├── wsola.ts
│   │   │   └── index.ts
│   │   ├── score/
│   │   │   ├── score-ops.ts      # addNote, deleteNote, shiftAll... puros
│   │   │   ├── validate.ts       # validateScore
│   │   │   ├── samples.ts
│   │   │   └── index.ts
│   │   └── types/                # tipos de dominio (sección 8)
│   ├── workers/
│   │   ├── pitch.worker.ts
│   │   ├── basic-pitch.worker.ts
│   │   ├── stretch.worker.ts
│   │   └── protocol.ts           # tipos de mensajes
│   ├── infra/
│   │   ├── idb.ts                # base, versiones y migraciones (sección 7)
│   │   └── download.ts           # saveBlob, shareBlob
│   ├── modules/
│   │   ├── editor/               # store, input surfaces, tools
│   │   ├── score-view/           # ScoreSheet, status
│   │   ├── playback/             # motor Web Audio
│   │   ├── import/               # abrir archivos, pegar ABC, enlaces
│   │   ├── export/               # PDF, PNG, ABC
│   │   ├── ear/                  # De oído
│   │   └── library/              # Mis partituras, autoguardado, respaldo
│   └── shared/
│       ├── components/           # Button, Segmented, Overlay, Toast, Field
│       ├── hooks/                # useDebounce, useResizeWidth
│       ├── errors.ts
│       └── utils/
├── tests/
│   ├── fixtures/                 # .musicxml, .mid, .abc, audios cortos, dorados legacy
│   └── e2e/
├── CLAUDE.md
└── vercel.json
```

### 6.7 Decisiones de arquitectura clave (ADR resumidos)

| ADR | Decisión | Alternativa | Razón |
|---|---|---|---|
| ADR-001 | Mantener el modelo de notas de legacy `{p, d, c?}` en unidades de 1/16 | Modelo MusicXML completo | Paridad, simplicidad, migración directa de algoritmos; suficiente para monofonía |
| ADR-002 | ABC como representación intermedia para dibujar | Dibujar SVG propio | abcjs ya resuelve grabado, tablatura y clics |
| ADR-003 | Núcleo puro en `src/core` | Lógica en componentes | Testeable en Node y reutilizable en Workers |
| ADR-004 | Workers para todo análisis de audio | Hilo principal con `setTimeout` (legacy) | Evita congelar la UI en móviles (deuda 5) |
| ADR-005 | Cada partitura es un solo registro con sus notas | Notas en registros separados | Se leen y escriben siempre completas; ≤ 3 000 elementos |
| ADR-006 | Último guardado gana + aviso entre pestañas (BroadcastChannel) | Bloqueo por pestaña | Sin servidor no hay conflictos entre dispositivos; solo entre pestañas del mismo navegador |
| ADR-007 | Persistencia en IndexedDB | localStorage | Más cuota, asíncrono, guarda Blobs (audio), no bloquea el hilo |
| ADR-008 | Modelo Basic Pitch como archivos estáticos binarios | JSON con base64 (legacy) | −25 % de tamaño, caché HTTP, sin `atob` de 1 MB |
| ADR-009 | Sin router en el MVP | React Router | Una pantalla; los paneles son estado |
| ADR-010 | Sin login ni backend | Supabase con cuentas | R3 (decisión del usuario); privacidad; US$0 |
| ADR-012 | Respaldo en archivo para moverse entre dispositivos | Sincronización en la nube | No requiere identidad |
| ADR-013 | Pedir almacenamiento persistente y sugerir instalar en la pantalla de inicio | Nada | Safari puede borrar datos de sitios no visitados en 7 días (riesgo RK9) |
| ADR-014 | Basic Pitch: código de legacy vendorizado (`src/vendor/basic-pitch`, Apache-2.0) + TF.js **4.22 modular** (core, converter, backend-webgl, backend-cpu) | `@spotify/basic-pitch` npm | El paquete npm está abandonado (1.0.1 de 2022, arrastra TF.js 3 completo y @tonejs/midi). Spike 2026-10-18: en Chrome funciona en Worker con WebGL y con la CSP sin `unsafe-eval` |

---

## 7. Persistencia local (IndexedDB)

Sin backend (R3), los datos viven en **IndexedDB** del navegador, en el dispositivo del usuario. Esta sección
reemplaza el schema de Postgres que existía antes de la decisión del 2026-10-18.

### 7.1 Base de datos

| Propiedad | Valor |
|---|---|
| Nombre | `atril` |
| Versión inicial | 1 |
| Librería | Wrapper propio mínimo en `infra/idb.ts` sobre la API nativa (sin dependencias); `fake-indexeddb` en tests |
| Origen | Uno por dominio: producción (`*.vercel.app`) y cada preview tienen bases separadas |

### 7.2 Diagrama

```
┌──────────────┐ 1      N ┌──────────────┐
│   scores     │◄─────────│    audio     │   (F14, opcional)
│ (keyPath id) │ scoreId  │ (keyPath id) │
└──────────────┘          └──────────────┘
┌──────────────┐
│    prefs     │  clave-valor (inputMode, lastOpenId, backupReminder…)
└──────────────┘
```

### 7.3 Object stores

#### `scores`

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | string (UUID v4, `crypto.randomUUID()`) | Sí | keyPath |
| title | string ≤ 120 | Sí | "Sin título" si está vacío |
| composer | string ≤ 120 | Sí | Puede ser "" |
| instrumentId | InstrumentId | Sí | |
| key | −6..6 | Sí | Sonido real |
| meter | MeterId | Sí | |
| tempo | 30..240 | Sí | |
| showNames, showTab | boolean | Sí | |
| notes | Note[] ≤ 3 000 | Sí | Formato de legacy `{p, d, c?}` |
| source | ScoreSource | Sí | |
| createdAt, updatedAt | string ISO 8601 UTC | Sí | |
| deletedAt | string ISO 8601 \| null | Sí | Papelera |
| schemaVersion | number | Sí | Versión del formato del registro (1) |

Índices: `by_updated` (`updatedAt`), `by_deleted` (`deletedAt`).

#### `audio` (F14)

| Campo | Tipo | Descripción |
|---|---|---|
| id | string (UUID) | keyPath |
| scoreId | string | Índice `by_score` |
| fileName | string ≤ 200 | |
| mimeType | string | `audio/*` o `video/*` |
| sizeBytes | number ≤ 20 MB | |
| durationSec | number ≤ 900 | |
| blob | Blob | El audio original |
| createdAt | string ISO | |

Cuota propia: **200 MB en total** para audios; más → "El espacio para audios está lleno. Borra algún audio
guardado."

#### `prefs`

| Clave | Valor | Uso |
|---|---|---|
| `inputMode` | 'piano' \| 'fret' \| 'names' | Modo de entrada |
| `defaultInstrument` | InstrumentId | Instrumento de "Nueva" |
| `lastOpenId` | string \| null | Partitura que se abre al volver |
| `lastBackupAt` | string ISO \| null | Recordatorio de respaldo |
| `persistAsked` | boolean | Ya se pidió almacenamiento persistente |

### 7.4 Validación

`validateScore()` (core) se aplica **al leer** (registros corruptos o de versiones futuras se omiten y se informan en
diagnóstico) y **al escribir**. No hay constraints en la base: la validación vive en el código.

### 7.5 Migraciones

```typescript
// infra/idb.ts
const MIGRATIONS: Record<number, (db: IDBDatabase, tx: IDBTransaction) => void> = {
  1: (db) => {
    const scores = db.createObjectStore('scores', { keyPath: 'id' });
    scores.createIndex('by_updated', 'updatedAt');
    scores.createIndex('by_deleted', 'deletedAt');
    const audio = db.createObjectStore('audio', { keyPath: 'id' });
    audio.createIndex('by_score', 'scoreId');
    db.createObjectStore('prefs');
  },
};
```

- `onupgradeneeded` aplica en orden las migraciones entre la versión antigua y la nueva.
- `onblocked` (otra pestaña con la versión vieja abierta): aviso "Cierra las otras pestañas de Atril para
  actualizar."

### 7.6 Durabilidad (riesgo RK9)

Los navegadores pueden borrar datos de sitios en situaciones de poco espacio, y **Safari puede borrar el
almacenamiento de sitios que el usuario no visita en 7 días** (salvo apps agregadas a la pantalla de inicio).
Mitigaciones:

1. `navigator.storage.persist()` al guardar la primera partitura (una sola vez).
2. Manifiesto web mínimo (`manifest.webmanifest`, iconos) para poder **agregar Atril a la pantalla de inicio**; en
   iPhone se muestra una sugerencia para ayudar a conservar los datos, acompañada del recordatorio de mantener una
   copia de respaldo. La instalación no garantiza que el usuario no pierda sus datos.
3. Recordatorio de respaldo: si hay ≥ 1 partitura y `lastBackupAt` tiene más de 14 días, aviso discreto en "Mis
   partituras" con botón "Hacer copia".
4. Las exportaciones (PDF, ZIP MuseScore) siguen disponibles como respaldo individual.

### 7.7 Formato del archivo de respaldo

`atril-respaldo-AAAA-MM-DD.zip` (fflate):

```
atril-backup.json          # { format: "atril-backup", version: 1, exportedAt, scores: ScoreRecord[] }
audio/{id}.{ext}           # solo si F14 y el usuario marca "Incluir audios"
LEEME.txt                  # cómo restaurar
```

Restaurar:

| Regla | Detalle |
|---|---|
| Validación | `format === 'atril-backup'`, `version ≤ 1`, cada partitura pasa `validateScore` (las inválidas se omiten y se cuentan) |
| Fusión | Por `id`: si no existe → se agrega; si existe → gana la de `updatedAt` más reciente; empate → se conserva la local |
| Papelera | Se respeta `deletedAt` del más reciente |
| Informe | "Restaurada: N nuevas, M actualizadas, K sin cambios, E con errores." |
| Límite | Archivo ≤ 300 MB; JSON ≤ 20 MB |

### 7.8 Volumen esperado

| Métrica | Estimado | Holgura |
|---|---|---|
| Partituras por dispositivo | 5-200 | Índice por fecha |
| Tamaño por partitura | 2-60 KB | Límite 3 000 notas |
| Audios (F14) | < 20 | 20 MB c/u, 200 MB total |

## 8. Interfaces TypeScript

Todos los tipos de dominio viven en `src/core/types/` (un archivo por dominio, ≤ 200 líneas). El formato de registro
de IndexedDB (`ScoreRecord`) solo se usa en `src/modules/library` e `src/infra`: se convierte a tipos de dominio en
el mapper.

### 8.1 Unidades y primitivas (`core/types/units.ts`)

```typescript
/** Número de nota MIDI (21 = La0, 60 = Do4, 108 = Do8). */
export type Midi = number;

/** Duración en semicorcheas (1 = semicorchea, 4 = negra, 16 = redonda). Entero ≥ 1. */
export type Units16 = number;

/** Armadura en quintas: −6 (Sol♭ mayor) .. 6 (Fa♯ mayor). */
export type Fifths = -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Semitonos de transposición escrita respecto al sonido real (positivo = se escribe más agudo). */
export type Semitones = number;

/** Segundos de audio. */
export type Seconds = number;

/** Letra de nota en notación anglosajona. */
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** Alteración: −2 doble bemol .. 2 doble sostenido. */
export type Alter = -2 | -1 | 0 | 1 | 2;

export const MIDI_MIN = 21;
export const MIDI_MAX = 108;
export const MAX_NOTES = 3000;
export const TEMPO_MIN = 30;
export const TEMPO_MAX = 240;
```

### 8.2 Partitura (`core/types/score.ts`)

```typescript
import type { Midi, Units16, Fifths } from './units';

export type MeterId = '4/4' | '3/4' | '2/4' | '6/8' | '3/8' | '12/8';

/** Una nota o silencio. Compatible con el formato de legacy (ADR-001). */
export interface Note {
  /** Tono en sonido real; null = silencio. */
  p: Midi | null;
  /** Duración en semicorcheas. */
  d: Units16;
  /** Cifrado de acorde que se muestra encima (p. ej. "Lam7"). Opcional. */
  c?: string;
}

export interface ScoreMeta {
  title: string;
  composer: string;
  instrumentId: InstrumentId;
  /** Tonalidad en sonido real. */
  key: Fifths;
  meter: MeterId;
  tempo: number;
  showNames: boolean;
  showTab: boolean;
}

export type ScoreSource =
  | 'manual' | 'sample' | 'musicxml' | 'midi' | 'abc'
  | 'ear_solo' | 'ear_mix' | 'ear_parts';

/** Partitura en edición (lo que maneja el store). */
export interface Score extends ScoreMeta {
  /** ID estable (UUID); es también la clave en IndexedDB. */
  id: string;
  notes: Note[];
  source: ScoreSource;
  /** null hasta el primer guardado automático (p. ej. un ejemplo sin editar). */
  savedAt: string | null;
}

/** Fila resumida para "Mis partituras". */
export interface ScoreSummary {
  id: string;
  title: string;
  composer: string;
  instrumentId: InstrumentId;
  noteCount: number;
  updatedAt: string;
  deletedAt: string | null;
}

export type View = 'written' | 'concert';
```

### 8.3 Instrumentos (`core/types/instrument.ts`)

```typescript
import type { Midi, Semitones } from './units';

export type InstrumentId =
  | 'piano' | 'voz' | 'guitarra' | 'bajo' | 'ukulele'
  | 'violin' | 'viola' | 'cello' | 'contrabajo'
  | 'flauta' | 'oboe' | 'clarinete' | 'saxalto' | 'saxtenor'
  | 'trompeta' | 'corno' | 'trombon' | 'tuba';

export type Clef = 'treble' | 'bass' | 'alto';
export type ClefRule = Clef | 'auto';

/** Familia de timbre para el sintetizador. */
export type Timbre = 'piano' | 'voice' | 'guitar' | 'bass' | 'bow' | 'flute' | 'reed' | 'brass';

export type TabKind = 'guitar' | 'bass';

export interface Instrument {
  id: InstrumentId;
  /** Nombre visible en español. */
  name: string;
  /** Transposición escrita (ver Semitones). */
  transpose: Semitones;
  clef: ClefRule;
  /** Rango en sonido real. */
  low: Midi;
  high: Midi;
  timbre: Timbre;
  /** Programa General MIDI (0-127). */
  gmProgram: number;
  tab?: TabKind;
  /** Cuerdas al aire de aguda a grave, en sonido real. */
  strings?: Midi[];
  /** Nota visible, p. ej. "Escrita una octava arriba de como suena". */
  note?: string;
}
```

### 8.4 Teoría y notación (`core/types/notation.ts`)

```typescript
import type { Letter, Alter, Units16, Midi } from './units';

export interface Spelling {
  letter: Letter;
  alter: Alter;
  /** Octava científica (Do4 = Do central). */
  octave: number;
}

/** Fragmento de una nota dentro de un compás (una nota larga puede partirse y ligarse). */
export interface MeasurePart {
  /** Índice de la nota original en Score.notes. */
  idx: number;
  p: Midi | null;
  d: Units16;
  /** Primer fragmento de la nota original. */
  first: boolean;
  /** Último fragmento de la nota original. */
  last: boolean;
  /** Posición dentro del compás, en semicorcheas. */
  pos: Units16;
}

export type Measure = MeasurePart[];

export interface Meter {
  /** Semicorcheas por compás. */
  bar: Units16;
  /** Semicorcheas por pulso (agrupación de barras de corchea). */
  beat: Units16;
}

export interface AbcBuildOptions {
  names?: boolean;
  chords?: boolean;
}

export interface AbcBuildResult {
  abc: string;
  /** Posición de carácter en `abc` → índice de nota. */
  charMap: Map<number, number>;
  /** Armadura usada al escribir. */
  fifths: number;
  /** Transposición aplicada. */
  transpose: number;
}
```

### 8.5 Importación (`core/types/import.ts`)

```typescript
import type { Note, MeterId } from './score';
import type { Fifths } from './units';
import type { InstrumentId } from './instrument';

export type ImportFormat = 'musicxml' | 'mxl' | 'midi' | 'abc';

export interface ImportResult {
  title: string;
  composer: string;
  key: Fifths;
  meter: MeterId;
  tempo: number;
  notes: Note[];
  instrumentId: InstrumentId | null;
  /** Avisos no fatales para mostrar al usuario. */
  warnings: ImportWarning[];
}

export type ImportWarningCode =
  | 'truncated'          // se recortó a 3 000 notas
  | 'polyphony_reduced'  // había acordes o varias voces; se tomó la nota superior
  | 'tempo_changes'      // había cambios de tempo; se usó el primero
  | 'meter_changes'      // había cambios de compás; se usó el primero
  | 'unsupported_meter'  // compás no soportado; se aproximó
  | 'tuplets_rounded'    // tresillos redondeados a la rejilla de 1/16
  | 'pickup_padded';     // compás de anacrusa completado con silencio

export interface ImportWarning {
  code: ImportWarningCode;
  detail?: string;
}
```

### 8.6 Análisis de audio (`core/types/analysis.ts`)

```typescript
import type { Midi, Seconds, Fifths } from './units';
import type { InstrumentId } from './instrument';

/** Nota detectada antes de cuantizar. */
export interface RawNote {
  m: Midi;
  t0: Seconds;
  t1: Seconds;
}

/** Evento polifónico de Basic Pitch. */
export interface PolyEvent {
  p: Midi;
  s: Seconds;
  e: Seconds;
  /** Amplitud 0..1. */
  a: number;
}

export interface ChordLabel {
  /** Posición en semicorcheas desde el origen. */
  u: number;
  name: string;
}

export type EarMode = 'solo' | 'mix' | 'parts';

export interface AudioRegion {
  a: Seconds;
  b: Seconds;
  loop: boolean;
}

export interface DetectedPart {
  id: 'mel' | 'bass';
  name: string;
  description: string;
  raw: RawNote[];
  instrumentId: InstrumentId | null;
}

export interface PartsAnalysis {
  bpm: number;
  key: Fifths;
  origin: Seconds;
  chords: ChordLabel[];
  events: PolyEvent[];
  parts: DetectedPart[];
}

export interface MonoAnalysis {
  raw: RawNote[];
  bpm: number;
  key: Fifths;
}
```

### 8.7 Protocolo de Workers (`workers/protocol.ts`)

```typescript
import type { RawNote, PolyEvent, EarMode } from '../core/types/analysis';

export type WorkerRequest =
  | { id: string; type: 'detect'; mode: Exclude<EarMode, 'parts'>; samples: Float32Array; sampleRate: number }
  | { id: string; type: 'parts'; samples22k: Float32Array }
  | { id: string; type: 'stretch'; samples: Float32Array; sampleRate: number; speed: number }
  | { id: string; type: 'cancel' };

export type WorkerResponse =
  | { id: string; type: 'progress'; value: number; stage?: 'loading_model' | 'analyzing' }
  | { id: string; type: 'detect_done'; raw: RawNote[] }
  | { id: string; type: 'parts_done'; events: PolyEvent[] }
  | { id: string; type: 'stretch_done'; samples: Float32Array }
  | { id: string; type: 'error'; code: WorkerErrorCode; message: string }
  | { id: string; type: 'cancelled' };

export type WorkerErrorCode =
  | 'model_load_failed'
  | 'webgl_unavailable'   // se reintenta con backend CPU antes de fallar
  | 'out_of_memory'
  | 'no_notes'
  | 'internal';
```

Los `Float32Array` se envían como transferibles (`postMessage(msg, [msg.samples.buffer])`) para no copiarlos.

### 8.8 Reproducción (`modules/playback/types.ts`)

```typescript
import type { Midi, Seconds } from '../../core/types/units';
import type { Timbre } from '../../core/types/instrument';
import type { Note } from '../../core/types/score';

export interface PlaybackEngine {
  /** Desbloquea audio en iOS; llamar en el primer gesto del usuario. */
  unlock(): void;
  preview(midi: Midi, timbre: Timbre): void;
  play(opts: PlayOptions): PlaybackHandle;
  stopAll(): void;
}

export interface PlayOptions {
  notes: Note[];
  fromIndex: number;
  tempo: number;
  timbre: Timbre;
  /** Se llama en cada frame con el índice de nota que suena (−1 si ninguna). */
  onPosition(index: number): void;
  onEnd(): void;
}

export interface PlaybackHandle {
  stop(): void;
  readonly startedAt: Seconds;
}
```

### 8.9 Biblioteca (`modules/library/types.ts`)

```typescript
import type { Score, ScoreSummary } from '../../core/types/score';

/** Registro tal como se guarda en IndexedDB. */
export interface ScoreRecord extends Omit<Score, 'savedAt'> {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: 1;
}

export interface ScoreRepository {
  list(): Promise<ScoreSummary[]>;
  listTrash(): Promise<ScoreSummary[]>;
  get(id: string): Promise<Score | null>;
  /** Inserta o actualiza; devuelve updatedAt. */
  save(score: Score): Promise<string>;
  duplicate(id: string): Promise<string>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  purge(id: string): Promise<void>;
  purgeExpired(days: number): Promise<number>;
}

export interface BackupReport {
  added: number;
  updated: number;
  unchanged: number;
  invalid: number;
}

export type SaveState =
  | { kind: 'unsaved' }                       // ejemplo o partitura nueva sin cambios
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };       // p. ej. cuota llena o IndexedDB no disponible
```

### 8.10 Errores (`shared/errors.ts`)

```typescript
export type AppErrorCode =
  // importación
  | 'import_unsupported_format'
  | 'import_parse_failed'
  | 'import_no_notes'
  | 'import_file_too_large'
  // audio
  | 'audio_decode_failed'
  | 'audio_too_long'
  | 'audio_no_notes'
  | 'audio_model_failed'
  // exportación
  | 'export_render_failed'
  | 'export_lib_load_failed'
  // biblioteca local
  | 'storage_quota'
  | 'backup_invalid'
  | 'backup_too_large'
  // general
  | 'storage_unavailable'
  | 'internal';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    /** Mensaje en español apto para mostrar al usuario. */
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
```

### 8.11 Mapper registro ↔ dominio (`modules/library/services/score-mapper.ts`)

```typescript
import type { Score, ScoreSummary } from '../../../core/types/score';
import type { ScoreRecord } from '../types';

export function recordToScore(r: ScoreRecord): Score;                 // valida con validateScore()
export function scoreToRecord(s: Score, now: string, prev?: ScoreRecord): ScoreRecord;
export function recordToSummary(r: ScoreRecord): ScoreSummary;
```

## 9. Code Structure Guidelines

Esta sección existe para que el código nuevo **no repita el problema de legacy**: un solo archivo de 2 000 líneas
con estado global mutable (`let S`, `let sel`, `let Ear`), funciones de 100+ líneas y DOM mezclado con teoría
musical.

### 9.1 Límites de tamaño por archivo (ENFORCE STRICTLY)

| Tipo de archivo | Máximo | Típico | Notas |
|---|---|---|---|
| Componente React (`*.tsx`) | 200 líneas | 120-150 | Incluye JSX |
| Hook (`use-*.ts`) | 100 líneas | 50-75 | |
| Service (`*.service.ts`) | 300 líneas | 200 | |
| Store Zustand (`*.store.ts`) | 250 líneas | 150 | Dividir por slice si crece |
| Core: algoritmo (`core/analysis/*`) | 250 líneas | 120 | Excepción documentada abajo |
| Core: resto | 150 líneas | 100 | |
| Utils | 150 líneas | 100 | |
| Tipos (`core/types/*`) | 200 líneas | 100 | Un archivo por dominio |
| Worker (`*.worker.ts`) | 150 líneas | 80 | Solo orquesta; el cálculo está en core |
| Test | 400 líneas | 200 | Dividir por describe si crece |

**Excepciones permitidas (deben llevar comentario `// size-exception: <motivo>` en la línea 1):**
- Código de terceros embebido (p. ej. Basic Pitch si no se usa el paquete npm): va en `src/vendor/`, fuera de lint.
- Tablas de datos (catálogo de instrumentos, perfiles Krumhansl): hasta 300 líneas.

### 9.2 Límites por función

| Métrica | Máximo |
|---|---|
| Líneas por función | 40 (algoritmos de `core/analysis`: 60) |
| Complejidad ciclomática | 10 |
| Profundidad de anidamiento | 4 |
| Parámetros | 4 (más → objeto de opciones) |
| Hooks por componente | 6 |
| Props por componente | 8 (más → objeto de configuración) |
| Imports por archivo | 15 |

Los algoritmos de legacy que superan estos límites (p. ej. `detectMelodyMix`, `parseMidi`, `buildAbc`) **se dividen
al portarlos** en funciones nombradas por etapa. Ejemplo para `detectMelodyMix`:

```
detectMelodyMix(x, sr, onProgress)
  ├─ downmixTo22k(x, sr)                → Float32Array
  ├─ buildHarmonicCandidates(K, N, sr)  → CandidateBins[]
  ├─ salienceFrames(y, cand, onProgress)→ {sal, rms, times}
  ├─ viterbiPath(sal, lambda)           → Uint8Array
  ├─ voicingMask(sal, path, rms)        → (Midi|null)[]
  └─ dropOutliers(notes)                → RawNote[]
```

### 9.3 Organización por módulos (alta cohesión)

```
src/modules/
├── editor/
│   ├── components/        # InputDock, PianoKeyboard, Fretboard, NameButtons, DurationTools  (máx. 8)
│   ├── hooks/             # use-note-input, use-keyboard-shortcuts                           (máx. 4)
│   ├── store/             # score.store.ts, history.ts, selectors.ts
│   ├── types.ts
│   └── index.ts           # API pública
├── score-view/
│   ├── components/        # ScoreSheet, ScoreStatus, ScoreMetaForm, ViewBar
│   ├── hooks/             # use-abc-render, use-note-elements
│   └── index.ts
├── playback/
│   ├── engine/            # context.ts, ios-unlock.ts, synth-piano.ts, synth-plucked.ts, synth-sustained.ts
│   ├── hooks/             # use-playback
│   ├── types.ts
│   └── index.ts
├── import/
│   ├── components/        # FindOverlay, FileOpen, AbcPaste, SiteLinks
│   ├── services/          # import.service.ts (detecta formato, carga JSZip, llama core)
│   └── index.ts
├── export/
│   ├── components/        # ExportBar, ImageOverlay
│   ├── services/          # render-canvas.ts, pdf.service.ts, zip.service.ts
│   └── index.ts
├── ear/
│   ├── components/        # EarPanel, Waveform, AudioTransport, PartsList
│   ├── hooks/             # use-audio-file, use-audio-player, use-ear-analysis
│   ├── services/          # ear.service.ts (worker client), waveform.ts
│   ├── types.ts
│   └── index.ts
└── library/
    ├── components/        # LibraryOverlay, ScoreRow, TrashList, BackupPanel, SaveBadge, InstallHint
    ├── hooks/             # use-score-list, use-autosave, use-tab-guard
    ├── services/          # score-repository.ts, score-mapper.ts, backup.service.ts, persistence.ts
    ├── types.ts
    └── index.ts
```

Límites por módulo:
- Máximo **15 archivos** por módulo (sin contar tests).
- Máximo **8 componentes** por carpeta `components/`.
- Cada módulo expone **solo** lo que exporta su `index.ts`. Importar rutas internas de otro módulo está prohibido
  (`import { X } from '@/modules/ear/components/waveform'` ❌ → `import { X } from '@/modules/ear'` ✅).

### 9.4 Dirección de dependencias (ENFORCE DIRECTION)

```
          ┌──────────┐
          │   app    │
          └────┬─────┘
               ▼
          ┌──────────┐      ┌──────────┐
          │ modules  │─────►│  shared  │
          └────┬─────┘      └──────────┘
               │                 ▲
     ┌─────────┼──────────┐      │
     ▼         ▼          ▼      │
 ┌───────┐ ┌───────┐ ┌────────┐  │
 │ core  │ │ infra │ │workers │──┘ (solo tipos)
 └───────┘ └───────┘ └───┬────┘
     ▲                   │
     └───────────────────┘
```

Reglas (validadas con dependency-cruiser en CI):

| Desde | Puede importar | Prohibido |
|---|---|---|
| `core/**` | `core/**` | todo lo demás, `window`, `document`, `react` |
| `workers/**` | `core/**`, `workers/protocol` | `modules`, `infra`, `react` |
| `infra/**` | `shared/**`, `core/types` | `modules`, `react` |
| `modules/X/**` | `core`, `infra`, `shared`, `modules/Y/index` | `modules/Y/<interno>` |
| `shared/**` | `shared/**`, `core/types` | `modules`, `infra` |
| `app/**` | todo vía `index.ts` | rutas internas de módulos |

Dependencias entre módulos permitidas (todas las demás están prohibidas):

```
editor     → playback, score-view(tipos)
score-view → editor (store, selectores)
ear        → editor (replaceScore), playback (contexto de audio)
import     → editor (replaceScore)
export     → editor (lectura del store)
library    → editor (lectura/replaceScore)
playback   → (ninguno)
```

Ciclos: **cero**. `score-view → editor` y `editor → score-view` solo es válido si una dirección usa únicamente tipos
(`import type`), lo que dependency-cruiser ignora.

### 9.5 Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos | kebab-case | `score-repository.ts`, `piano-keyboard.tsx` |
| Componentes | PascalCase | `PianoKeyboard` |
| Hooks | `use` + camelCase, archivo `use-*.ts` | `useNoteInput` |
| Funciones / variables | camelCase | `buildAbc`, `noteCount` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_NOTES`, `MIDI_MIN` |
| Tipos / interfaces | PascalCase | `MeasurePart` |
| Stores | `use<Nombre>Store` | `useScoreStore` |
| Workers | `<nombre>.worker.ts` | `pitch.worker.ts` |
| Tests | `<archivo>.test.ts(x)` junto al archivo | `spelling.test.ts` |
| CSS Modules | `<componente>.module.css` | `piano-keyboard.module.css` |

**Nombres musicales:** en el código se usa notación anglosajona y nombres explícitos de unidad. Variables de una
letra de legacy (`S`, `I`, `M`, `f`, `t`, `p`, `d`) se renombran: `score`, `instrument`, `meter`, `fifths`,
`transpose`, `midi`, `units16`. La única excepción es el formato persistido de `Note` (`p`, `d`, `c`) por
compatibilidad (ADR-001).

**Textos visibles:** siempre en español y centralizados por módulo en `<módulo>/strings.ts` para facilitar revisión.

### 9.6 Reglas de TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Prohibido `any` (usar `unknown` y estrechar). `// @ts-expect-error` solo con comentario y ticket.
- Prohibido `enum` de TS: usar uniones de strings + `as const`.
- Funciones exportadas de `core` con tipo de retorno explícito.
- Sin `default export` (excepto lo que exija Vite, p. ej. workers).

---

## 10. Internal Organization Patterns

### 10.1 Plantilla de componente

```tsx
// piano-keyboard.tsx
import { memo, useCallback } from 'react';
// 1. externos  2. internos (alias @/)  3. estilos  4. tipos
import { midiName } from '@/core/theory';
import styles from './piano-keyboard.module.css';
import type { Midi } from '@/core/types/units';

interface Props {
  low: Midi;
  high: Midi;
  onNote(midi: Midi, el: HTMLElement): void;
}

export const PianoKeyboard = memo(function PianoKeyboard({ low, high, onNote }: Props) {
  // 1. hooks (máx. 6)
  const keys = useKeyLayout(low, high);

  // 2. derivados (máx. 3)
  const width = keys.whiteCount * KEY_WIDTH;

  // 3. handlers (máx. 5)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-midi]');
    if (el) onNote(Number(el.dataset.midi), el);
  }, [onNote]);

  // 4. efectos al final (máx. 3)

  // 5. JSX (máx. 50 líneas)
  return (
    <div className={styles.keyboard} style={{ width }} onPointerDown={handlePointerDown}
         onContextMenu={(e) => e.preventDefault()} aria-label="Teclado de piano">
      {keys.items.map((k) => <Key key={k.midi} {...k} />)}
    </div>
  );
});

function Key({ midi, black, left, label }: KeyItem) {
  // helper ≤ 25 líneas
}
```

Reglas:
- Delegación de eventos en el contenedor (como legacy) para teclados y diapasón: un listener, no 49.
- `pointerdown` (no `click`) para entrada de notas: latencia mínima en móvil.
- Componentes de entrada memoizados; reciben callbacks estables.

### 10.2 Plantilla de función de core

```typescript
// core/rhythm/measures.ts
import type { Note } from '../types/score';
import type { Measure, Meter } from '../types/notation';

const SPLIT = [16, 12, 8, 6, 4, 3, 2, 1] as const;

/** Descompone una duración en valores escribibles (redonda, blanca con puntillo, ...). */
export function splitDuration(units: number): number[] {
  const out: number[] = [];
  let rest = units;
  while (rest > 0) {
    const part = SPLIT.find((x) => x <= rest) ?? 1;
    out.push(part);
    rest -= part;
  }
  return out;
}

/** Reparte las notas en compases, partiendo y ligando las que cruzan la barra. */
export function toMeasures(notes: readonly Note[], meter: Meter, pickup = 0): Measure[] {
  // ...
}
```

Reglas de core:
- Funciones puras: misma entrada → misma salida; no mutan argumentos (`readonly` en parámetros de arreglo).
- Sin `Math.random()` salvo inyectado (el ruido del sintetizador vive en `playback`, no en core).
- Las funciones largas de análisis reciben `onProgress?: (v: number) => void` y **no** hacen `await setTimeout`
  (eso era un parche de legacy para no congelar la UI; en Worker no hace falta).

### 10.3 Plantilla de service

```typescript
// modules/library/services/score-repository.ts
import { openDb, tx } from '@/infra/idb';
import { AppError } from '@/shared/errors';
import { recordToScore, recordToSummary, scoreToRecord } from './score-mapper';
import type { ScoreRepository } from '../types';

export function createScoreRepository(open = openDb, now = () => new Date().toISOString()): ScoreRepository {
  return {
    async list() {
      const db = await open();
      const all = await tx(db, 'scores', 'readonly', (st) => st.index('by_updated').getAll());
      return all.filter((r) => r.deletedAt === null).reverse().map(recordToSummary);
    },
    async save(score) {
      const db = await open();
      const prev = await tx(db, 'scores', 'readonly', (st) => st.get(score.id));
      const rec = scoreToRecord(score, now(), prev);
      await tx(db, 'scores', 'readwrite', (st) => st.put(rec)).catch(toAppError);
      return rec.updatedAt;
    },
    // get, duplicate, softDelete, restore, purge, purgeExpired ...
  };
}

function toAppError(e: unknown): never {
  // QuotaExceededError → storage_quota; InvalidStateError / no disponible → storage_unavailable
}
```

Reglas de services:
- Factoría con dependencias inyectables (apertura de la base, reloj, worker) para testear con `fake-indexeddb`.
- Lanzan **solo** `AppError` con mensaje en español.
- Máximo 8 métodos públicos, 25 líneas por método.

### 10.4 Plantilla de hook

```typescript
// modules/ear/hooks/use-ear-analysis.ts
export function useEarAnalysis(audio: DecodedAudio | null) {
  const [state, setState] = useState<EarAnalysisState>({ kind: 'idle' });
  const service = useEarService();          // singleton por app

  const run = useCallback(async (mode: EarMode, region: AudioRegion) => {
    if (!audio) return;
    setState({ kind: 'running', mode, progress: 0 });
    try {
      const result = await service.analyze({ audio, mode, region,
        onProgress: (p) => setState((s) => s.kind === 'running' ? { ...s, progress: p } : s) });
      setState({ kind: 'done', mode, result });
    } catch (e) {
      setState(isCancel(e) ? { kind: 'idle' } : { kind: 'error', error: toAppError(e) });
    }
  }, [audio, service]);

  const cancel = useCallback(() => service.cancel(), [service]);
  return { state, run, cancel };
}
```

Reglas de hooks:
- Devuelven un estado discriminado (`kind`) en lugar de banderas sueltas (`loading`, `error`, `data`).
- No acceden a IndexedDB directamente: usan un service.
- Limpian timers, listeners, workers y `AudioBufferSourceNode` en el cleanup del efecto.

### 10.5 Plantilla de store (Zustand con historial)

```typescript
// modules/editor/store/score.store.ts
interface ScoreState {
  score: Score;
  selection: number;            // −1 = ninguna
  cursor: { base: Units16; dot: boolean };
  view: View;
  past: Snapshot[];             // ≤ 200
  future: Snapshot[];
}

interface ScoreActions {
  addNote(midi: Midi | null): void;
  deleteNote(): void;
  setDuration(base: Units16): void;
  toggleDot(): void;
  select(index: number): void;
  setMeta(patch: Partial<ScoreMeta>): void;   // también entra al historial (deuda 8)
  shiftAll(semitones: number): ShiftReport;    // devuelve cuántas notas se recortaron (deuda 7)
  octaveLast(direction: 1 | -1): void;
  replaceScore(next: Score): void;              // import, ear, library, nueva
  undo(): void;
  redo(): void;
}
```

- `Snapshot = { notes: Note[]; meta: ScoreMeta }`. Los cambios de título/compositor se agrupan: un snapshot por
  ráfaga de escritura (debounce 1 s) para que deshacer no vaya letra por letra.
- La selección, el cursor y la vista **no** entran al historial.
- Las acciones delegan en funciones puras de `core/score/score-ops.ts`; el store solo aplica el resultado.

### 10.6 Patrón de cliente de Worker

```typescript
// modules/ear/services/ear.service.ts (extracto)
export function createWorkerClient<Req extends { id: string }, Res extends { id: string }>(
  factory: () => Worker,
) {
  let worker: Worker | null = null;
  const pending = new Map<string, Pending<Res>>();
  const ensure = () => (worker ??= attach(factory(), pending));
  return {
    request(msg: Omit<Req, 'id'>, transfer: Transferable[], onProgress?: (v: number) => void) { /* ... */ },
    cancel(id: string) { /* envía {type:'cancel'}; si no responde en 500 ms → terminate() y recrear */ },
    dispose() { worker?.terminate(); worker = null; },
  };
}
```

- Un Worker por tipo de tarea, creado bajo demanda y reutilizado.
- Cancelación cooperativa; si el Worker está ocupado en una operación de TF.js que no se puede interrumpir, se
  termina y se recrea (el modelo se vuelve a cargar desde caché HTTP).

### 10.7 Organización de estilos

- Tokens en `app/theme.css` portados de legacy (`--bg`, `--surface`, `--accent`, `--paper`, `--mark`, `--oor`,
  `--wood`, etc.) con modo oscuro por `prefers-color-scheme` y `data-theme`.
- Cada componente tiene su `*.module.css`; prohibidos colores literales fuera de `theme.css`.
- La partitura (`.paper`) siempre clara, como en legacy, para legibilidad e impresión.

---

## 11. Patrones de Arquitectura

### 11.1 Gestión de estado

| Estado | Dónde | Por qué |
|---|---|---|
| Partitura en edición, selección, cursor, vista, historial | `useScoreStore` (Zustand) | Compartido por editor, vista, export, ear, library |
| Modo de entrada (piano/diapasón/nombres) | `usePrefsStore` (Zustand + IndexedDB) | Preferencia persistente |
| Lista "Mis partituras" | TanStack Query `['scores']` sobre el repositorio local | Estados de carga e invalidación simples |
| Estado de guardado | `useSaveStore` | Indicador "Guardada en este dispositivo" |
| Audio cargado, región A-B, velocidad | Estado local de `EarPanel` (useReducer) | Solo lo usa ese panel |
| Overlays abiertos | Estado local de `AppShell` | UI efímera |

Selectores finos para evitar renders: `useScoreStore((s) => s.score.notes)` en `ScoreSheet`;
`useScoreStore((s) => s.cursor)` en `DurationTools`. Prohibido `useScoreStore()` sin selector.

### 11.2 Render de partitura

1. `buildAbc` se memoiza por `(notes, meta, view)` (referencias estables gracias al store inmutable).
2. El render con abcjs se programa con `requestAnimationFrame`: varias notas en el mismo frame → un render.
3. Tras renderizar se construye `noteElements: Element[][]` (índice → elementos SVG) a partir del `charMap`.
4. Resaltados (selección, fuera de rango, reproducción) se aplican **por clase** sobre `noteElements` sin volver a
   renderizar. La reproducción en curso solo cambia clases (como legacy).
5. Ancho del pentagrama: `ResizeObserver` sobre `.paper`; re-render solo si el ancho cambia > 20 px.
6. Partituras largas (> 400 notas): se mide el tiempo de render; si supera 50 ms, se activa render diferido
   (`requestIdleCallback` con fallback) y se muestra el estado "dibujando…". Ver objetivos en 15.

### 11.3 Guardado automático

- **No hay botón "Guardar"**: toda partitura que el usuario edita se guarda sola en IndexedDB (debounce 800 ms tras
  cada cambio, y al ocultar la pestaña con `visibilitychange`/`pagehide`).
- Un ejemplo cargado o una partitura nueva **sin cambios** no se guarda (no ensucia "Mis partituras").
- Indicador junto al título: "Guardada en este dispositivo" / "Guardando…" / error.
- **Varias pestañas:** `BroadcastChannel('atril')` anuncia qué partitura tiene abierta cada pestaña. Si dos pestañas
  abren la misma, la segunda muestra "Esta partitura está abierta en otra pestaña; los cambios de la última que
  guarde reemplazarán a los otros." (ADR-006). Al guardar, cada pestaña avisa a las demás para refrescar "Mis
  partituras".
- **Errores:** cuota llena → "No queda espacio en este dispositivo. Borra partituras o audios guardados, o haz una
  copia de respaldo." IndexedDB no disponible (modo privado de algunos navegadores) → se trabaja en memoria y aviso
  único "En esta ventana tus partituras no se guardan; usa una ventana normal o descarga tu trabajo."
- TanStack Query se mantiene solo para la lista (estados de carga e invalidación); `staleTime: Infinity` e
  invalidación manual al guardar.

### 11.4 Arranque y cambio de partitura

- Al arrancar: si `prefs.lastOpenId` apunta a una partitura existente, se abre; si no, el ejemplo "Himno de la
  alegría" (como legacy).
- Al abrir otra partitura, un ejemplo o un resultado de importación/De oído: la actual ya está guardada (11.3), así
  que se reemplaza sin preguntar. `library.prepareReplace()` solo fuerza el guardado pendiente (flush del debounce).
- "Nueva" crea una partitura vacía con id nuevo; se guarda al primer cambio.

### 11.5 Manejo de errores

| Capa | Estrategia |
|---|---|
| Core | Lanza `Error` con mensaje técnico, o devuelve `warnings` para problemas no fatales |
| Services | Convierte todo a `AppError` con mensaje en español |
| Hooks | Estado `{kind:'error', error}` |
| Componentes | Muestran el mensaje en el panel correspondiente (`aria-live="polite"`) |
| Global | `ErrorBoundary` por panel (Ear, Library, Export) con "Reintentar"; uno raíz con "Recargar" |
| Toasts | Solo para confirmaciones breves ("Guardada", "Imagen copiada"); errores van en contexto |

Logging: en desarrollo `console`. En producción, errores no esperados se guardan en un anillo de 50 entradas en
memoria accesible desde "Ayuda → Copiar diagnóstico" (sin servicios externos en el MVP).

### 11.6 Carga diferida y code splitting

| Recurso | Cuándo se carga |
|---|---|
| abcjs | Al inicio (necesario para ver la partitura) |
| JSZip | Al abrir un `.mxl` o exportar ZIP |
| jsPDF | Al exportar PDF |
| Módulo `ear` completo | Al pulsar "De oído" (`React.lazy`) |
| `pitch.worker` | Al pulsar "Escribir la melodía sola" (solo/mezcla) |
| TF.js + modelo Basic Pitch | Al elegir "separar melodía, bajo y acordes" |
| `stretch.worker` | Al elegir velocidad < 100 % |
| Repositorio IndexedDB | Al inicio (abre la base en paralelo con el primer render) |

### 11.7 Audio (Web Audio)

- Un único `AudioContext` compartido (playback y ear) creado en el primer gesto (`unlock`).
- iOS: `navigator.audioSession.type = 'playback'` cuando exista y bucle `<audio>` silencioso para sonar con el
  interruptor de silencio (portado de legacy).
- Cadena: voces → `master` (gain 0.55) → `DynamicsCompressor` → destino (como legacy).
- Caché de buffers Karplus-Strong por `(midi, sustain, brillo)` con límite LRU de 128 entradas (legacy no tenía
  límite).
- Límite de nodos vivos: al superar 400 se descartan referencias detenidas (legacy).

---

## 12. Máquinas de Estado

### 12.1 Edición (selección)

```
                 tocar nota en partitura
   ┌────────────┐ ───────────────────────► ┌──────────────┐
   │ Añadiendo  │                          │ Seleccionada │
   │ (sel = −1) │ ◄─────────────────────── │  (sel = i)   │
   └────────────┘  Esc / tocar la misma    └──────┬───────┘
        │  ▲       nota / → en la última          │ tocar tecla
        │  │                                      ▼
        │  │                              reemplaza tono de i,
        │  └──── si i era la última ◄──── sel = i+1
        │
   tocar tecla → agrega nota al final con la duración actual
```

| Evento | Añadiendo | Seleccionada(i) |
|---|---|---|
| Tecla de nota | push nota | reemplaza `p` de i; sel → i+1 o −1 |
| Silencio | push silencio | `p` de i = null; sel → i+1 o −1 |
| Duración / puntillo | cambia cursor | cambia cursor y `d` de i |
| Borrar | pop | elimina i; sel → min(i, len−1) |
| ← | sel = len−1 | sel = max(0, i−1) |
| → | — | sel = i+1 o −1 |
| ↑ / ↓ | octava de la última nota | octava de i |
| Reproducir | desde 0 | desde i |

### 12.2 Reproducción

```
 ┌──────┐  play   ┌───────────┐  fin / stop / editar  ┌──────┐
 │ Idle │ ──────► │ Playing   │ ────────────────────► │ Idle │
 └──────┘         │ (raf loop)│                       └──────┘
                  └───────────┘
```

- Cualquier edición detiene la reproducción (legacy: `stopPlay()` en `addNote`/`delNote`).
- Cambiar instrumento o tempo durante la reproducción la detiene.

### 12.3 Análisis De oído

```
          elegir archivo                 decode ok
 ┌──────┐ ─────────────► ┌──────────┐ ──────────► ┌───────┐
 │ Vacío│                │Decodific.│              │ Listo │◄────────────┐
 └──────┘ ◄───────────── └──────────┘              └───┬───┘             │
            decode error (mensaje)                     │ analizar        │
                                                       ▼                 │
                                          ┌──────────────────────┐       │
                                          │ Cargando modelo      │ (solo │
                                          │ (parts)              │ parts)│
                                          └──────────┬───────────┘       │
                                                     ▼                   │
                                          ┌──────────────────────┐ cancelar
                                          │ Analizando (progreso)│ ──────┤
                                          └──────────┬───────────┘       │
                                       ok            │      error/sin notas
                                   ┌─────────────────┴──────────┐        │
                                   ▼                            ▼        │
                          ┌─────────────────┐          ┌──────────────┐  │
                          │ Resultado       │          │ Error        │──┘
                          │ solo/mix → abre │          │ (mensaje)    │
                          │ parts → lista   │          └──────────────┘
                          └────────┬────────┘
                                   │ "Reajustar ritmo" (cambia tempo)
                                   └──► re-cuantiza sin re-analizar
```

Límites por modo (corrige deuda 6: mismos valores en código y textos):

| Modo | Duración máxima analizada | Texto visible |
|---|---|---|
| solo (YIN) | 300 s | "hasta 5 minutos" |
| mix | 180 s | "hasta 3 minutos" |
| parts (Basic Pitch) | 90 s | "hasta minuto y medio" |

Si la región es más larga, se analiza el inicio y se informa: "Analicé los primeros N; selecciona otro pedazo para
seguir".

### 12.4 Guardado

```
 ┌──────────┐ primer cambio ┌────────┐ debounce 800 ms ┌────────┐  ok   ┌───────┐
 │ Sin      │ ────────────► │ Sucia  │ ──────────────► │Guardan-│ ────► │Guarda-│
 │ guardar  │               └────────┘                 │  do    │       │  da   │
 └──────────┘                   ▲                      └───┬────┘       └───┬───┘
                                │ cambio                   │ error           │ cambio
                                └──────────────────────────┼─────────────────┘
                                                           ▼
                                                     ┌──────────┐ reintento al siguiente cambio
                                                     │  Error   │ ─────────────────────────────►
                                                     └──────────┘
```

### 12.5 Respaldo y restauración

```
 Mis partituras ─► "Hacer copia" ─► Empaquetando ─► Descargar / Compartir ─► lastBackupAt = ahora
 Mis partituras ─► "Restaurar copia" ─► Elegir archivo ─► Validando ─► Fusionando ─► Informe
                                                            │ inválido
                                                            ▼
                                                     Error (mensaje)
```

## 13. Seguridad

### 13.1 Modelo de amenazas (resumen)

| Activo | Amenaza | Control |
|---|---|---|
| Partituras y audios del usuario | Pérdida por limpieza del navegador | Almacenamiento persistente, instalación en pantalla de inicio, respaldo (7.6) |
| Partituras y audios | Lectura por otro sitio | Aislamiento de origen del navegador (IndexedDB es por dominio) |
| Navegador del usuario | XSS desde contenido importado | CSP estricta, sin `dangerouslySetInnerHTML`, React escapa por defecto |
| Navegador del usuario | Archivo malicioso (zip bomb, XML enorme, MIDI corrupto, respaldo manipulado) | Límites de tamaño, parseo defensivo, validación de cada partitura del respaldo |
| Privacidad | Envío de datos a terceros | No hay servidor, analítica ni rastreadores; E2E que intercepta la red |

No hay cuentas, contraseñas ni datos personales en servidores: no aplican robo de sesión, fuga de base de datos ni
control de acceso.

### 13.2 Autenticación

No existe (R3).

### 13.3 Autorización

No existe: todos los datos son del dispositivo y solo los ve quien usa ese navegador. En un dispositivo compartido,
cualquiera que abra Atril verá sus partituras; se informa en "Acerca de".

### 13.4 Validación y sanitización de entradas

| Entrada | Límite / regla |
|---|---|
| Archivo de partitura (.musicxml/.xml/.abc/.txt) | ≤ 5 MB |
| .mxl | ≤ 5 MB comprimido; descompresión abortada si supera 20 MB (zip bomb) |
| MIDI | ≤ 2 MB; lectura con límites de `DataView` y abortar en lecturas fuera de rango |
| XML | Rechazar documentos con `<!ENTITY`; DOMParser no resuelve entidades externas en navegadores |
| Audio | ≤ 50 MB; duración decodificada ≤ 15 min (si no, pedir recortar) |
| Notas importadas | ≤ 3 000 (warning `truncated`) |
| Título / compositor | ≤ 120 caracteres; al generar ABC se eliminan saltos de línea y `%` (comentario ABC) |
| Cifrado de acordes | ≤ 12 caracteres; se eliminan `"` |
| Texto ABC pegado | ≤ 200 KB |

### 13.5 Content Security Policy (vercel.json)

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
connect-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob: data:;
style-src 'self' 'unsafe-inline';
font-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

- Todas las librerías se empaquetan con Vite (no hay CDN externos, a diferencia de legacy).
- Fuentes (Bodoni Moda, Work Sans, JetBrains Mono) se sirven localmente (`@fontsource/*`), sin Google Fonts.
- `style-src 'unsafe-inline'` es necesario porque abcjs escribe estilos en línea en el SVG.
- **Verificar en semana 1** si TF.js (backend WebGL) necesita `'unsafe-eval'`; si lo necesita, documentarlo como ADR.

### 13.6 Otras cabeceras

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), geolocation=(), microphone=()` (el micrófono queda fuera del MVP)

### 13.7 CORS y rate limiting

No aplica: la app no hace peticiones a servicios propios ni de terceros. `connect-src 'self'` lo garantiza (solo el
modelo de Basic Pitch y recursos estáticos del mismo dominio).

### 13.8 Privacidad

- El audio se procesa y se guarda solo en el dispositivo.
- Sin analítica ni rastreadores en el MVP.
- "Borrar todo" en "Mis partituras" elimina la base `atril` del dispositivo (con confirmación doble).

## 14. APIs

No hay APIs remotas. Los contratos internos son:

| Contrato | Definición |
|---|---|
| Repositorio de partituras (IndexedDB) | `ScoreRepository` (8.9) |
| Respaldo | Formato 7.7; `backup.service.ts`: `exportBackup(opts): Promise<Blob>`, `importBackup(file): Promise<BackupReport>` |
| Workers | Protocolo 8.7 |
| Recursos estáticos | `/models/basic-pitch/*` con caché inmutable; `manifest.webmanifest`; iconos |

### 14.1 Errores de almacenamiento → AppError

| Origen | Error del navegador | AppError |
|---|---|---|
| IndexedDB | `QuotaExceededError` | `storage_quota` |
| IndexedDB | No disponible / `InvalidStateError` / `SecurityError` | `storage_unavailable` |
| Respaldo | JSON inválido, `format` o `version` desconocidos | `backup_invalid` |
| Respaldo | Archivo > 300 MB o JSON > 20 MB | `backup_too_large` |

## 15. Performance

### 15.1 Dispositivos de referencia

- **Móvil bajo:** Android de gama media (Moto G de 2022) con Chrome.
- **Móvil referencia:** iPhone 12 con Safari.
- **Escritorio:** portátil de 4 núcleos con Chrome.

### 15.2 Objetivos

| Métrica | Objetivo | Medición |
|---|---|---|
| JS inicial (gzip) | ≤ 250 KB | `vite build` + `rollup-plugin-visualizer` en CI |
| LCP en 4G (móvil referencia) | ≤ 2.0 s | Lighthouse CI |
| INP | ≤ 150 ms | Lighthouse / web-vitals en desarrollo |
| Latencia tecla → sonido | ≤ 30 ms | Medición manual con `AudioContext.outputLatency` + log |
| Tecla → partitura redibujada (200 notas) | ≤ 50 ms móvil referencia | `performance.mark` en `use-abc-render` |
| Tecla → partitura redibujada (1 000 notas) | ≤ 200 ms | Ídem; render diferido si se supera |
| YIN, 60 s de audio | ≤ 6 s móvil referencia | Test de rendimiento en Playwright (WebKit) |
| Melodía en mezcla, 60 s | ≤ 10 s | Ídem |
| Basic Pitch, 30 s (WebGL) | ≤ 20 s | Ídem |
| Carga del modelo Basic Pitch (cache fría) | ≤ 3 s en 4G | ~742 KB + TF.js |
| Memoria máxima durante Basic Pitch 90 s | ≤ 400 MB | DevTools |
| Lista "Mis partituras" (200 partituras) | ≤ 100 ms | `performance.mark` |
| Guardado automático | ≤ 30 ms | Ídem |
| Respaldo de 200 partituras | ≤ 1 s | Ídem |

### 15.3 Técnicas

- Code splitting según 11.6.
- Modelo Basic Pitch como `.bin` con `Cache-Control: public, max-age=31536000, immutable` (nombre con hash).
- YIN: reducir costo con la función de diferencia vía autocorrelación por FFT (O(N log N) por ventana) en lugar del
  bucle doble de legacy, manteniendo los mismos resultados (test dorado con tolerancia ±1 semitono en ≤ 2 % de
  notas).
- WSOLA en Worker; resultado cacheado por `(región, velocidad)` como legacy.
- Waveform: picos calculados una vez por ancho y guardados (legacy) y dibujo en `<canvas>`.
- `React.memo` en superficies de entrada; selectores finos en el store.

---

## 16. Testing Requirements per Layer

### 16.1 Herramientas y umbrales

| Capa | Herramienta | Cobertura mínima |
|---|---|---|
| Core | Vitest (Node) | 90 % líneas, 85 % ramas |
| Services / stores | Vitest + `fake-indexeddb` + mocks de Worker | 85 % |
| Hooks | Vitest + `@testing-library/react` (`renderHook`) | 80 % |
| Componentes | Vitest + Testing Library (jsdom) | 75 % |
| Global | — | 85 % líneas |
| Persistencia | Vitest + `fake-indexeddb` | 100 % de migraciones y del formato de respaldo |
| E2E | Playwright (Chromium + WebKit móvil) | Flujos críticos 16.6 |

### 16.2 Tests dorados contra legacy

`legacy/index.html` expone su núcleo con `module.exports = {INSTR, buildAbc, toMusicXML, toMidi, parseMidi,
parseMusicXML, parseAbcTune, spell, toMeasures}` cuando existe `module`. El script `scripts/legacy-fixtures.mjs`:

1. Extrae el bloque `<script>` del núcleo musical de `legacy/index.html`.
2. Lo evalúa en un `vm` de Node con `module` definido.
3. Para un conjunto de partituras de entrada (ejemplos + casos borde de `tests/fixtures/scores/*.json`) y los 19
   instrumentos × 2 vistas, guarda las salidas de `buildAbc`, `toMusicXML`, `toMidi` (hex) y `spell`.
4. Los tests de `src/core` comparan la salida del código portado con estos dorados.

Diferencias intencionales (correcciones de la sección 18) se marcan en `tests/fixtures/golden/EXCEPTIONS.md` con el
motivo; cualquier otra diferencia hace fallar el test.

### 16.3 Core: casos obligatorios

- **spelling:** las 12 clases de altura en las 13 armaduras; dobles alteraciones; octava correcta en Si♯/Do♭.
- **toMeasures:** nota que cruza 1 y 2 barras; duraciones 5, 7, 9, 11, 13, 15 (puntillos y ligaduras); compases
  6/8 y 12/8; partitura vacía.
- **buildAbc:** accidentales dentro de compás (se repiten tras la barra); `charMap` apunta al índice correcto con
  nombres y acordes activos; transposición escrita para los 19 instrumentos; clef auto.
- **MusicXML export:** valida contra XSD 3.1 (test con `xmllint` en CI); `<transpose>` correcto para Si♭, Mi♭,
  Fa, tenor y octava.
- **MIDI export → import:** ida y vuelta conserva tonos y duraciones.
- **Importadores:** archivos reales de MuseScore, Finale y Sibelius en `tests/fixtures/files/`, incluyendo
  anacrusa, `<backup>`/`<forward>`, acordes, varias voces, cambios de tempo, running status MIDI, formato 0 y 1.
- **Análisis:** señales sintéticas (senos y sierras a tonos conocidos, con silencios) → notas esperadas;
  `guessKey` en escalas mayores y menores; `guessTempo` en clics a 60/90/120/150 bpm; `quantize` con jitter.

### 16.4 Componentes: casos obligatorios

Cada componente debe tener:
1. Render sin errores.
2. Variaciones de props relevantes.
3. Interacciones (pointerdown en teclas, clics en herramientas, teclado).
4. Estado de error / vacío.
5. Accesibilidad: `aria-label` presentes y navegación por teclado (axe en tests de componentes clave).

### 16.5 Services: casos obligatorios

1. Camino feliz.
2. Errores de almacenamiento mapeados a `AppError` (tabla 14.1).
3. Respuestas vacías.
4. Fusión del respaldo (nuevas, actualizadas, sin cambios, inválidas).
5. Cancelación y error de Worker (ear.service).

### 16.6 E2E (Playwright)

| Flujo | Navegadores |
|---|---|
| Escribir 8 notas con el piano, reproducir, deshacer, rehacer | Chromium, WebKit móvil |
| Cambiar a Saxofón alto: armadura escrita y aviso fuera de rango | Chromium |
| Importar MusicXML y MIDI de fixtures; exportar ZIP y comprobar contenido | Chromium |
| Exportar PDF y PNG (archivo descargado no vacío) | Chromium |
| De oído solo con audio de fixture → ≥ 90 % de notas esperadas | Chromium |
| De oído partes con audio de fixture → aparecen Melodía y Bajo | Chromium |
| Editar → recargar la página → la partitura sigue ahí y aparece en "Mis partituras" | Chromium, WebKit móvil |
| Hacer copia en un contexto y restaurarla en otro contexto limpio → mismas partituras | Chromium |
| Dos pestañas con la misma partitura → aviso | Chromium |
| Sin red: la app funciona completa tras la primera carga (excepto descargar el modelo por primera vez) | Chromium |

### 16.7 Persistencia local

- Migración 0 → 1 crea stores e índices.
- `save` / `list` / papelera / `purgeExpired(30)`.
- Registro corrupto se omite al leer y no rompe la lista.
- Respaldo: ida y vuelta conserva todo; fusión por `updatedAt`; archivo manipulado (nota con `p: 999`) se rechaza
  por partitura.
- Cuota simulada llena → `storage_quota`.

## 17. Quality Enforcement Rules

### 17.1 Métricas de estructura (ENFORCE en CI)

| Métrica | Límite | Herramienta |
|---|---|---|
| Líneas por archivo | Sección 9.1 | ESLint `max-lines` por glob |
| Líneas por función | 40 / 60 core analysis | `max-lines-per-function` |
| Complejidad ciclomática | 10 | `complexity` |
| Profundidad | 4 | `max-depth` |
| Parámetros | 4 | `max-params` |
| Archivos por módulo | 15 | script `scripts/check-module-size.mjs` |
| Ciclos de dependencias | 0 | dependency-cruiser `no-circular` |
| Dirección de capas | 9.4 | dependency-cruiser reglas `forbidden` |
| Imports internos entre módulos | 0 | dependency-cruiser |
| Código duplicado | ≤ 3 % | jscpd |
| `any` explícito | 0 | `@typescript-eslint/no-explicit-any` |
| Cobertura de tipos | ≥ 95 % | `type-coverage` |

### 17.2 Gates de CI (GitHub Actions)

Orden y bloqueo:

1. `npm run typecheck`
2. `npm run lint` (incluye reglas de estructura)
3. `npm run depcruise`
4. `npm run test -- --coverage` (umbrales 16.1)
5. `npm run build` + verificación de tamaño de bundle (15.2)
6. `npm run e2e` (Playwright) en PRs a `main`
7. Lighthouse CI sobre el preview de Vercel (advertencia, no bloqueo, en el MVP)

Un PR no se fusiona si falla cualquiera de 1-6.

### 17.3 Definition of Done por tarea

- [ ] Cumple la spec del módulo (cuando exista en `docs/reference/modules/`).
- [ ] Tests nuevos según sección 16; cobertura no baja.
- [ ] Sin violaciones de 17.1.
- [ ] Textos en español revisados en `strings.ts`.
- [ ] Probado en navegador real: Chrome de escritorio y Safari de iPhone (o simulador).
- [ ] Accesible: etiquetas, foco visible, uso con teclado.
- [ ] Si cambia el formato de IndexedDB o del respaldo: migración nueva (7.5) + test.
- [ ] Log del día en `docs/development/current/`.

### 17.4 Revisión de código

- Todo PR con descripción, capturas en móvil si toca UI y referencia a la tarea.
- Revisión obligatoria de: migraciones de IndexedDB, formato de respaldo, CSP, Workers.

---

## 18. Resolución de la deuda de legacy

| # | Problema (legacy) | Decisión técnica | Dónde | Test que lo cubre |
|---|---|---|---|---|
| 1 | "Mis partituras" en localStorage | IndexedDB persistente + respaldo en archivo (ADR-007, ADR-012, ADR-013) | library, infra/idb | E2E recargar y respaldo |
| 2 | MusicXML ignora `<forward>`/`<backup>` y anacrusa | Llevar un cursor de tiempo por medida para la voz elegida: `<backup>` retrocede, `<forward>` en la voz elegida agrega silencio; detectar anacrusa (`implicit="yes"` o primer compás más corto que la barra) y **rellenar con silencio inicial** + warning `pickup_padded`. El soporte real de anacrusa (`pickup` en el modelo) queda post-MVP | core/formats/musicxml-import | Fixtures con anacrusa y varias voces |
| 3 | Acorde MusicXML toma la primera nota | Agrupar `<note>` con `<chord/>` en el mismo inicio y quedarse con la más aguda; warning `polyphony_reduced` | core/formats/musicxml-import | Fixture de acordes |
| 4 | Separación ≥55 / ≤52 pierde MIDI 53-54 | Melodía = skyline superior sobre **todos** los eventos; bajo = skyline inferior sobre los eventos restantes con `p ≤ 60`; ninguna nota queda sin asignar por umbral | core/analysis/skyline + ear.service | Test sintético con notas 53-54 |
| 5 | YIN costoso en hilo principal | Worker (ADR-004) + diferencia por FFT (15.3) | workers/pitch, core/analysis/yin | Test de rendimiento 15.2 |
| 6 | Texto "1 minuto" vs 90 s | Constantes únicas `EAR_LIMITS` usadas por código y textos (12.3) | modules/ear/strings.ts | Test que compara textos con constantes |
| 7 | "Mover todo" recorta en silencio | `shiftAll` devuelve `{clipped}`; si `clipped > 0` el toast dice "N notas quedaron en el límite del rango" con botón "Deshacer" | core/score/score-ops, editor store | Unit + componente |
| 8 | Deshacer solo cubre notas | Historial de `Snapshot {notes, meta}` + rehacer (10.5) | editor store | Unit |
| 9 | MIDI: solo primer tempo/compás | Mantener primer tempo/compás pero emitir warnings `tempo_changes` / `meter_changes`; registrar running status correctamente tras eventos meta/sysex | core/formats/midi-import | Fixtures con cambios |
| 10 | Re-render y guardado por cada nota | rAF para render, debounce 800 ms para el guardado automático (11.2, 11.3) | score-view, library | Medición 15.2 |

Correcciones menores detectadas al revisar legacy:

| Hallazgo | Decisión |
|---|---|
| Título con `%` rompe el ABC (se interpreta como comentario) | `abc-escape.ts` elimina `%` y saltos de línea |
| Caché Karplus-Strong sin límite | LRU de 128 entradas (11.7) |
| Diapasón con trastes para violín/viola/chelo | Mantener (ayuda visual), pero rotular "posiciones" en vez de "trastes" para instrumentos sin trastes |
| Librerías desde CDN | Empaquetadas (13.5) |
| Fuentes de Google Fonts | Locales (13.5) |
| Al cargar otra partitura se guardaba en silencio en la biblioteca | Guardado automático explícito con indicador (11.3) |

---

## 19. Dependencias y Riesgos

### 19.1 Dependencias externas

| Dependencia | Licencia | Riesgo | Mitigación |
|---|---|---|---|
| abcjs | MIT | Rendimiento con partituras largas | Render diferido; límite 3 000 notas |
| TensorFlow.js | Apache-2.0 | Tamaño (~1 MB gzip) y soporte WebGL en iOS | Carga diferida; fallback CPU con aviso de lentitud |
| Basic Pitch (modelo y post-proceso) | Apache-2.0 | Código minificado embebido difícil de mantener | Evaluar paquete npm oficial en semana 1; incluir NOTICE |
| Vercel | Servicio | — | Sitio estático portable a cualquier CDN |
| JSZip, jsPDF | MIT | — | — |

### 19.2 Riesgos del proyecto

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| RK1 | Diferencias sutiles al portar el núcleo musical | Media | Alto | Tests dorados contra legacy (16.2) desde la semana 1 |
| RK2 | Audio en iOS (desbloqueo, interruptor de silencio, AudioContext suspendido) | Alta | Alto | Portar el código de legacy tal cual; E2E en WebKit + prueba manual en iPhone cada semana |
| RK3 | TF.js en Worker sin WebGL (OffscreenCanvas no disponible en algunos Safari) | Media | Medio | Probar en semana 1; si falla, ejecutar Basic Pitch en el hilo principal como legacy con UI de progreso |
| RK4 | Memoria al decodificar audios largos en móviles | Media | Medio | Límite 15 min; mono Float32 inmediato; liberar buffers estéreo |
| RK5 | El usuario cambia de teléfono y pierde sus partituras | Media | Alto | Recordatorio de respaldo cada 14 días; respaldo compartible por WhatsApp/Drive |
| RK9 | Safari borra los datos de sitios no visitados en 7 días | Media | Alto | `storage.persist()`, sugerencia de agregar a pantalla de inicio, recordatorio de respaldo (7.6) |
| RK6 | Alcance del MVP crece (polifonía, letras) | Media | Alto | No-objetivos 1.5; cualquier adición pasa por PRD |
| RK7 | CSP bloquea TF.js o abcjs | Baja | Medio | Verificar en semana 1 (13.5) |
| RK8 | Usuarios de legacy pierden sus partituras guardadas en el artifact | Alta | Bajo | Avisar en el artifact: "Descarga para MuseScore y ábrela en la nueva versión" (sus ZIP se importan sin pérdida) |

### 19.3 Supuestos

- El equipo es una persona con apoyo de Claude Code.
- No hay requisito de compatibilidad con navegadores sin Web Audio ni con IE.
- Los ejemplos incluidos son de dominio público.

---

## 20. Glosario

| Término | Significado |
|---|---|
| Sonido real (concert pitch) | Altura que suena realmente |
| Escrito (written) | Altura que lee el músico en su parte; difiere en instrumentos transpositores |
| Armadura / quintas | Número de sostenidos (+) o bemoles (−) de la tonalidad |
| Unidad 1/16 | Duración de una semicorchea; base de todas las duraciones |
| Anacrusa | Compás inicial incompleto |
| Skyline | Algoritmo que de un conjunto polifónico toma la nota más aguda (o grave) en cada momento |
| YIN | Algoritmo de detección de frecuencia fundamental para una sola voz |
| WSOLA | Técnica para cambiar la velocidad del audio sin cambiar su tono |
| Basic Pitch | Modelo de Spotify que transcribe audio polifónico a notas |
| IndexedDB | Base de datos del navegador, propia de cada dispositivo y dominio |
| ABC | Notación musical en texto plano |

---

## 21. Próximos Pasos

1. [x] /oden:init — estructura y decisiones iniciales
2. [x] /oden:architect — arquitectura, persistencia local, tipos, estructura de código y calidad (este documento)
3. [x] Análisis competitivo — `competitive-analysis.md` (MuseScore, Flat.io, Noteflight, Soundslice, Moises)
4. [x] Specs de módulos en `docs/reference/modules/`:
   - [x] `editor-spec.md`
   - [x] `notation-core-spec.md` (incluye `score-view`)
   - [x] `formats-spec.md` (incluye `import` y `export`)
   - [x] `ear-spec.md`
   - [x] `library-spec.md` (sin login)
   - [x] `playback-spec.md`
5. [x] Plan semana por semana — `implementation-plan.md`
6. [x] Checklist pre-código — `docs/development/current/checklist-pre-codigo.md`
7. [ ] Semana 1 del plan: fundaciones, port del núcleo con dorados, spikes de riesgo

### 21.1 Cambios pendientes de aplicar en este documento al terminar los spikes de la semana 1

| Tema | Dónde | Origen |
|---|---|---|
| JSZip → fflate (ADR-011) | 2.1 tabla Frontend | formats-spec 2.1 |
| ~~Basic Pitch: paquete npm o vendorizado~~ **Resuelto: vendorizado (ADR-014).** Worker o hilo principal en Safari de iPhone: pendiente de la prueba en el teléfono | 2.1, 6.4, 19.2 RK3 | ear-spec 11.1-11.2 |
| ~~CSP final~~ **Resuelto:** TF.js con WebGL no necesita `unsafe-eval`; la CSP de 13.5 queda igual (probado en Vercel, Chrome) | 13.5 | RK7 |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Technical Architect
