---
name: atril-technical-decisions
status: in-progress
created: 2026-10-18T12:11:33Z
updated: 2026-10-18T12:36:00Z
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
7. Schema de Base de Datos
8. Interfaces TypeScript
9. Code Structure Guidelines
10. Internal Organization Patterns
11. Patrones de Arquitectura
12. Máquinas de Estado
13. Seguridad
14. APIs (Supabase)
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
- **Abrir** partituras existentes (MusicXML, .mxl, MIDI, ABC) y **exportarlas** (PDF, PNG, ABC, ZIP para MuseScore).
- **Sacar canciones de oído** a partir de un audio: detección de tono de una voz sola, melodía principal de una mezcla,
  o separación melodía/bajo/acordes con el modelo Basic Pitch ejecutado en el navegador.
- **Guardar** sus partituras en la nube asociadas a su cuenta.

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
| R3 | La app debe funcionar sin cuenta para editar, escuchar y exportar | Fricción mínima; la cuenta solo es para la nube |
| R4 | UI y textos en español | Público objetivo |
| R5 | `legacy/index.html` no se modifica | Es la referencia del comportamiento |
| R6 | Licencias compatibles con uso comercial (MIT, Apache-2.0, BSD) | Basic Pitch es Apache-2.0, abcjs es MIT |
| R7 | **Todo con planes gratuitos (US$0/mes):** GitHub (repositorio + Actions), Vercel Hobby, Supabase Free | Decisión del usuario 2026-10-18 (ver 2.6) |
| R8 | Código en GitHub y despliegue en Vercel desde `main` | Decisión del usuario 2026-10-18 |

### 1.5 No-objetivos del MVP

- Edición polifónica (varias voces, acordes en el pentagrama, sistemas de piano a dos manos).
- Tresillos al escribir, ligaduras manuales, letra, repeticiones, casillas, dinámicas, articulaciones.
- Colaboración en tiempo real o compartir partituras públicas.
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

| Pieza | Elección | Justificación |
|---|---|---|
| Plataforma | Supabase | Postgres + Auth + Storage gestionados; RLS evita escribir un servidor |
| Base de datos | PostgreSQL 15 (Supabase) | JSONB para las notas, constraints y triggers |
| Auth | Supabase Auth: enlace mágico por email + Google OAuth | Sin contraseñas que recordar; Google es común en el público objetivo |
| Storage | Bucket privado `audio` | Guardar audios de "De oído" para reabrirlos (opcional, ver 3.2) |
| Lógica de servidor | Ninguna (solo RLS, constraints y triggers) | R2; menos superficie de ataque |

### 2.3 Hosting

- **Plataforma:** Vercel plan **Hobby (gratis)**, sitio estático (salida de `vite build`), sin funciones de servidor.
- **Repositorio:** GitHub `Niicko12/atril` (privado), conectado a Vercel por la integración de Git.
- **Justificación:** despliegue por push, preview por rama, CDN global para el modelo y las librerías.
- **Dominios/entornos:**
  - `main` → producción.
  - Cualquier otra rama → preview con el proyecto Supabase de desarrollo.
