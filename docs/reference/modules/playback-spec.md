---
name: atril-playback-spec
status: in-progress
created: 2026-10-18T13:03:42Z
updated: 2026-10-18T13:03:42Z
---

# Spec: Módulo `playback` (sintetizador)

**Estado:** 🟡 Lista para revisión
**Features:** F04 (reproducción sintetizada por familia, resaltado de la nota en curso)
**Historias:** US-P01, US-P02, US-P03; soporte de US-W01 (sonido al tocar) y F16 (posición compartida)
**Referencia de comportamiento:** `legacy/index.html` líneas 876-1049 (contexto de audio, desbloqueo en iOS,
Karplus-Strong, piano aditivo, timbres sostenidos, programación y resaltado)
**Ubicación:** `src/modules/playback`

---

## Índice

1. Alcance
2. Code Structure
3. API pública
4. Contexto de audio compartido
5. Desbloqueo en iOS y modo silencio
6. Cadena de salida
7. Timbres
   - 7.1 Cuerda pulsada (guitarra, bajo)
   - 7.2 Piano
   - 7.3 Timbres sostenidos (cuerda frotada, flauta, lengüeta, metal, voz)
   - 7.4 Timbre por defecto
8. Vista previa de una nota
9. Reproducción de la partitura
10. Programador con anticipación (lookahead)
11. Posición y resaltado
12. Detener y limpiar
13. Interacción con otros módulos
14. Máquina de estados
15. Validaciones
16. Edge cases
17. Errores
18. Accesibilidad
19. Performance
20. Testing scenarios
21. Quality Gates
22. Trazabilidad
23. Diferencias intencionales con legacy
24. Preguntas abiertas

---

## 1. Alcance

| Hace | No hace |
|---|---|
| Crear y mantener un único `AudioContext` para toda la app | Reproducir el audio de "De oído" (lo hace `ear`, sobre el mismo contexto) |
| Desbloquear el audio en iOS y sonar con el interruptor de silencio | Samples grabados de instrumentos (post-MVP) |
| Sintetizar una nota con el timbre de la familia del instrumento | Metrónomo, cuenta de entrada, bucle de la partitura (post-MVP) |
| Vista previa al tocar una tecla o seleccionar una nota | Exportar audio (WAV/MP3) |
| Reproducir la partitura desde una nota, informar la nota que suena | Dinámicas o articulaciones (no existen en el modelo) |
| Detener todo al editar | |

El sonido es **sintético a propósito**: sin descargas extra, sin licencias de bancos de sonido, funciona sin
conexión tras la primera carga y pesa < 15 KB de código.

---

## 2. Code Structure

```
src/modules/playback/
├── engine/
│   ├── context.ts           (≤ 80)   # getContext(), master, compresor, resume en visibilitychange
│   ├── ios-unlock.ts        (≤ 80)   # unlock(): buffer vacío + <audio> silencioso en bucle + audioSession
│   ├── silent-wav.ts        (≤ 40)   # WAV de 800 muestras a 8 kHz en data URI
│   ├── voices.ts            (≤ 60)   # registro de nodos vivos y stopAll
│   ├── synth-plucked.ts     (≤ 100)  # Karplus-Strong + caché LRU
│   ├── synth-piano.ts       (≤ 100)  # aditivo con inarmonicidad + martillo
│   ├── synth-sustained.ts   (≤ 150)  # presets bow/flute/reed/brass/voice
│   ├── presets.ts           (≤ 80)   # tabla de parámetros (size-exception si crece)
│   ├── tone.ts              (≤ 60)   # tone(midi, t0, dur, timbre) → despacha al sintetizador
│   └── scheduler.ts         (≤ 150)  # lookahead + posición
├── hooks/
│   └── use-playback.ts      (≤ 80)   # estado playing, play/stop para la UI
├── store/
│   └── playback-position.store.ts (≤ 40)  # índice que suena (lo leen score-view y ear/F16)
├── engine.ts                (≤ 80)   # implementación de PlaybackEngine (technical-decisions 8.8)
├── types.ts · index.ts
```

Archivos de lógica: 14 ✅.

Reglas:
- Ningún archivo de `engine/` importa React.
- `Math.random` se permite **solo** aquí (ruido del martillo, del aliento y de Karplus-Strong); los tests inyectan
  un generador con semilla.

---

## 3. API pública

```typescript
// index.ts
export { playbackEngine } from './engine';            // singleton
export { usePlayback } from './hooks/use-playback';
export { usePlaybackPositionStore } from './store/playback-position.store';
export type { PlaybackEngine, PlayOptions, PlaybackHandle } from './types';
```

```typescript
// types.ts (amplía technical-decisions 8.8)
export interface PlaybackEngine {
  getContext(): AudioContext;                 // crea perezosamente; lo usa también `ear`
  unlock(): void;                             // idempotente; en el primer gesto
  preview(midi: Midi, timbre: Timbre): void;  // 0,45 s
  play(opts: PlayOptions): PlaybackHandle;
  stopAll(): void;
  readonly isPlaying: boolean;
  subscribe(fn: (playing: boolean) => void): () => void;
}

export interface PlayOptions {
  notes: readonly Note[];
  fromIndex: number;          // ≥ 0
  tempo: number;              // 30..240
  timbre: Timbre;
  onPosition?(index: number): void;   // por defecto escribe en usePlaybackPositionStore
  onEnd?(): void;
}

export interface PlaybackHandle {
  stop(): void;
  readonly startedAt: number;         // segundos del AudioContext
}
```

---

## 4. Contexto de audio compartido (`context.ts`)

```
getContext():
    si no existe:
        ctx = new (AudioContext || webkitAudioContext)({ latencyHint: 'interactive' })
        comp = DynamicsCompressor: threshold −14 dB, ratio 4 (resto por defecto)
        master = Gain 0.55
        master → comp → destination
    si ctx.state !== 'running': ctx.resume() (sin esperar; errores ignorados)
    return ctx

document 'visibilitychange': si visible y ctx existe y no está 'running' → resume()
```

- **Uno solo** para toda la app (partitura + De oído): los navegadores limitan el número de contextos y en iOS
  cada uno debe desbloquearse.
- `ear` conecta su reproducción a `ctx.destination` con su propia ganancia (no pasa por el compresor), como legacy.
- El contexto **no se cierra** nunca durante la sesión.

---

## 5. Desbloqueo en iOS y modo silencio (`ios-unlock.ts`)

### 5.1 Problema

- Safari no permite sonar hasta un gesto del usuario.
- Con el interruptor de silencio activado, Web Audio no suena en iPhone… salvo que haya un elemento `<audio>`
  reproduciéndose (que usa la categoría de sesión "playback").

### 5.2 Algoritmo (portado de legacy)

```
unlock():
    try: navigator.audioSession.type = 'playback'        # Safari 17+ (API nueva); ignorar errores
    c = getContext()
    si ya desbloqueado: return
    desbloqueado = true
    try: reproducir un AudioBuffer de 1 muestra a 22 050 Hz
    try:
        el = <audio x-webkit-airplay="deny" preload="auto" loop>
        el.src = silentWav()          # 800 muestras de 8 bits a 8 kHz, todas en 128 (silencio)
        el.play().catch(noop)
```

### 5.3 Dónde se llama

- `AppShell` registra en **captura** `pointerup`, `touchend`, `click`, `keydown` → `unlock()` (pasivos).
- `enter()` de las superficies de entrada y `startPlay()` lo vuelven a llamar (idempotente).

### 5.4 `silent-wav.ts`

Cabecera RIFF/WAVE PCM: 1 canal, 8 000 Hz, 8 bits, `data` de 800 bytes con valor 128. Se codifica a base64 una vez
(memoizado).

### 5.5 CSP

`media-src 'self' blob:` en `vercel.json` debe incluir `data:` para el WAV silencioso → **cambiar a
`media-src 'self' blob: data:`** (registrado para actualizar technical-decisions 13.5).

---

## 6. Cadena de salida

```
voz (osciladores / buffer) → filtros → envolvente (Gain) → out (Gain por nota) → master (0.55) → compresor → destino
```

- Cada nota crea su propio `out` para poder liberar todo al detener.
- El compresor evita saturación cuando se solapan notas largas (piano con decaimiento largo).

---

## 7. Timbres

El timbre lo define `instrument.timbre` (spec notation-core 3.1):