- **Variables de entorno (públicas, prefijo `VITE_`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  No hay secretos en el frontend; la clave anónima es pública por diseño y la seguridad recae en RLS.

### 2.4 Herramientas de desarrollo

| Herramienta | Uso |
|---|---|
| pnpm | Gestor de paquetes |
| ESLint (typescript-eslint, react-hooks, import) | Reglas de estructura (sección 17) |
| Prettier | Formato |
| Vitest | Unit tests del núcleo y de hooks |
| Testing Library | Tests de componentes |
| Playwright | E2E en Chromium y WebKit (iPhone) |
| dependency-cruiser | Validar dirección de capas y ciclos |
| Supabase CLI | Migraciones SQL versionadas, tipos generados |

> Las versiones exactas se fijan en `package.json` al crear el proyecto y se registran en `docs/development/current/`.

### 2.5 Costos: todo en planes gratuitos (R7)

| Servicio | Plan | Límites relevantes (verificar en la página oficial al crear las cuentas) | Cómo se respeta |
|---|---|---|---|
| GitHub | Free | Repos privados ilimitados; Actions ~2 000 min/mes en repos privados | CI corta (Playwright solo en PR a `main`); si se agotan los minutos, hacer el repo público o correr E2E local |
| Vercel | Hobby | Uso personal / no comercial; ancho de banda mensual limitado | Sitio estático, modelo con caché inmutable; si Atril se monetiza hay que pasar a un plan pago (decisión futura) |
| Supabase | Free | 2 proyectos; ~500 MB de BD; ~1 GB de Storage; ~50 MB por archivo; **se pausa tras ~1 semana sin actividad**; **sin backups automáticos**; email de Auth integrado con límite muy bajo por hora | Ver mitigaciones abajo |
| Email de login | Gratis | El SMTP integrado de Supabase solo sirve para pruebas | **Google OAuth es el método principal**; enlace mágico con SMTP gratuito externo (p. ej. Resend free) si se necesita volumen; verificar límites |
| Dominio | Subdominio gratis `*.vercel.app` | — | Sin dominio propio en el MVP |

Mitigaciones del plan gratuito de Supabase:

1. **Pausa por inactividad:** workflow de GitHub Actions programado (cada 3 días) que hace una consulta de lectura
   anónima a la API REST (`/rest/v1/` con la clave anónima). No consume minutos relevantes.
2. **Sin backups:** workflow semanal de GitHub Actions con `supabase db dump` (solo esquema + datos de `scores` y
   `profiles`), cifrado con `age` usando una clave guardada en GitHub Secrets, subido como artifact con retención de
   7 días. Antes de cada migración en producción, dump manual.
3. **Dos proyectos máximo:** `atril-dev` y `atril-prod`; no se crean proyectos extra por rama.
4. **Storage de 1 GB total:** F14 queda con cuota de **20 MB por archivo y 100 MB por usuario**; si el uso se acerca
   al límite, F14 se desactiva con el flag `features.audioUpload`.

### 2.6 Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir como artifact | El usuario quiere cuentas y partituras en la nube independientes de Claude |
| Next.js | No se necesita SEO ni SSR en el MVP; añade complejidad de servidor |
| VexFlow / OpenSheetMusicDisplay | Más potentes para polifonía, pero abcjs ya resuelve el MVP y la conversión a ABC existe |
| Redux Toolkit | Más ceremonia que Zustand para un store principal |
| Firebase | Supabase da SQL, RLS y migraciones versionadas |
| Tone.js | El sintetizador propio de legacy ya está afinado; añadirlo duplicaría lógica |
| Spotify Basic Pitch npm (`@spotify/basic-pitch`) | Válido; se evalúa en semana 1. Si funciona con el modelo empaquetado, reemplaza el código minificado embebido |

---

## 3. Features V1 (MVP)

### 3.1 Lista priorizada

| ID | Feature | Prioridad | Paridad legacy | Cambios respecto a legacy |
|---|---|---|---|---|
| F01 | Editor monofónico: piano, diapasón, Do-Re-Mi, teclado de computadora | Must | Sí | Deshacer completo (F10) |
| F02 | 18 instrumentos con transposición, rango y tablatura | Must | Sí | — |
| F03 | Vista "para el instrumento" / "sonido real", nombres de notas | Must | Sí | — |
| F04 | Reproducción sintetizada por familia, resaltado de nota en curso | Must | Sí | Motor en módulo propio |
| F05 | Importar MusicXML/.mxl/MIDI/ABC | Must | Sí | Corrige deuda 2, 3, 9 |
| F06 | Exportar PDF, PNG, ABC, ZIP MuseScore | Must | Sí | Descarga nativa del navegador |
| F07 | De oído: YIN (voz sola), melodía en mezcla, Basic Pitch (partes) | Must | Sí | En Web Worker; corrige deuda 4, 5, 6 |
| F08 | Reproductor de audio: onda, A-B, velocidad sin cambio de tono | Must | Sí | WSOLA en Worker |
| F09 | Cuentas (enlace mágico + Google) y "Mis partituras" en la nube | Must | No (era localStorage) | Corrige deuda 1 |
| F10 | Deshacer/rehacer completo (notas + metadatos) | Must | Parcial | Corrige deuda 8 |
| F11 | Borrador local automático (sin cuenta) | Must | Sí | IndexedDB en vez de localStorage |
| F12 | Ejemplos de dominio público | Should | Sí | — |
| F13 | Enlaces a sitios de partituras | Should | Sí | — |
| F14 | Guardar el audio original junto a la partitura | Could | No | Storage; solo si sobra tiempo |
| F15 | Aviso al recortar notas en "Mover todo" | Must | No | Corrige deuda 7 |

### 3.2 Criterio para F14

F14 entra solo si al terminar la semana 5 el resto de Must está aprobado. El schema (tabla `audio_sources`) se crea
desde el inicio para no migrar después, pero la UI queda oculta tras el flag `features.audioUpload`.

---

## 4. Integraciones

| Servicio | Uso | Notas |
|---|---|---|
| Supabase Auth | Enlace mágico, Google OAuth, sesión | Redirect URLs: producción y previews de Vercel |
| Supabase Postgres | Tablas `profiles`, `scores`, `audio_sources` | RLS por `owner_id` |
| Supabase Storage | Bucket privado `audio` | F14; límite 20 MB por archivo y 100 MB por usuario (plan gratuito, 2.5) |
| Vercel | Hosting estático | Cabeceras de caché y CSP en `vercel.json` |
| IA externa | **Ninguna** (R1) | Basic Pitch corre local |

---

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
│  │  └─ Overlays: Find/Open · Library · Image · Auth         │         │
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
│  IndexedDB ◄────── draft-service         │  └────────────────────┘     │
└──────────────────────────────────────────┼─────────────────────────────┘
                                           │ HTTPS (supabase-js)
                         ┌─────────────────▼────────────────┐
                         │ Supabase                         │
                         │  Auth · Postgres (RLS) · Storage │
                         └──────────────────────────────────┘
```

### 6.2 Capas

| Capa | Carpeta | Contenido | Puede importar |
|---|---|---|---|
| UI | `src/modules/*/components`, `src/app` | Componentes React | Business, Core, Shared |
| Business | `src/modules/*/hooks`, `*/services`, `*/store` | Estado, efectos, IO | Core, Shared, Data |
| Workers | `src/workers` | Cómputo pesado | Core |
| Core | `src/core` | Funciones puras sin DOM ni React | Solo Core |
| Data/Infra | `src/infra` | Cliente Supabase, IndexedDB, descargas | Shared types |
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
  → draftService.save(score)  (debounce 800 ms, IndexedDB)
  → si la partitura está en la nube: librarySync.markDirty() (autoguardado 5 s, ver 12.4)
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

### 6.5 Flujo de datos: guardar en la nube

```
Usuario sin sesión pulsa "Guardar"
  → AuthOverlay (enlace mágico / Google) → vuelve con sesión
  → libraryService.upsert(score)  // INSERT o UPDATE con control de versión
     → ok: score.remote = {id, version}; toast "Guardada"
     → conflicto (version distinta): ConflictDialog (12.4)
     → sin red: queda en cola local (draft) y estado "pendiente"
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
├── supabase/
│   ├── migrations/               # SQL versionado (sección 7)
│   └── seed.sql                  # ejemplos de dominio público
├── scripts/
│   ├── split-bp-model.mjs        # convierte legacy/bp-model.json → public/models/...
│   └── legacy-fixtures.mjs       # genera fixtures dorados desde legacy (16.2)
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── app-shell.tsx
│   │   ├── providers.tsx         # QueryClient, AuthProvider
│   │   └── theme.css             # tokens portados de legacy
│   ├── core/                     # PURO
│   │   ├── theory/
│   │   │   ├── spelling.ts       # spell, keyAcc, normF, nameOf, midiName
│   │   │   ├── keys.ts           # MAJ, MIN, ABCKEY
│   │   │   └── index.ts
│   │   ├── instruments/
│   │   │   ├── catalog.ts        # INSTR (18)
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
│   │   ├── supabase-client.ts
│   │   ├── db-types.ts           # generado por Supabase CLI
│   │   ├── idb.ts                # wrapper IndexedDB
│   │   └── download.ts           # saveBlob
│   ├── modules/
│   │   ├── editor/               # store, input surfaces, tools
│   │   ├── score-view/           # ScoreSheet, status
│   │   ├── playback/             # motor Web Audio
│   │   ├── import/               # abrir archivos, pegar ABC, enlaces
│   │   ├── export/               # PDF, PNG, ZIP, ABC
│   │   ├── ear/                  # De oído
│   │   ├── library/              # Mis partituras, sync
│   │   └── auth/
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
| ADR-005 | Notas como JSONB en `scores.notes` | Tabla `notes` normalizada | Se leen y escriben siempre completas; ≤ 3 000 elementos; menos round-trips |
| ADR-006 | Control de concurrencia optimista por `version` | Último gana | Evita pisar cambios entre dos dispositivos |
| ADR-007 | Borrador local en IndexedDB | localStorage | Más cuota, asíncrono, no bloquea el hilo |
| ADR-008 | Modelo Basic Pitch como archivos estáticos binarios | JSON con base64 (legacy) | −25 % de tamaño, caché HTTP, sin `atob` de 1 MB |
| ADR-009 | Sin router en el MVP | React Router | Una pantalla; los paneles son estado |
| ADR-010 | Editor usable sin cuenta | Login obligatorio | R3 |

---

## 7. Schema de Base de Datos

Proyecto Supabase con dos entornos: `atril-dev` (previews y local) y `atril-prod` (`main`). Todas las tablas viven en
el esquema `public` con RLS activado. Las migraciones se versionan en `supabase/migrations/`.

### 7.1 Diagrama entidad-relación

```
auth.users (Supabase)
   │ 1
   │
   │ 1
profiles ──────────────┐
   │ 1                 │ 1
   │                   │
   │ N                 │ N
scores ◄──────── audio_sources
   (score_id nullable, ON DELETE SET NULL)
```

### 7.2 Tipos enumerados

```sql
create type public.score_source as enum (
  'manual',      -- escrita a mano en Atril
  'sample',      -- cargada de los ejemplos
  'musicxml',    -- importada de .musicxml/.xml/.mxl
  'midi',        -- importada de .mid/.midi
  'abc',         -- importada o pegada en ABC
  'ear_solo',    -- De oído: voz o instrumento solo (YIN)
  'ear_mix',     -- De oído: melodía principal de una mezcla
  'ear_parts'    -- De oído: separación con Basic Pitch
);

create type public.input_mode as enum ('piano', 'fret', 'names');
```

### 7.3 Tabla: profiles

#### Propósito
Datos y preferencias del usuario. Una fila por usuario de `auth.users`, creada por trigger al registrarse.

#### Columnas
| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| id | UUID | No | — | PK y FK a `auth.users.id` |
| display_name | TEXT | Sí | NULL | Nombre visible (máx. 80) |
| default_instrument | TEXT | No | `'piano'` | ID del catálogo de instrumentos |
| input_mode | input_mode | No | `'piano'` | Última forma de escribir usada |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

#### Constraints
- `CHECK (char_length(display_name) <= 80)`
- `CHECK (default_instrument ~ '^[a-z]{2,20}$')` — el catálogo vive en el frontend; se valida forma, no pertenencia.

#### Índices
- PRIMARY KEY (id)

#### Foreign Keys
- id → auth.users.id ON DELETE CASCADE

#### Triggers
- `set_updated_at` BEFORE UPDATE
- `on_auth_user_created` AFTER INSERT ON auth.users → inserta perfil

### 7.4 Tabla: scores

#### Propósito
Cada partitura guardada en la nube. Las notas se guardan completas como JSONB (ADR-005).

#### Columnas
| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| id | UUID | No | gen_random_uuid() | PK |
| owner_id | UUID | No | auth.uid() | FK a profiles.id |
| title | TEXT | No | `'Sin título'` | Máx. 120 caracteres |
| composer | TEXT | No | `''` | Máx. 120 |
| instrument_id | TEXT | No | `'piano'` | ID del catálogo |
| key_fifths | SMALLINT | No | 0 | Tonalidad en sonido real, −6..6 |
| meter | TEXT | No | `'4/4'` | Uno de los 6 compases soportados |
| tempo | SMALLINT | No | 100 | Negras por minuto, 30..240 |
| show_names | BOOLEAN | No | false | Mostrar nombres de notas |
| show_tab | BOOLEAN | No | false | Mostrar tablatura |
| notes | JSONB | No | `'[]'` | Arreglo de `Note` (8.1) |
| note_count | INTEGER | No | generada | `jsonb_array_length(notes)` (STORED) |
| source | score_source | No | `'manual'` | Origen |
| version | INTEGER | No | 1 | Incrementa en cada UPDATE (ADR-006) |
| deleted_at | TIMESTAMPTZ | Sí | NULL | Borrado suave (papelera 30 días) |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

#### Constraints
- `CHECK (char_length(title) BETWEEN 1 AND 120)`
- `CHECK (char_length(composer) <= 120)`
- `CHECK (instrument_id ~ '^[a-z]{2,20}$')`
- `CHECK (key_fifths BETWEEN -6 AND 6)`
- `CHECK (meter IN ('4/4','3/4','2/4','6/8','3/8','12/8'))`
- `CHECK (tempo BETWEEN 30 AND 240)`
- `CHECK (jsonb_typeof(notes) = 'array')`
- `CHECK (jsonb_array_length(notes) <= 3000)`
- `CHECK (pg_column_size(notes) <= 262144)` — 256 KB, holgado para 3 000 notas
- Validación estructural de cada nota: función `public.valid_notes(jsonb)` (7.7) usada en CHECK.

#### Índices
- PRIMARY KEY (id)
- `idx_scores_owner_updated` ON scores(owner_id, updated_at DESC) WHERE deleted_at IS NULL — lista de "Mis partituras"
- `idx_scores_owner_deleted` ON scores(owner_id, deleted_at) WHERE deleted_at IS NOT NULL — papelera

#### Foreign Keys
- owner_id → profiles.id ON DELETE CASCADE

#### Triggers
- `set_updated_at` BEFORE UPDATE
- `bump_version` BEFORE UPDATE: `NEW.version := OLD.version + 1`
- `protect_owner` BEFORE UPDATE: impide cambiar `owner_id`, `created_at`

### 7.5 Tabla: audio_sources (F14, opcional)

#### Propósito
Referencia a un audio subido a Storage para reabrirlo en "De oído". El archivo vive en el bucket privado `audio`
bajo la ruta `{owner_id}/{id}.{ext}`.

#### Columnas
| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| id | UUID | No | gen_random_uuid() | PK |
| owner_id | UUID | No | auth.uid() | FK a profiles.id |
| score_id | UUID | Sí | NULL | Partitura derivada |
| storage_path | TEXT | No | — | Ruta en el bucket |
| file_name | TEXT | No | — | Nombre original (máx. 200) |
| mime_type | TEXT | No | — | `audio/*` o `video/*` |
| size_bytes | INTEGER | No | — | ≤ 20 971 520 (20 MB) |
| duration_sec | REAL | No | — | > 0 y ≤ 900 |
| created_at | TIMESTAMPTZ | No | now() | |

#### Constraints
- `CHECK (mime_type ~ '^(audio|video)/')`
- `CHECK (size_bytes BETWEEN 1 AND 20971520)`
- `CHECK (duration_sec > 0 AND duration_sec <= 900)`
- `CHECK (storage_path = owner_id::text || '/' || id::text || substring(storage_path from '\.[a-z0-9]{2,4}$'))`
- UNIQUE (storage_path)

#### Índices
- PRIMARY KEY (id)
- `idx_audio_owner_created` ON audio_sources(owner_id, created_at DESC)
- `idx_audio_score` ON audio_sources(score_id)

#### Foreign Keys
- owner_id → profiles.id ON DELETE CASCADE
- score_id → scores.id ON DELETE SET NULL

### 7.6 Migración inicial (borrador)

```sql
-- 0001_init.sql
create extension if not exists pgcrypto;

create type public.score_source as enum ('manual','sample','musicxml','midi','abc','ear_solo','ear_mix','ear_parts');
create type public.input_mode as enum ('piano','fret','names');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  default_instrument text not null default 'piano' check (default_instrument ~ '^[a-z]{2,20}$'),
  input_mode public.input_mode not null default 'piano',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- notes validation
create or replace function public.valid_notes(n jsonb) returns boolean
language sql immutable as $$
  select coalesce(bool_and(
    jsonb_typeof(e) = 'object'
    and (e ? 'd') and jsonb_typeof(e->'d') = 'number'
    and (e->>'d')::numeric between 1 and 48
    and (e->>'d')::numeric = floor((e->>'d')::numeric)
    and (e ? 'p')
    and (jsonb_typeof(e->'p') = 'null'
         or (jsonb_typeof(e->'p') = 'number' and (e->>'p')::int between 0 and 127))
    and (not (e ? 'c') or (jsonb_typeof(e->'c') = 'string' and char_length(e->>'c') <= 12))
  ), true)
  from jsonb_array_elements(n) as e
$$;

-- scores
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default 'Sin título' check (char_length(title) between 1 and 120),
  composer text not null default '' check (char_length(composer) <= 120),
  instrument_id text not null default 'piano' check (instrument_id ~ '^[a-z]{2,20}$'),
  key_fifths smallint not null default 0 check (key_fifths between -6 and 6),
  meter text not null default '4/4' check (meter in ('4/4','3/4','2/4','6/8','3/8','12/8')),
  tempo smallint not null default 100 check (tempo between 30 and 240),
  show_names boolean not null default false,
  show_tab boolean not null default false,
  notes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(notes) = 'array')
    check (jsonb_array_length(notes) <= 3000)
    check (pg_column_size(notes) <= 262144)
    check (public.valid_notes(notes)),
  note_count integer generated always as (jsonb_array_length(notes)) stored,
  source public.score_source not null default 'manual',
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_scores_owner_updated on public.scores(owner_id, updated_at desc) where deleted_at is null;
create index idx_scores_owner_deleted on public.scores(owner_id, deleted_at) where deleted_at is not null;

create or replace function public.scores_before_update() returns trigger
language plpgsql as $$
begin
  if new.owner_id <> old.owner_id or new.created_at <> old.created_at then
    raise exception 'owner_id y created_at no se pueden cambiar' using errcode = '42501';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
create trigger scores_before_update before update on public.scores
  for each row execute function public.scores_before_update();

-- audio_sources (F14)
create table public.audio_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  score_id uuid references public.scores(id) on delete set null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 200),
  mime_type text not null check (mime_type ~ '^(audio|video)/'),
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  duration_sec real not null check (duration_sec > 0 and duration_sec <= 900),
  created_at timestamptz not null default now()
);
create index idx_audio_owner_created on public.audio_sources(owner_id, created_at desc);
create index idx_audio_score on public.audio_sources(score_id);
```

### 7.7 Row Level Security

```sql
-- 0002_rls.sql
alter table public.profiles enable row level security;
alter table public.scores enable row level security;
alter table public.audio_sources enable row level security;

create policy "perfil propio: leer" on public.profiles
  for select using (id = auth.uid());
create policy "perfil propio: actualizar" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "partituras propias: leer" on public.scores
  for select using (owner_id = auth.uid());
create policy "partituras propias: crear" on public.scores
  for insert with check (owner_id = auth.uid());
create policy "partituras propias: actualizar" on public.scores
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "partituras propias: borrar" on public.scores
  for delete using (owner_id = auth.uid());

create policy "audios propios: leer" on public.audio_sources
  for select using (owner_id = auth.uid());
create policy "audios propios: crear" on public.audio_sources
  for insert with check (owner_id = auth.uid());
create policy "audios propios: borrar" on public.audio_sources
  for delete using (owner_id = auth.uid());

-- Storage: bucket privado 'audio'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 20971520, array['audio/*','video/mp4','video/quicktime']);

create policy "audio propio: leer" on storage.objects
  for select using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio propio: subir" on storage.objects
  for insert with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio propio: borrar" on storage.objects
  for delete using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
```

### 7.8 Mantenimiento

- **Papelera:** las partituras con `deleted_at` > 30 días se purgan con un `pg_cron` diario
  (`delete from scores where deleted_at < now() - interval '30 days'`). Si `pg_cron` no está disponible en el plan,
  la purga se hace al abrir "Mis partituras" (borrado definitivo de las propias vencidas).
- **Audios huérfanos:** al borrar una fila de `audio_sources`, el cliente borra primero el objeto de Storage. Un
  reporte semanal manual (SQL) lista objetos sin fila.
- **Backups:** el plan gratuito no tiene backups automáticos; se usa el workflow semanal de 2.5 y un dump manual antes de cada migración en producción.

### 7.9 Volumen esperado (MVP)

| Métrica | Estimado | Holgura del diseño |
|---|---|---|
| Usuarios | < 1 000 | — |
| Partituras por usuario | 5-50 | Índice por owner |
| Tamaño de `notes` | 2-40 KB | Límite 256 KB |
| Audios (F14) | < 20 por usuario | 20 MB c/u, 100 MB por usuario |

---

## 8. Interfaces TypeScript

Todos los tipos de dominio viven en `src/core/types/` (un archivo por dominio, ≤ 200 líneas). Los tipos de base de
datos se generan con `supabase gen types typescript` en `src/infra/db-types.ts` y **nunca** se usan fuera de
`src/modules/library` y `src/infra`: se convierten a tipos de dominio en el mapper.

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
  /** ID local estable (también para borradores sin nube). */
  localId: string;
  notes: Note[];
  source: ScoreSource;
  /** Presente si la partitura existe en la nube. */
  remote?: RemoteRef;
}