| Timbre | Instrumentos |
|---|---|
| piano | Piano |
| guitar | Guitarra, Ukulele |
| bass | Bajo eléctrico |
| bow | Violín, Viola, Violonchelo, Contrabajo |
| flute | Flauta, Flauta dulce soprano |
| reed | Oboe, Clarinete, Saxofón alto, Saxofón tenor |
| brass | Trompeta, Corno, Trombón, Tuba |
| voice | Voz |

Frecuencia: `f = 440 · 2^((midi − 69) / 12)`.

### 7.1 Cuerda pulsada: guitarra y bajo (`synth-plucked.ts`)

**Karplus-Strong** precalculado a un `AudioBuffer` (legacy `ksBuffer`):

| Parámetro | guitar | bass |
|---|---|---|
| sustain (s) | 2.2 | 3.0 |
| brillo (filtro de la excitación) | 0.6 | 0.35 |
| paso bajo | 5 000 Hz | 1 800 Hz |
| ganancia | 0.9 | 1.1 |

```
ksBuffer(midi, sustain, brillo):
    sr = ctx.sampleRate ; f = frecuencia
    len = floor(sr · min(sustain + 0.2, 4))
    N = max(2, round(sr / f))                        # longitud de la línea de retardo
    anillo = ruido blanco filtrado: prev += brillo·(r − prev)
    decay = 0.001^(1 / (f · sustain))                # −60 dB en `sustain` segundos
    para i en 0..len−1:
        a = anillo[idx]; b = anillo[(idx+1) mod N]
        salida[i] = a
        anillo[idx] = (a + b)/2 · decay ; idx = (idx+1) mod N
    normalizar a pico 0.8
```

Envolvente: ganancia constante hasta `t0 + dur`, luego rampa exponencial a 0.0005 en `t0 + dur + 0.25`;
`src.stop(relEnd + 0.05)`.

**Caché (cambio respecto a legacy):** clave `midi:sustain:brillo`, **LRU de 128 entradas** (legacy no tenía límite;
un bajo a 3 s y 48 kHz ocupa ~600 KB por nota). Memoria máxima aproximada: 128 × 600 KB ≈ 75 MB en el peor caso;
típico < 10 MB porque una melodía usa pocas alturas.

### 7.2 Piano (`synth-piano.ts`)

Síntesis aditiva con 6 parciales e inarmonicidad (legacy):

| Parámetro | Valor |
|---|---|
| Amplitudes de los parciales | 1, 0.42, 0.26, 0.14, 0.09, 0.05 |
| Inarmonicidad B | 0.0003 → `f_n = f · n · √(1 + B·n²)` |
| Parciales omitidos | `f_n > 12 000 Hz` |
| Desafinación leve | +3 / −2 cents alternados (coro) |
| Decaimiento base | `T1 = clamp(3.2 · √(261.6 / f), 0.8, 6)` s (graves duran más) |
| Decaimiento por parcial | `T1 / (1 + 0.7·k)` (los agudos se apagan antes) |
| Ataque | 4 ms exponencial desde 0.0001 hasta `amp · 0.32` |
| Caída | exponencial hasta `máx(0.0002, a · 0.001)` en `T` |
| Liberación | al terminar `dur`: `cancelScheduledValues` + `setTargetAtTime(0.0001, t0+dur, 0.08)` |
| Fin del oscilador | `t0 + min(dur, T1) + 0.6` |
| Martillo | ruido de 30 ms con caída cúbica → paso banda en `min(6000, 6f)`, Q 1.2, ganancia 0.08 |

### 7.3 Timbres sostenidos (`synth-sustained.ts` + `presets.ts`)

Dos osciladores → paso bajo → envolvente, con vibrato opcional y ruido de aliento (legacy):

| Preset | Ondas | Desafinación (cents) | Paso bajo (Hz) | Q | Ataque (s) | Pico | Vibrato (Hz) | Retardo vibrato (s) | Profundidad | Extra |
|---|---|---|---|---|---|---|---|---|---|---|
| bow | sierra, sierra | ±7 | 1300 + 1,2·f | 1 | 0.08 | 0.38 | 5.5 | 0.25 | 0.4 % | — |
| flute | seno, triángulo | 0 | 5000 | 0.7 | 0.06 | 0.55 | 5 | 0.3 | 0.3 % | aliento 0.025 |
| reed | cuadrada, sierra | ±4 | 900 + 1,6·f | 2 | 0.04 | 0.30 | 5 | 0.35 | 0.2 % | — |
| brass | sierra, sierra | ±3 | 700 + 2·f | 1.5 | 0.05 | 0.34 | — | — | — | barrido del filtro de 40 % a 100 % en 80 ms |
| voice | sierra, triángulo | ±5 | 1100 | 3 | 0.07 | 0.42 | 5.3 | 0.2 | 0.6 % | — |

- Mezcla: oscilador 1 a 0.7, oscilador 2 a 0.5.
- Paso bajo limitado a 9 000 Hz.
- Vibrato: LFO senoidal → `frequency` de ambos osciladores, profundidad `f · depth`, entra con rampa lineal desde 0
  en `t0` hasta el valor en `t0 + retardo + 0.2`.
- Aliento (flute): ruido en bucle → paso banda en `2f`, Q 2 → ganancia 0.025 → envolvente.
- Envolvente: 0.0001 → pico (exponencial, ataque) → 85 % del pico mantenido hasta
  `hold = máx(t0 + ataque + 0.01, t0 + dur − 0.03)` → caída exponencial a 0.0003 en `hold + 0.18`.
- Fin de osciladores: `hold + 0.25`.

### 7.4 Timbre por defecto

Timbre desconocido (no debería ocurrir: el tipo `Timbre` es una unión cerrada) → preset `{triángulo, seno,
paso bajo 3000, ataque 0.02, pico 0.5, sin vibrato}` (legacy).

### 7.5 Calidad percibida

Objetivo: reconocible por familia (guitarra ≠ flauta ≠ trompeta), no realismo. Cambios de sonido se revisan en
navegador real con audífonos y con el altavoz del teléfono.

---

## 8. Vista previa de una nota

```
preview(midi, timbre):
    unlock()
    tone(midi, ctx.currentTime + 0.01, 0.45, timbre)
```

| Uso | Desde |
|---|---|
| Tocar tecla del piano, posición del diapasón, botón Do-Re-Mi, tecla del teclado de computadora | `editor` (`useNoteInput.enter`) |
| Seleccionar una nota con tono en la partitura | `score-view` (tras `select`) |
| 8↑ / 8↓ | `editor` |

- Las vistas previas **no** detienen otras vistas previas (se pueden solapar al tocar rápido).
- Sí suenan aunque haya una reproducción en curso, pero la acción de editar la detiene antes (acciones [S] del
  editor).

---

## 9. Reproducción de la partitura

### 9.1 Reglas (legacy)

| Regla | Valor |
|---|---|
| Inicio | Nota seleccionada si hay; si no, la primera |
| Retardo inicial | 0.15 s desde `currentTime` (margen para programar) |
| Segundos por semicorchea | `spu = 60 / tempo / 4` |
| Duración sonora | `d · spu · 0.92` (pequeña separación entre notas repetidas) |
| Silencios | Avanzan el tiempo sin sonido |
| Notas fuera del rango del instrumento | Suenan igual (el aviso es visual) |
| Altura | **Sonido real** (`p`), independiente de la vista |
| Fin | Cuando `ahora > total + 0.2` → detener |

### 9.2 Botón ▶

- ▶ → `play`; durante la reproducción el icono es ■ ("Detener").
- Espacio en el teclado de computadora hace lo mismo (spec editor 8.4).
- Deshabilitado si no hay notas.

---

## 10. Programador con anticipación (`scheduler.ts`)

### 10.1 Problema de legacy

Legacy programaba **todas** las notas al pulsar ▶. Con el piano (7 nodos por nota: 6 osciladores + martillo) y 3 000
notas son ~21 000 nodos creados de golpe: pausa perceptible y mucha memoria en móviles.

### 10.2 Algoritmo ("A tale of two clocks")

```
play(opts):
    stopAll()
    eventos = [{i, s, e}] precalculados en tiempo relativo (solo aritmética, sin nodos)
    startAt = ctx.currentTime + 0.15
    siguiente = índice del primer evento
    timer = setInterval(programar, 25 ms)
    programar() inmediatamente
    raf = requestAnimationFrame(posición)

programar():
    horizonte = ctx.currentTime + 0.2 (s)
    mientras siguiente < eventos.length y startAt + eventos[siguiente].s < horizonte:
        ev = eventos[siguiente]
        si nota con tono: tone(p, startAt + ev.s, (ev.e − ev.s)·0.92, timbre)
        siguiente++
    si siguiente == eventos.length: clearInterval(timer)
```