export interface RemoteRef {
  id: string;
  version: number;
  updatedAt: string;
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
import type { Score, ScoreSummary, RemoteRef } from '../../core/types/score';

export interface ScoreRepository {
  list(): Promise<ScoreSummary[]>;
  listTrash(): Promise<ScoreSummary[]>;
  get(id: string): Promise<Score>;
  /** Inserta si no tiene `remote`, si no actualiza con control de versión. */
  save(score: Score): Promise<RemoteRef>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  purge(id: string): Promise<void>;
}

export type SyncState =
  | { kind: 'local' }                         // nunca guardada en la nube
  | { kind: 'saved'; at: string }
  | { kind: 'dirty' }                         // cambios sin subir
  | { kind: 'saving' }
  | { kind: 'offline' }                       // cambios en cola local
  | { kind: 'conflict'; remote: RemoteRef }
  | { kind: 'error'; message: string };
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
  // nube
  | 'auth_required'
  | 'sync_conflict'
  | 'sync_offline'
  | 'sync_validation'
  | 'sync_unknown'
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

### 8.11 Mapper base de datos ↔ dominio (`modules/library/services/score-mapper.ts`)

```typescript
import type { Database } from '../../../infra/db-types';
import type { Score, ScoreSummary } from '../../../core/types/score';

type Row = Database['public']['Tables']['scores']['Row'];
type Insert = Database['public']['Tables']['scores']['Insert'];

export function rowToScore(row: Row): Score;          // valida con validateScore()
export function scoreToInsert(s: Score): Insert;      // sin id/version/owner
export function rowToSummary(row: Pick<Row, 'id' | 'title' | 'composer' | 'instrument_id'
  | 'note_count' | 'updated_at' | 'deleted_at'>): ScoreSummary;
```

---

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
├── library/
│   ├── components/        # LibraryOverlay, ScoreRow, TrashList, ConflictDialog, SyncBadge
│   ├── hooks/             # use-score-list, use-autosave-remote
│   ├── services/          # score-repository.ts, score-mapper.ts, draft.service.ts
│   ├── types.ts
│   └── index.ts
└── auth/
    ├── components/        # AuthOverlay, UserMenu
    ├── hooks/             # use-session
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
library    → editor (lectura/replaceScore), auth (sesión)
auth       → (ninguno)
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
import { supabase } from '@/infra/supabase-client';
import { AppError } from '@/shared/errors';
import { rowToScore, rowToSummary, scoreToInsert } from './score-mapper';
import type { ScoreRepository } from '../types';

const SUMMARY_COLUMNS = 'id,title,composer,instrument_id,note_count,updated_at,deleted_at';

export function createScoreRepository(client = supabase): ScoreRepository {
  return {
    async list() {
      const { data, error } = await client.from('scores').select(SUMMARY_COLUMNS)
        .is('deleted_at', null).order('updated_at', { ascending: false });
      if (error) throw toAppError(error);
      return data.map(rowToSummary);
    },
    async save(score) {
      if (!score.remote) return insert(client, score);
      return updateWithVersion(client, score);   // ver 11.3
    },
    // get, listTrash, softDelete, restore, purge ...
  };
}

function toAppError(e: { code?: string; message: string }): AppError {
  // 23514 = check_violation → sync_validation; PGRST301/JWT → auth_required; fetch failed → sync_offline
}
```

Reglas de services:
- Factoría con dependencias inyectables (cliente Supabase, worker) para testear sin red.
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
- No llaman a Supabase directamente: usan un service.
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
| Sesión | `useSession` (Supabase `onAuthStateChange`) | Fuente de verdad es Supabase |
| Lista "Mis partituras" | TanStack Query `['scores']` | Datos remotos con caché |
| Estado de sincronización | `useSyncStore` | Badge y diálogo de conflicto |
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

### 11.3 Datos remotos y sincronización

- **Lectura:** TanStack Query, `staleTime` 30 s, refetch al volver a la pestaña.
- **Escritura:** guardado explícito ("Guardar") + autoguardado cada 5 s si la partitura ya está en la nube y hay
  cambios (`dirty`).
- **Control de versión (ADR-006):**

```typescript
const { data, error } = await client.from('scores')
  .update(scoreToInsert(score))
  .eq('id', score.remote.id)
  .eq('version', score.remote.version)      // solo si nadie la cambió
  .select('id,version,updated_at')
  .maybeSingle();
if (!error && !data) throw new AppError('sync_conflict', 'Esta partitura cambió en otro dispositivo.');
```

- **Conflicto:** `ConflictDialog` ofrece: "Quedarme con la mía" (sobrescribe usando la versión remota actual),
  "Usar la de la nube" (descarta local, recuperable con deshacer) o "Guardar la mía como copia" (INSERT nuevo).
- **Sin red:** el borrador local se mantiene en IndexedDB con `pendingSync: true`; al volver `online` se reintenta.
- **Optimistic updates:** solo para renombrar/borrar en la lista; el contenido de la partitura no se actualiza de
  forma optimista en la lista.

### 11.4 Borrador local

- `draft.service.ts` guarda la partitura actual en IndexedDB (`atril` DB, store `draft`, clave `current`) con
  debounce de 800 ms.
- Al arrancar: si hay borrador, se abre; si no, el ejemplo "Himno de la alegría" (como legacy).
- Si IndexedDB no está disponible (modo privado de algunos navegadores): se trabaja en memoria y se muestra un aviso
  único: "En esta ventana tus cambios no se guardan en el dispositivo".
- Al cargar otra partitura con cambios sin guardar: si hay sesión, se guarda automáticamente en la nube; si no, se
  pregunta "¿Descartar los cambios?" (legacy guardaba en silencio en localStorage).

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
| Supabase client | Al inicio (pequeño); sesión restaurada en segundo plano |

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

### 12.4 Sincronización con la nube

```
              guardar (sin sesión) → AuthOverlay → guardar
 ┌───────┐ ─────────────────────────────────────────────────► ┌────────┐
 │ Local │                                                    │ Saving │
 └───────┘                                                    └───┬────┘
                                         ok                       │
              ┌───────────────────────────────────────────────────┤
              ▼                                                   │ conflicto
         ┌────────┐  editar   ┌───────┐  5 s / guardar  ┌────────┐│
         │ Saved  │ ────────► │ Dirty │ ──────────────► │ Saving ││
         └────────┘           └───┬───┘                 └───┬────┘▼
              ▲                   │ sin red                 │  ┌──────────┐
              │                   ▼                         │  │ Conflict │
              │              ┌─────────┐   online           │  └────┬─────┘
              └───────────── │ Offline │ ───────────────────┘       │ resolver
                             └─────────┘                            ▼
                                                              Saving / Saved
```

### 12.5 Sesión

```
 Anónimo ──(enlace mágico / Google)──► Autenticando ──ok──► Autenticado
    ▲                                       │ error                │
    │                                       ▼                      │ cerrar sesión
    └──────────────────────────────── Error (mensaje) ◄────────────┘
                                                                   ▼
                                                                Anónimo
```

Al cerrar sesión: el borrador local se conserva pero se desvincula de la nube (`remote` se elimina) para no mezclar
cuentas en un dispositivo compartido; se avisa al usuario.

---

## 13. Seguridad

### 13.1 Modelo de amenazas (resumen)

| Activo | Amenaza | Control |
|---|---|---|
| Partituras de un usuario | Otro usuario las lee o modifica | RLS por `owner_id` en todas las operaciones (7.7) |
| Audios subidos | Acceso público al bucket | Bucket privado + políticas por carpeta `{uid}/` + URLs firmadas de 10 min |
| Sesión | Robo de token por XSS | CSP estricta, sin `dangerouslySetInnerHTML`, React escapa por defecto |
| Navegador del usuario | Archivo malicioso (zip bomb, XML enorme, MIDI corrupto) | Límites de tamaño, parseo defensivo, Workers |
| Base de datos | Datos inválidos desde el cliente | CHECK constraints + `valid_notes()` |
| Cuenta | Spam de enlaces mágicos | Rate limit nativo de Supabase Auth + CAPTCHA (hCaptcha de Supabase) si hay abuso |

### 13.2 Autenticación

- **Métodos:** enlace mágico por email (OTP) y Google OAuth. Sin contraseñas.
- **Flujo PKCE** (`flowType: 'pkce'` en supabase-js).
- **Redirect URLs permitidas:** dominio de producción y patrón de previews de Vercel del proyecto. Ninguna otra.
- **Sesión:** persistida por supabase-js en `localStorage` (requisito de la librería); refresco automático.
- **Usuario anónimo:** puede editar, escuchar, importar, exportar y usar De oído. Solo "Guardar en la nube", "Mis
  partituras" y F14 requieren sesión.

### 13.3 Autorización

- Un solo rol (`authenticated`) en el MVP; no hay RBAC ni administradores en la app.
- Toda la autorización está en Postgres (RLS). El frontend nunca decide permisos.
- `owner_id` lo pone la base (`default auth.uid()`) y el trigger impide cambiarlo.

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
connect-src 'self' https://<proyecto>.supabase.co wss://<proyecto>.supabase.co;
img-src 'self' data: blob:;
media-src 'self' blob:;
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

- No hay API propia; CORS lo gestiona Supabase (orígenes permitidos: producción y previews).
- Rate limiting: el de Supabase Auth (emails) y PostgREST. En el cliente, el autoguardado no envía más de 1
  petición cada 5 s por partitura.

### 13.8 Privacidad

- El audio se procesa localmente; solo se sube si el usuario activa F14 de forma explícita.
- Sin analítica ni rastreadores en el MVP.
- "Borrar mi cuenta": borra `auth.users` (cascada a profiles, scores, audio_sources) y los objetos de Storage.
  En el MVP se hace desde un enlace de soporte; la UI propia queda para después.

---

## 14. APIs (Supabase)

No hay endpoints propios. El cliente usa supabase-js contra PostgREST, Auth y Storage. Esta tabla es el contrato.

### 14.1 Auth

| Operación | Llamada | Auth |
|---|---|---|
| Enviar enlace mágico | `auth.signInWithOtp({ email, options: { emailRedirectTo } })` | No |
| Google | `auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` | No |
| Intercambiar código PKCE | automático en `detectSessionInUrl` | — |
| Sesión actual | `auth.getSession()` / `onAuthStateChange` | — |
| Cerrar sesión | `auth.signOut()` | Sí |

### 14.2 Perfiles

| Operación | Llamada | Auth |
|---|---|---|
| Leer el propio | `from('profiles').select('*').eq('id', uid).single()` | Sí |
| Actualizar preferencias | `from('profiles').update({ default_instrument, input_mode }).eq('id', uid)` | Sí |

### 14.3 Partituras

| Operación | Llamada | Auth | Notas |
|---|---|---|---|
| Listar | `from('scores').select(SUMMARY).is('deleted_at', null).order('updated_at', {ascending:false})` | Sí | Sin `notes` |
| Papelera | `...not('deleted_at','is',null)` | Sí | |
| Abrir | `from('scores').select('*').eq('id', id).single()` | Sí | |
| Crear | `from('scores').insert(row).select('id,version,updated_at').single()` | Sí | |
| Guardar | `update(row).eq('id', id).eq('version', v).select(...).maybeSingle()` | Sí | `null` → conflicto |
| Duplicar | Crear con `title + ' (copia)'` | Sí | Cliente |
| Mover a papelera | `update({ deleted_at: now })` | Sí | |
| Restaurar | `update({ deleted_at: null })` | Sí | |
| Borrar definitivo | `delete().eq('id', id)` | Sí | Requiere confirmación doble en UI |

### 14.4 Audio (F14)

| Operación | Llamada | Auth |
|---|---|---|
| Subir | `storage.from('audio').upload(`${uid}/${id}.${ext}`, file, { upsert: false })` + insert en `audio_sources` | Sí |
| URL temporal | `storage.from('audio').createSignedUrl(path, 600)` | Sí |
| Borrar | `storage.from('audio').remove([path])` + delete fila | Sí |

### 14.5 Códigos de error de Supabase → AppError

| Origen | Código | AppError |
|---|---|---|
| Postgres | `23514` (check_violation) | `sync_validation` |
| Postgres | `42501` (insufficient_privilege) | `auth_required` |
| PostgREST | `PGRST301`, JWT expirado | `auth_required` (refrescar y reintentar 1 vez) |
| PostgREST | `PGRST116` (0 filas en `.single()`) | `sync_unknown` (partitura no encontrada) |
| Red | `TypeError: Failed to fetch` | `sync_offline` |
| Storage | `413` | `import_file_too_large` |

---

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
| Lista "Mis partituras" | ≤ 500 ms p95 | TanStack Query devtools |
| Guardar partitura | ≤ 700 ms p95 | Ídem |

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
| Services / stores | Vitest + mocks de Supabase y Worker | 85 % |
| Hooks | Vitest + `@testing-library/react` (`renderHook`) | 80 % |
| Componentes | Vitest + Testing Library (jsdom) | 75 % |
| Global | — | 85 % líneas |
| Base de datos | Supabase CLI + pgTAP | 100 % de políticas RLS con test |
| E2E | Playwright (Chromium + WebKit móvil) | Flujos críticos 16.6 |

### 16.2 Tests dorados contra legacy

`legacy/index.html` expone su núcleo con `module.exports = {INSTR, buildAbc, toMusicXML, toMidi, parseMidi,
parseMusicXML, parseAbcTune, spell, toMeasures}` cuando existe `module`. El script `scripts/legacy-fixtures.mjs`:

1. Extrae el bloque `<script>` del núcleo musical de `legacy/index.html`.
2. Lo evalúa en un `vm` de Node con `module` definido.
3. Para un conjunto de partituras de entrada (ejemplos + casos borde de `tests/fixtures/scores/*.json`) y los 18
   instrumentos × 2 vistas, guarda las salidas de `buildAbc`, `toMusicXML`, `toMidi` (hex) y `spell`.
4. Los tests de `src/core` comparan la salida del código portado con estos dorados.

Diferencias intencionales (correcciones de la sección 18) se marcan en `tests/fixtures/golden/EXCEPTIONS.md` con el
motivo; cualquier otra diferencia hace fallar el test.

### 16.3 Core: casos obligatorios

- **spelling:** las 12 clases de altura en las 13 armaduras; dobles alteraciones; octava correcta en Si♯/Do♭.
- **toMeasures:** nota que cruza 1 y 2 barras; duraciones 5, 7, 9, 11, 13, 15 (puntillos y ligaduras); compases
  6/8 y 12/8; partitura vacía.
- **buildAbc:** accidentales dentro de compás (se repiten tras la barra); `charMap` apunta al índice correcto con
  nombres y acordes activos; transposición escrita para los 18 instrumentos; clef auto.
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
2. Errores de Supabase mapeados a `AppError` (tabla 14.5).
3. Respuestas vacías.
4. Conflicto de versión (repository).
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
| Login con enlace mágico (Inbucket local de Supabase) → guardar → recargar → abrir | Chromium |
| Conflicto: dos contextos editan la misma partitura → diálogo | Chromium |
| Sin red: editar → offline → online → se sincroniza | Chromium |

### 16.7 Base de datos (pgTAP)

- Usuario A no puede leer, actualizar ni borrar partituras de B.
- `owner_id` no cambia por UPDATE.
- `version` incrementa en cada UPDATE.
- CHECK rechaza: tempo 29/241, key 7, meter '5/4', 3 001 notas, nota con `d: 0`, `p: 128`, `c` de 13 caracteres.
- Storage: A no puede leer `{B}/archivo`.

---

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

1. `pnpm typecheck`
2. `pnpm lint` (incluye reglas de estructura)
3. `pnpm depcruise`
4. `pnpm test --coverage` (umbrales 16.1)
5. `pnpm build` + verificación de tamaño de bundle (15.2)
6. `supabase db test` (pgTAP) contra base local
7. `pnpm e2e` (Playwright) en PRs a `main`
8. Lighthouse CI sobre el preview de Vercel (advertencia, no bloqueo, en el MVP)

Un PR no se fusiona si falla cualquiera de 1-7.

### 17.3 Definition of Done por tarea

- [ ] Cumple la spec del módulo (cuando exista en `docs/reference/modules/`).
- [ ] Tests nuevos según sección 16; cobertura no baja.
- [ ] Sin violaciones de 17.1.
- [ ] Textos en español revisados en `strings.ts`.
- [ ] Probado en navegador real: Chrome de escritorio y Safari de iPhone (o simulador).
- [ ] Accesible: etiquetas, foco visible, uso con teclado.
- [ ] Si cambia schema: migración nueva + tipos regenerados + test pgTAP.
- [ ] Log del día en `docs/development/current/`.

### 17.4 Revisión de código

- Todo PR con descripción, capturas en móvil si toca UI y referencia a la tarea.
- Revisión obligatoria de: migraciones SQL, políticas RLS, CSP, Workers.

---

## 18. Resolución de la deuda de legacy

| # | Problema (legacy) | Decisión técnica | Dónde | Test que lo cubre |
|---|---|---|---|---|
| 1 | "Mis partituras" en localStorage | Supabase `scores` + borrador en IndexedDB (ADR-005, ADR-007) | library, infra/idb | E2E login→guardar→recargar |
| 2 | MusicXML ignora `<forward>`/`<backup>` y anacrusa | Llevar un cursor de tiempo por medida para la voz elegida: `<backup>` retrocede, `<forward>` en la voz elegida agrega silencio; detectar anacrusa (`implicit="yes"` o primer compás más corto que la barra) y **rellenar con silencio inicial** + warning `pickup_padded`. El soporte real de anacrusa (`pickup` en el modelo) queda post-MVP | core/formats/musicxml-import | Fixtures con anacrusa y varias voces |
| 3 | Acorde MusicXML toma la primera nota | Agrupar `<note>` con `<chord/>` en el mismo inicio y quedarse con la más aguda; warning `polyphony_reduced` | core/formats/musicxml-import | Fixture de acordes |
| 4 | Separación ≥55 / ≤52 pierde MIDI 53-54 | Melodía = skyline superior sobre **todos** los eventos; bajo = skyline inferior sobre los eventos restantes con `p ≤ 60`; ninguna nota queda sin asignar por umbral | core/analysis/skyline + ear.service | Test sintético con notas 53-54 |
| 5 | YIN costoso en hilo principal | Worker (ADR-004) + diferencia por FFT (15.3) | workers/pitch, core/analysis/yin | Test de rendimiento 15.2 |
| 6 | Texto "1 minuto" vs 90 s | Constantes únicas `EAR_LIMITS` usadas por código y textos (12.3) | modules/ear/strings.ts | Test que compara textos con constantes |
| 7 | "Mover todo" recorta en silencio | `shiftAll` devuelve `{clipped}`; si `clipped > 0` el toast dice "N notas quedaron en el límite del rango" con botón "Deshacer" | core/score/score-ops, editor store | Unit + componente |
| 8 | Deshacer solo cubre notas | Historial de `Snapshot {notes, meta}` + rehacer (10.5) | editor store | Unit |
| 9 | MIDI: solo primer tempo/compás | Mantener primer tempo/compás pero emitir warnings `tempo_changes` / `meter_changes`; registrar running status correctamente tras eventos meta/sysex | core/formats/midi-import | Fixtures con cambios |
| 10 | Re-render y guardado por cada nota | rAF para render, debounce 800 ms para borrador, 5 s para nube (11.2, 11.4) | score-view, library | Medición 15.2 |

Correcciones menores detectadas al revisar legacy:

| Hallazgo | Decisión |
|---|---|
| Título con `%` rompe el ABC (se interpreta como comentario) | `abc-escape.ts` elimina `%` y saltos de línea |
| Caché Karplus-Strong sin límite | LRU de 128 entradas (11.7) |
| Diapasón con trastes para violín/viola/chelo | Mantener (ayuda visual), pero rotular "posiciones" en vez de "trastes" para instrumentos sin trastes |
| Librerías desde CDN | Empaquetadas (13.5) |
| Fuentes de Google Fonts | Locales (13.5) |
| Al cargar otra partitura se guardaba en silencio en la biblioteca | Pregunta o guarda en la nube según sesión (11.4) |

---

## 19. Dependencias y Riesgos

### 19.1 Dependencias externas

| Dependencia | Licencia | Riesgo | Mitigación |
|---|---|---|---|
| abcjs | MIT | Rendimiento con partituras largas | Render diferido; límite 3 000 notas |
| TensorFlow.js | Apache-2.0 | Tamaño (~1 MB gzip) y soporte WebGL en iOS | Carga diferida; fallback CPU con aviso de lentitud |
| Basic Pitch (modelo y post-proceso) | Apache-2.0 | Código minificado embebido difícil de mantener | Evaluar paquete npm oficial en semana 1; incluir NOTICE |
| Supabase | Servicio | Plan gratuito: pausa por inactividad, sin backups, 1 GB de Storage | Ping programado y backup semanal con GitHub Actions (2.5); sin planes pagos (R7) |
| Vercel | Servicio | — | Sitio estático portable a cualquier CDN |
| JSZip, jsPDF | MIT | — | — |

### 19.2 Riesgos del proyecto

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| RK1 | Diferencias sutiles al portar el núcleo musical | Media | Alto | Tests dorados contra legacy (16.2) desde la semana 1 |
| RK2 | Audio en iOS (desbloqueo, interruptor de silencio, AudioContext suspendido) | Alta | Alto | Portar el código de legacy tal cual; E2E en WebKit + prueba manual en iPhone cada semana |
| RK3 | TF.js en Worker sin WebGL (OffscreenCanvas no disponible en algunos Safari) | Media | Medio | Probar en semana 1; si falla, ejecutar Basic Pitch en el hilo principal como legacy con UI de progreso |
| RK4 | Memoria al decodificar audios largos en móviles | Media | Medio | Límite 15 min; mono Float32 inmediato; liberar buffers estéreo |
| RK5 | Conflictos de sincronización confusos para el usuario | Baja | Medio | Diálogo con 3 opciones claras; "copia" nunca pierde datos |
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
| RLS | Row Level Security de Postgres |
| ABC | Notación musical en texto plano |

---

## 21. Próximos Pasos

1. [x] /oden:init — estructura y decisiones iniciales
2. [x] /oden:architect — arquitectura, schema, tipos, estructura de código y calidad (este documento)
3. [ ] /oden:analyze — análisis competitivo (MuseScore, Flat.io, Noteflight, Soundslice/Moises)
4. [ ] /oden:spec — specs de 800+ líneas por módulo:
   - [ ] `editor` (store, historial, superficies de entrada, atajos)
   - [ ] `notation-core` (teoría, compases, ABC, transposición) — incluye `score-view`
   - [ ] `formats` (importadores y exportadores)
   - [ ] `ear` (audio, Workers, análisis)
   - [ ] `library` (auth, nube, borrador, conflictos)
   - [ ] `playback`
5. [ ] /oden:plan — plan semana por semana (6-8 semanas)
6. [ ] /oden:architect checklist — verificación pre-código

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Technical Architect