- Ventana de 200 ms con revisión cada 25 ms: robusto ante pestañas que se ralentizan (si `setInterval` se retrasa,
  la ventana cubre el hueco).
- Si la pestaña pasa a segundo plano, los navegadores frenan `setInterval` a ~1 s → la reproducción puede cortarse;
  se detiene la reproducción al ocultarse la pestaña (`visibilitychange: hidden`) para evitar sonidos a destiempo
  (Q2).

### 10.3 Exactitud

El tiempo lo marca `AudioContext.currentTime` (reloj de audio), no `setInterval`: las notas suenan exactas aunque el
temporizador tenga jitter.

---

## 11. Posición y resaltado

```
posición() (cada frame):
    ahora = ctx.currentTime − startAt
    si ahora > total + 0.2: stop(); return
    i = evento que contiene `ahora` (búsqueda binaria sobre s; −1 si antes del inicio)
    si i != último: onPosition(i) ; último = i
    raf = requestAnimationFrame(posición)
```

- Por defecto `onPosition` escribe en `usePlaybackPositionStore` (un número), que lee `score-view` para mover la
  clase `.play` sin volver a dibujar (spec notation-core 13).
- En un silencio el índice es el del silencio (se resalta el silencio, como legacy).
- Búsqueda binaria en lugar del `find` lineal de legacy (O(log n) por frame).
- Opcional (Q3): desplazar la vista para mantener visible la nota que suena.

---

## 12. Detener y limpiar (`voices.ts`)

```
registro: Set de nodos fuente (osciladores, buffers) con su tiempo de fin

stopAll():
    cancelar raf y timer del programador
    onPosition(−1)
    para cada nodo vivo: try node.stop() catch
    vaciar registro ; playing = false ; notificar suscriptores

al terminar naturalmente un nodo (onended): quitarlo del registro
```

- Legacy mantenía un arreglo `live` que solo se recortaba al superar 400 entradas; ahora cada nodo se quita al
  terminar (`onended`), sin crecimiento.
- `stopAll` también se llama en `pagehide`.

---

## 13. Interacción con otros módulos

| Módulo | Uso |
|---|---|
| editor | `preview`, `stopAll` en acciones [S], `play` desde el botón y el espacio |
| score-view | `preview` al seleccionar; lee `usePlaybackPositionStore` |
| ear | `getContext()` para su reproducción y WSOLA; `stopAll()` antes de reproducir el audio; escribe en `usePlaybackPositionStore` para F16 |
| AppShell | Registra `unlock` en captura |

Reproducir la partitura detiene el audio de De oído (`ear` se suscribe a `playbackEngine.subscribe`) y viceversa.

---

## 14. Máquina de estados

```
                 play()
  ┌──────┐ ─────────────────► ┌───────────┐
  │ Idle │                    │  Playing  │──── programar (25 ms) / posición (rAF)
  └──────┘ ◄───────────────── └───────────┘
            stop() · fin · editar · cambiar instrumento/tempo/vista? · ocultar pestaña · reproducir audio de De oído
```

| Evento | Idle | Playing |
|---|---|---|
| ▶ / espacio | → Playing (desde selección o 0) | → Idle |
| Editar (acción [S]) | — | → Idle |
| Cambiar instrumento | — | → Idle (el timbre cambia) |
| Cambiar tempo | — | → Idle |
| Cambiar vista (escrito/real) | — | Sigue (no afecta al sonido) |
| Seleccionar nota | preview | Sigue; la próxima reproducción empieza ahí |
| Fin de la partitura | — | → Idle |
| Pestaña oculta | — | → Idle |
| Reproducir audio en De oído | — | → Idle |

---

## 15. Validaciones

| ID | Regla |
|---|---|
| P1 | `fromIndex` se recorta a `[0, notes.length − 1]`; con 0 notas `play` no hace nada |
| P2 | `tempo` se recorta a 30..240 |
| P3 | `midi` fuera de 0..127 → no suena (no lanza) |
| P4 | `dur` ≤ 0 → no suena |
| P5 | `play` siempre llama `stopAll` primero (nunca dos reproducciones a la vez) |

---

## 16. Edge cases

| # | Caso | Esperado |
|---|---|---|
| S1 | Primer toque en iPhone con interruptor de silencio | Suena (unlock + `<audio>` silencioso) |
| S2 | Volver a la pestaña tras bloquear el teléfono | `resume()` en `visibilitychange`; la siguiente nota suena |
| S3 | Auriculares Bluetooth con latencia alta | Suena con retraso (limitación del sistema); el resaltado usa `currentTime` y puede adelantarse a lo que se oye (Q4: `outputLatency`) |
| S4 | Partitura de 3 000 notas | Arranca en < 50 ms; memoria estable |
| S5 | Tempo 240 con semicorcheas | 16 notas/s; sin cortes |
| S6 | Tempo 30 con redondas | Notas de 8 s; el piano decae antes (T1 ≤ 6 s), los sostenidos se mantienen |
| S7 | Nota repetida igual consecutiva | Se oyen separadas (factor 0.92) |
| S8 | Reproducir desde la última nota | Suena solo esa |
| S9 | Reproducir solo silencios | No suena nada; termina al final |
| S10 | Tocar 10 teclas muy rápido | 10 vistas previas solapadas, sin saturar (compresor) |
| S11 | Cambiar de instrumento con nodos sonando | Los que suenan terminan su liberación |
| S12 | Pestaña en segundo plano durante la reproducción | Se detiene |
| S13 | `AudioContext` no soportado (navegador muy antiguo) | Sin sonido; aviso único "Tu navegador no puede reproducir sonido." |
| S14 | Bajo en Mi1 (41 Hz) | Karplus-Strong con N ≈ 1 170 muestras; suena |
| S15 | Flauta en Re7 (2 349 Hz) | Paso bajo 5 000 Hz; sin aliasing audible |
| S16 | Guitarra: 100 alturas distintas | Caché LRU con 128 máx.; sin crecimiento |
| S17 | Reproducir mientras suena el audio de De oído | El audio se detiene |
| S18 | Seleccionar otra nota durante la reproducción | Sigue sonando; el inicio de la próxima reproducción cambia |

---

## 17. Errores

| Situación | Manejo |
|---|---|
| `new AudioContext` lanza | Aviso único (S13); `preview`/`play` no hacen nada |
| `resume()` rechaza | Ignorar; se reintenta en el siguiente gesto |
| `el.play()` del WAV silencioso rechaza | Ignorar (no crítico fuera de iOS) |
| Excepción al crear nodos de una nota | Se omite esa nota y se registra en diagnóstico; la reproducción sigue |

No hay mensajes de error en el flujo normal.

---

## 18. Accesibilidad

- Botón ▶/■ con `aria-label` "Reproducir"/"Detener" y `aria-pressed` reflejando el estado.
- El resaltado visual tiene equivalente para lectores de pantalla: al detener se anuncia "Reproducción detenida"
  (región `aria-live` discreta). No se anuncia cada nota (sería ruido).
- `prefers-reduced-motion` no afecta (el resaltado es un cambio de color, no movimiento). Si se implementa el
  desplazamiento automático (Q3), respeta `prefers-reduced-motion` con desplazamiento instantáneo.

---

## 19. Performance

| Métrica | Objetivo |
|---|---|
| Tecla → sonido (vista previa) | ≤ 30 ms (`latencyHint: 'interactive'`, +10 ms de margen) |
| `play` con 3 000 notas hasta el primer sonido | ≤ 200 ms (incluye 150 ms de margen fijo) |
| Nodos vivos simultáneos | ≤ ~200 (ventana de 200 ms) |
| Karplus-Strong de una nota nueva | ≤ 5 ms (bajo a 48 kHz, 3,2 s de buffer) |
| CPU de audio en móvil de referencia durante reproducción de piano a ♩=120 en corcheas | sin glitches |
| Memoria de la caché KS | ≤ 75 MB peor caso, típico < 10 MB |

---

## 20. Testing scenarios

Web Audio no existe en Node: los tests unitarios usan `standardized-audio-context-mock` (MIT) o un mock propio que
registra nodos creados, conexiones y llamadas a `start`/`stop`/rampas. Las pruebas de sonido real son manuales y E2E.

### 20.1 Unit

| ID | Escenario | Esperado |
|---|---|---|
| T-CTX-01 | `getContext` dos veces | Mismo contexto; master 0.55; compresor −14/4 |
| T-CTX-02 | `visibilitychange` visible con contexto suspendido | `resume` llamado |
| T-UNL-01 | `unlock` dos veces | Un solo `<audio>` creado |
| T-UNL-02 | `silentWav` | Cabecera RIFF correcta, 844 bytes antes de base64 |
| T-KS-01 | `ksBuffer` 440 Hz | N = round(sr/440); pico 0.8 |
| T-KS-02 | Decaimiento | Energía en `sustain` s ≈ −60 dB (±6) |
| T-KS-03 | Caché LRU | La entrada 129 expulsa la menos usada |
| T-PNO-01 | Do4 | 6 osciladores con frecuencias `f·n·√(1+B n²)`; T1 = 3.2 |
| T-PNO-02 | Do8 | Parciales > 12 kHz omitidos |
| T-PNO-03 | La0 | T1 = 6 (límite) |
| T-SUS-01 | Cada preset | Tipos de onda, filtro, ataque, pico según tabla 7.3 |
| T-SUS-02 | flute | Nodo de ruido de aliento presente |
| T-SUS-03 | brass | Barrido de frecuencia del filtro programado |
| T-SUS-04 | Nota corta (dur < ataque) | `hold = t0 + ataque + 0.01` |
| T-SCH-01 | 3 000 notas | Al iniciar solo se programan las de los primeros 200 ms |
| T-SCH-02 | Avance simulado del reloj | Cada nota se programa una vez, en orden, con `t0` exacto |
| T-SCH-03 | `fromIndex` = 5 | Empieza en la nota 5 |
| T-SCH-04 | Silencios | Avanzan tiempo sin crear nodos |
| T-SCH-05 | Duración sonora | `d · spu · 0.92` |
| T-POS-01 | Búsqueda binaria de posición | Índice correcto en límites de eventos |
| T-POS-02 | Fin | `onEnd` y `onPosition(−1)` |
| T-STP-01 | `stopAll` | Todos los nodos reciben `stop`; registro vacío |
| T-STP-02 | `onended` | Nodo eliminado del registro |
| T-VAL-01 | P1-P5 | Según tabla 15 |

### 20.2 Hook y store

| ID | Escenario |
|---|---|
| T-HK-01 | `usePlayback().playing` refleja `subscribe` |
| T-HK-02 | `usePlaybackPositionStore` actualiza solo al cambiar el índice |

### 20.3 E2E

| ID | Flujo | Navegadores |
|---|---|---|
| E2E-PB-01 | Reproducir Himno: la clase `.play` recorre las notas en orden y termina | Chromium |
| E2E-PB-02 | Seleccionar la nota 10 y reproducir: empieza en la 10 | Chromium |
| E2E-PB-03 | Editar durante la reproducción: se detiene | Chromium |
| E2E-PB-04 | Cambiar a pestaña oculta (emulado): se detiene | Chromium |
| E2E-PB-05 | 3 000 notas: primer resaltado en < 300 ms | Chromium |

### 20.4 Verificación manual (cada semana del plan)

- iPhone con interruptor de silencio: tocar tecla y reproducir → suena.
- Android: latencia al tocar teclas rápido.
- Escuchar los 8 timbres con audífonos y altavoz: reconocibles y sin clics al empezar/terminar.

---

## 21. Quality Gates

| Métrica | Umbral |
|---|---|
| Cobertura `engine/*` | ≥ 85 % (con mock de Web Audio) |
| Cobertura hook/store | ≥ 90 % |
| Complejidad por función | ≤ 8 |
| Tamaño del módulo (gzip) | ≤ 15 KB |
| Sin imports de React en `engine/` | dependency-cruiser |
| Verificación manual en iPhone | Registrada en `docs/development/current/` cada semana |

---

## 22. Trazabilidad

| Historia | Criterio | Sección | Tests |
|---|---|---|---|
| US-P01 | Reproducir y ver qué nota suena | 9, 11 | T-SCH-*, T-POS-*, E2E-PB-01 |
| US-P01 | Empieza desde la selección | 9.1 | T-SCH-03, E2E-PB-02 |
| US-P01 | Timbre de la familia | 7 | T-KS-*, T-PNO-*, T-SUS-*, 20.4 |
| US-P02 | Suena con el iPhone en silencio | 5 | T-UNL-*, 20.4 |
| US-P03 | Tempo 30-240 | 9.1, 15 | T-VAL-01 |
| US-W01 | Sonido ≤ 30 ms al tocar | 8, 19 | medición manual + E2E |
| F16 | Posición compartida con De oído | 11, 13 | T-HK-02 |

---

## 23. Diferencias intencionales con legacy

| # | Legacy | Nuevo | Motivo |
|---|---|---|---|
| D1 | Programa todas las notas al iniciar | Lookahead de 200 ms | Memoria y arranque con partituras largas |
| D2 | Caché Karplus-Strong sin límite | LRU 128 | Memoria |
| D3 | Arreglo `live` recortado a 400 | Registro con `onended` | Sin crecimiento |
| D4 | `find` lineal por frame | Búsqueda binaria | Performance |
| D5 | Sigue sonando en segundo plano a destiempo | Se detiene al ocultar la pestaña | Coherencia |
| D6 | `media-src` sin `data:` (no había CSP) | CSP con `data:` para el WAV silencioso | Seguridad + iOS |
| D7 | Sin anuncio accesible | "Reproducción detenida" | Accesibilidad |

---

## 24. Preguntas abiertas

| ID | Pregunta | Propuesta por defecto |
|---|---|---|
| Q1 | ¿Samples reales de piano/guitarra? | Post-MVP (peso y licencias) |
| Q2 | ¿Seguir reproduciendo en segundo plano? | No: se detiene |
| Q3 | ¿Desplazar la vista para seguir la nota que suena? | Should post-MVP |
| Q4 | ¿Compensar `outputLatency` en el resaltado (Bluetooth)? | Medir en semana 2; aplicar si > 100 ms |
| Q5 | ¿Metrónomo y cuenta de entrada? | Post-MVP |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Spec Writer

## Navegación de reproducción por compás — 2026-10-25

ScoreNavigator reutiliza `playbackEngine.play` con la partitura y sus índices originales. Un inicio dentro de un evento ligado o silencio produce una copia de la lista y acorta únicamente ese evento en la copia; `fromIndex` apunta al índice original, por lo que el resaltado no se desplaza. «Desde la selección» reproduce el evento completo, mientras «Desde el inicio» usa índice 0. Navegar detiene la reproducción; el modelo y las exportaciones permanecen intactos.

## 24. Revisión de timbres (2026-10-25)

Por solicitud del usuario, los presets sostenidos dejan de limitarse a parejas de ondas básicas. Cuerdas frotadas, lengüetas, metal y voz usan tablas armónicas propias normalizadas y con eliminación de aliasing del motor Web Audio; flauta conserva una base suave senoidal/triangular. Resonancias peaking modelan color del cuerpo sin copiar grabaciones de terceros. La desafinación se reduce para evitar batidos de efecto acordeón, especialmente en violín.

El vibrato se conecta a detune (cents), permanece exactamente a cero durante el retardo y no aparece en notas más cortas que ese retardo. La envolvente adapta ataque/liberación a la duración para que semicorcheas no se alarguen artificialmente. Todos los osciladores y ruido quedan registrados para detenerse. No se incorporan dependencias, bancos remotos, muestras, IA ni nuevos formatos. Los timbres siguen siendo síntesis por familia, no grabaciones de cada instrumento ni una garantía de realismo acústico. La revisión auditiva en altavoces y audífonos sigue siendo necesaria.

Validación: espectro no senoidal de cuerda, armónicos diferenciados por familia, ausencia de vibrato temprano/corto, afinación sin glissando y tiempos de ataque/liberación/stop para notas muy cortas. Conservar pruebas del programador, privacidad y cancelación. La tabla legacy de 7.3 describe el origen, no los nuevos perfiles.

## 25. Muestras de instrumentos (solicitud posterior)

Se incorpora FluidR3_GM (CC BY3.0) en archivos MP3 por nota del repositorio mantenido por paulrosen para abcjs. Fuente: https://paulrosen.github.io/midi-js-soundfonts/. Carga al reproducir o previsualizar, usando el instrumento concreto, caché de memoria32MB y notas raíz por octava con ajuste de playbackRate. Se conserva síntesis como respaldo indicado si falla red/decodificación. No se envían partituras ni audio; la primera carga necesita conexión. Detener/cambiar partitura invalida arranques tardíos. Un indicador distingue carga, muestras y respaldo. Créditos y fuente en Ayuda.
