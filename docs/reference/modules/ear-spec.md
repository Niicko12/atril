---
name: atril-ear-spec
status: in-progress
created: 2026-10-18T12:45:27Z
updated: 2026-10-18T12:51:10Z
---

# Spec: Módulo `ear` ("De oído")

**Estado:** 🟡 Lista para revisión
**Features:** F07 (De oído: voz sola, melodía en mezcla, partes con Basic Pitch), F08 (reproductor: onda, A-B,
velocidad sin cambio de tono), F16 (la partitura sigue al audio, aprobado 2026-10-18), F14 (guardar audio, *Could*)
**Historias:** US-E01 … US-E09
**Deuda que corrige:** 4 (hueco MIDI 53-54), 5 (YIN en hilo principal), 6 (textos vs límites reales)
**Referencia de comportamiento:** `legacy/index.html` líneas 1522-1950
**Ubicación:** `src/core/analysis` (puro), `src/workers`, `src/modules/ear`

---

## Índice

1. Alcance
2. Code Structure
3. Flujo general
4. Cargar el audio
5. Onda y transporte
6. Bucle A-B
7. Velocidad sin cambio de tono (WSOLA)
8. Modo "solo": YIN
9. Segmentación en notas
10. Modo "mezcla": melodía principal
11. Modo "partes": Basic Pitch
12. Separación melodía / bajo (skyline)
13. Acordes
14. Tempo
15. Tonalidad
16. Cuantización
17. De resultado a partitura
18. Reajustar ritmo al tempo
19. La partitura sigue al audio (F16)
20. Workers: protocolo, cancelación, errores
21. Guardar el audio (F14)
22. Textos y límites
23. Máquina de estados
24. Edge cases
25. Errores
26. Accesibilidad
27. Performance
28. Testing scenarios
29. Quality Gates
30. Trazabilidad
31. Diferencias intencionales con legacy
32. Preguntas abiertas

---

## 1. Alcance

| Hace | No hace |
|---|---|
| Decodificar un audio o video local a mono | Grabar con micrófono (post-MVP) |
| Dibujar la onda, reproducir, saltar, A-B, velocidad | Cambiar el tono del audio (post-MVP) |
| Detectar notas de una voz sola (YIN) | Separar pistas con calidad de estudio |
| Encontrar la melodía principal de una mezcla | Subir el audio a un servidor (nunca: no hay servidor) |
| Transcribir polifonía con Basic Pitch y separar melodía/bajo/acordes | Usar IA externa (R1) |
| Estimar tempo y tonalidad, cuantizar, entregar al editor | Editar notas (lo hace `editor`) |
| Resaltar en la partitura la nota que suena en el audio (F16) | |

**Garantía de privacidad (US-E07):** ningún byte del audio sale del dispositivo (no hay servidor; F14 guarda local).

---

## 2. Code Structure

```
src/core/analysis/
├── downmix.ts          (≤ 60)    # mezcla a mono, diezmado por promedio
├── yin.ts              (≤ 150)   # f0 por trama (diferencia vía autocorrelación FFT)
├── fft.ts              (≤ 80)    # FFT radix-2 in-place (portada de legacy)
├── melody-mix.ts       (≤ 200)   # saliencia armónica + Viterbi + voicing (dividida en etapas, 9.2 de arquitectura)
├── segment.ts          (≤ 100)   # segmentNotes
├── skyline.ts          (≤ 80)
├── split-parts.ts      (≤ 80)    # melodía/bajo sin hueco (deuda 4)
├── chords.ts           (≤ 150)   # chordsFor, attachChords
├── tempo.ts            (≤ 80)    # guessTempo
├── key.ts              (≤ 80)    # guessKey (Krumhansl-Schmuckler)
├── quantize.ts         (≤ 100)   # quantize + timeline (F16)
├── wsola.ts            (≤ 80)
├── limits.ts           (≤ 40)    # EAR_LIMITS (deuda 6)
└── index.ts

src/workers/
├── pitch.worker.ts         (≤ 100)   # solo + mezcla
├── basic-pitch.worker.ts   (≤ 150)   # TF.js + modelo + post-proceso de Basic Pitch
├── stretch.worker.ts       (≤ 60)    # WSOLA
└── protocol.ts             (≤ 80)

src/vendor/basic-pitch/      # código de Basic Pitch (Apache-2.0) si no se usa el paquete npm; fuera de lint
└── NOTICE

src/modules/ear/
├── components/
│   ├── ear-panel.tsx         (≤ 180)  # contenedor, consejos, selector de modo, botón principal
│   ├── waveform.tsx          (≤ 150)  # canvas + gestos
│   ├── audio-transport.tsx   (≤ 120)  # play, −3 s, velocidad, Desde aquí, Hasta aquí, Quitar, tiempo
│   ├── parts-list.tsx        (≤ 100)  # partes encontradas + acordes
│   └── ear-progress.tsx      (≤ 60)   # progreso + Cancelar
├── hooks/
│   ├── use-audio-file.ts     (≤ 80)   # decodificar
│   ├── use-audio-player.ts   (≤ 100)  # reproducción, A-B, velocidad
│   ├── use-ear-analysis.ts   (≤ 100)  # análisis con estado discriminado
│   └── use-follow-audio.ts   (≤ 60)   # F16
├── services/
│   ├── ear.service.ts        (≤ 200)  # clientes de Worker, orquestación, resultado → partitura
│   ├── resample.ts           (≤ 40)   # OfflineAudioContext a 22 050 Hz
│   └── peaks.ts              (≤ 50)
├── reducer.ts                (≤ 120)  # estado del panel (useReducer)
├── strings.ts · types.ts · index.ts
```

El módulo se carga con `React.lazy` al pulsar "De oído" (11.6 de arquitectura).

---

## 3. Flujo general

```
"De oído" ─► EarPanel (lazy) ─► Elegir audio ─► decodeAudioData ─► mono Float32
                                                       │
                     ┌─────────────────────────────────┼─────────────────────────────────┐
                     ▼                                 ▼                                 ▼
              Reproducir/A-B/velocidad          Modo solo/mezcla                    Modo partes
              (stretch.worker si < 100 %)       (pitch.worker)                      (resample → basic-pitch.worker)
                                                       │                                 │
                                                RawNote[] ──► tempo, tonalidad      PolyEvent[] ──► skyline, tempo,
                                                       │      cuantizar                   tonalidad, acordes
                                                       ▼                                 ▼
                                               editor.replaceScore              Lista de partes ─► "Abrir"
                                                                                       ─► cuantizar ─► replaceScore
```

---

## 4. Cargar el audio

### 4.1 Entrada

- `<input type=file accept="audio/*,video/*,.m4a,.mp3,.wav,.aac,.ogg,.caf">` (legacy).
- Tamaño máximo: **50 MB** (archivo local; no se sube). Más grande → "El audio es demasiado grande (máximo 50 MB).
  Recórtalo e inténtalo de nuevo."

### 4.2 Decodificación (hilo principal; `decodeAudioData` no existe en Workers)

```
earStop(); playback.unlock(); mensaje "Abriendo audio…"
ab = await file.arrayBuffer()
buf = await ctx.decodeAudioData(ab)      # con soporte de la firma de callbacks (Safari antiguo)
si buf.duration > 900 s → error "El audio dura más de 15 minutos. Recórtalo e inténtalo de nuevo."
mono = promedio de canales (Float32Array de buf.length)
liberar referencias a canales (no se conserva el AudioBuffer estéreo salvo para reproducir a velocidad normal)
estado: nombre (sin extensión), duración, mono, sampleRate
```

- Para reproducir a velocidad normal se usa el `AudioBuffer` original (calidad estéreo).
- El mono se usa para la onda, WSOLA y el análisis.

Formatos: los que decodifique el navegador. iPhone: notas de voz `.m4a` ✅, `.caf` ✅; Android: `.m4a`, `.ogg`,
`.opus` ✅; video `.mp4`/`.mov` ✅ (pista de audio).

### 4.3 Error de decodificación

"No se pudo leer ese audio. Prueba con MP3, M4A (notas de voz) o WAV."

---

## 5. Onda y transporte

### 5.1 Onda (`waveform.tsx` + `peaks.ts`)

- `<canvas>` de ancho 100 % y 76 px de alto, `touch-action: none`.
- Picos: para cada píxel x, máximo absoluto de las muestras de su tramo (muestreo cada 8) normalizado al máximo
  global. Se recalculan solo si cambia el ancho (legacy).
- Dibujo: región A-B en `--accent-soft`; barras en `--muted` con alto mínimo 0,5 px; cursor de posición de 2 px en
  `--accent`. Respeta `devicePixelRatio`.

### 5.2 Gestos

| Gesto | Acción |
|---|---|
| Toque (desplazamiento ≤ 6 px) | Mover posición a ese punto |
| Arrastre > 6 px | Seleccionar región A-B (mín. 0,3 s); posición = A |
| Durante reproducción | Cualquier cambio reinicia la reproducción desde la nueva posición |

`setPointerCapture` para seguir el arrastre fuera del canvas.

### 5.3 Transporte (`audio-transport.tsx`)

| Control | Acción |
|---|---|
| ▶ / ❚❚ | Reproducir / pausar |
| −3 s | Retroceder 3 s (mín. 0) |
| Velocidad | Normal, 90 %, 80 %, 70 %, 60 %, 50 % (mitad) |
| Desde aquí | A = posición; B = B existente si es > posición + 0,3 s, si no posición + 4 s |
| Hasta aquí | B = posición; A = A existente si es < posición − 0,3 s, si no posición − 4 s; posición = A |
| Quitar repetición | Borra A-B (visible solo si hay A-B) |
| Etiqueta de bucle | "Repite 0:12–0:16" |
| Tiempo | "0:12 / 3:45" (cifras tabulares) |

### 5.4 Reproducción

```
earPlay():
    unlock(); playback.stopAll(); detener reproducción anterior
    R = región()                         # {a, b, loop} — A-B si B − A > 0,2 s; si no, todo el audio
    from = pos; si from < R.a o from ≥ R.b − 0,05 → from = R.a
    si velocidad == 1:
        src.buffer = AudioBuffer original; si R.loop: loop en [R.a, R.b]
        offset = from
    si no:
        segmento = R.loop ? [R.a, R.b] : [from, min(R.b, from + 90 s)]
        buffer estirado = caché(segmento, velocidad) o stretch.worker (7)
        si R.loop: loop en todo el buffer estirado
        offset = (from − segmento.inicio) / velocidad
    src → ganancia propia (no pasa por el compresor de la partitura) → destino
    animación: pos = p0 + (ahora − t0)·velocidad (con vuelta al inicio del bucle); redibujar onda y tiempo
```

- Un solo `AudioContext` compartido con `playback` (11.7 de arquitectura).
- Reproducir la partitura detiene el audio y viceversa.

---

## 6. Bucle A-B

| Regla | Valor |
|---|---|
| Duración mínima | 0,3 s (si es menor, B = A + 0,3) |
| Límites | 0 ≤ A < B ≤ duración |
| Cambiar A-B | Invalida la caché de audio lento |
| Región para análisis | El análisis usa la región A-B si existe; si no, el audio completo (con los límites de 22) |

---

## 7. Velocidad sin cambio de tono (WSOLA)

### 7.1 Algoritmo (portado de legacy, en `stretch.worker`)

```
N = sr > 60 000 ? 4096 : 2048        # ventana
Hs = N/2                              # salto de síntesis
tol = Hs/2                            # tolerancia de búsqueda
Ha = Hs · velocidad                   # salto de análisis
ventana Hann
tramas = floor((len − N − 2·tol) / Ha)
para k en 0..tramas−1:
    ideal = round(k·Ha) + tol
    si k > 0: buscar en [ideal − tol, ideal + tol] (paso 4) el desplazamiento con mayor correlación
              (muestreada cada 8) con la continuación natural de la trama anterior (prev + Hs)
    solapar-sumar x[best .. best+N]·ventana en y[k·Hs]
```

### 7.2 Uso

- Se calcula para el segmento de 5.4 (máx. 90 s sin bucle).
- Caché por `(inicio, fin, velocidad)`; una sola entrada (legacy).
- Mensaje durante el cálculo: "Preparando audio lento…" (en Worker ya no congela la pantalla).

---

## 8. Modo "solo": YIN

Para una voz o un instrumento solo, una nota a la vez.

### 8.1 Parámetros (legacy)

| Parámetro | Valor |
|---|---|
| Diezmado | factor `f = max(1, round(sr / 11 025))`, promedio de `f` muestras |
| Ventana W | 46 ms |
| Salto | 20 ms |
| Rango de f0 | 65 Hz – 1 100 Hz (`tMin = s/1100`, `tMax = s/65`) |
| Umbral YIN | 0,15 (primer mínimo bajo el umbral, luego descenso hasta el mínimo local) |
| Interpolación | Parabólica sobre `d[best−1..best+1]` |
| Puerta de energía | RMS de la trama > 8 % del RMS máximo |

### 8.2 Optimización (deuda 5)

Legacy calcula la función de diferencia con doble bucle (O(W·tMax) por trama ≈ 86 000 operaciones). Se reemplaza
por la identidad:

```
d(τ) = Σ (x_j − x_{j+τ})² = E(0..W) + E(τ..τ+W) − 2·r(τ)
r(τ) = autocorrelación vía FFT de tamaño ≥ 2·(W + tMax)
E con suma acumulada de cuadrados
```

Luego la diferencia normalizada acumulada (CMND) igual que legacy: `d'(τ) = d(τ)·τ / Σ_{1..τ} d`.

**Equivalencia:** test dorado con audios sintéticos y de fixtures: las notas resultantes deben coincidir con legacy
en ≥ 98 % (diferencias de redondeo de punto flotante pueden mover algún límite de trama).

### 8.3 De f0 a semitonos

```
mf = 69 + 12·log2(f0 / 440)   (null si no hay f0 o la trama no pasa la puerta)
afinación global: off = mediana de (mf − round(mf)) sobre las tramas con valor
q = round(mf − off)            # compensa grabaciones desafinadas de forma uniforme
```

### 8.4 Salida

`segmentNotes(q, tiempos, salto, MIN = 3)` (9) → `RawNote[]` con tiempos relativos a la región; luego se suma el
inicio de la región.

---

## 9. Segmentación en notas (`segmentNotes`)

```
entrada: q (MIDI o null por trama), tiempos, hopSec, MIN (tramas mínimas por nota)
1. mediana móvil de 5 tramas (±2): null si más de la mitad son null
2. agrupar tramas consecutivas con el mismo valor en segmentos {m, s, e}
3. repetir hasta que no haya cambios (guarda 100 000 iteraciones):
     segmento corto (< MIN tramas):
        si vecino izquierdo y derecho tienen la misma nota → unir los tres
        si no, si hay izquierdo → absorber en el izquierdo
        si no, si hay derecho → absorber en el derecho
4. unir segmentos consecutivos iguales
5. descartar null y notas fuera de 28..100
6. salida {m, t0: tiempos[s], t1: tiempos[e] + hopSec}
```

---

## 10. Modo "mezcla": melodía principal

Canción completa con acompañamiento; busca la línea más saliente (normalmente la voz).

### 10.1 Etapas (división obligatoria por la regla de 40-60 líneas por función)

| Etapa | Función | Detalle (legacy) |
|---|---|---|
| 1 | `downmixTo22k` | Diezmado a ~22 050 Hz por promedio |
| 2 | `buildHarmonicCandidates` | Candidatos MIDI 50–84 (35 alturas); 10 armónicos por candidato con peso 0,8^(h−1); bins ±1,5 % |
| 3 | `salienceFrames` | Ventana Hann N = 2048, salto 11,6 ms; magnitud comprimida `√|X|`; saliencia = Σ peso·máx(bins del armónico) |
| 4 | `viterbiPath` | Penalización por salto: 0 si se mantiene, `1.6 + 0.08·min(12, distancia)` si cambia; puntuación `log(saliencia + 1e-6)` |
| 5 | `voicingMask` | Trama con voz si saliencia > 0,7·mediana de máximos, > 1,35·media de la trama y RMS > 4 % del máximo |
| 6 | `segmentNotes` | `MIN = round(0,11 s / salto)` |
| 7 | `dropOutliers` | Quitar notas < 0,45 s que saltan > 9 semitonos respecto a ambos vecinos (fugas de bajo o acordes) |

Progreso: 0-90 % saliencia, 90-98 % Viterbi, 100 % al terminar.

### 10.2 Limitaciones comunicadas

El resultado es un **borrador**: el mensaje final dice "Es un borrador: compara con el audio y corrige las notas que
no coincidan."

---

## 11. Modo "partes": Basic Pitch

Transcripción polifónica con el modelo Basic Pitch de Spotify (Apache-2.0), ejecutado en el navegador.

### 11.1 Modelo

| Aspecto | Valor |
|---|---|
| Origen | `legacy/bp-model.json` (graph-model, TF.js Converter 3.13, 245 tensores de pesos, ~742 KB binarios) |
| Conversión | `scripts/split-bp-model.mjs` → `public/models/basic-pitch/model.json` + `group1-shard1of1.bin` con hash en el nombre |
| Caché | `Cache-Control: public, max-age=31536000, immutable` |
| Carga | `tf.loadGraphModel(url)` en el Worker; una vez por sesión |
| Licencia | `src/vendor/basic-pitch/NOTICE` + mención en "Acerca de" |

**Semana 1:** evaluar `@spotify/basic-pitch` (npm). Si funciona en Worker con el modelo empaquetado, reemplaza el
código minificado embebido de legacy. Si no, se porta el código de legacy a `src/vendor/basic-pitch/` sin cambios.

### 11.2 Backend de TF.js

```
en el Worker:
    intentar tf.setBackend('webgl')   # requiere OffscreenCanvas con WebGL en Workers
    si falla: tf.setBackend('cpu') y avisar "Tu navegador no permite la aceleración; tardará más."
    await tf.ready()
```

**Riesgo RK3** (arquitectura): si un navegador objetivo (Safari de iPhone) no soporta WebGL en Workers, plan B:
ejecutar Basic Pitch en el hilo principal como legacy, con progreso y botón Cancelar que espera al siguiente bloque.
Decisión en semana 1 tras probar.

### 11.3 Entrada

- Región: A-B o el audio completo, máximo **90 s** (22).
- Remuestreo a 22 050 Hz mono en el hilo principal con `OfflineAudioContext` (no existe en Workers) → se transfiere
  al Worker.

### 11.4 Inferencia y post-proceso (parámetros de legacy)

```
evaluateModel(audio22k, onFrames, onProgress)       # ventanas de 2 s con solapamiento, progreso por ventana
eventos = outputToNotesPoly(frames, onsets,
            onsetThresh = 0.5, frameThresh = 0.3, minNoteLen = 8 tramas)
       → noteFramesToTime
       → {p, s, e, a} + desplazamiento de la región
filtrar: duración ≥ 0,06 s y 28 ≤ p ≤ 96
ordenar por inicio, y a igual inicio de más aguda a más grave
si quedan < 4 eventos → "No encontré notas claras en ese pedazo. Prueba con otro."
```

### 11.5 Resultado (`PartsAnalysis`)

```
{ melodía, bajo } = splitParts(eventos)               # 12
lead = melodía.length ≥ 4 ? melodía : todos los eventos
bpm = guessTempo(lead) ; key = guessKey(todos) ; origin = min(inicio)
acordes = chordsFor(eventos, bpm, origin, bar = 16, key)
partes = [
  { id: 'mel', name: 'Melodía', description: 'voz o instrumento principal', raw: melodía, instrumentId: null },
  { id: 'bass', name: 'Bajo', description: 'la línea más grave', raw: bajo, instrumentId: 'bajo' },
].filter(p => p.raw.length ≥ 3)
```

---

## 12. Separación melodía / bajo (skyline)

### 12.1 `skyline(eventos, alta)` (legacy)

Recorre eventos ordenados por inicio y construye una línea monofónica:

```
para cada n:
    L = último de la salida
    si no hay L o n.s ≥ L.e − 0,04: agregar n
    si no, si n es "mejor" (más aguda si alta, más grave si no):
        si n.s − L.s < 0,06: reemplazar L por n
        si no: cortar L en n.s y agregar n
    si no, si n.e > L.e + 0,25 y n.s > L.s + 0,06: agregar n desde L.e (continúa tras la nota mejor)
descartar notas < 0,06 s
```

### 12.2 `splitParts` (corrige deuda 4)

Legacy: melodía = skyline alta de eventos con p ≥ 55; bajo = skyline baja de eventos con p ≤ 52 → **las notas 53 y
54 (Fa3, Fa♯3) no entraban en ninguna parte**.

Nuevo:

```
melodía = skyline(eventos, alta = true)                         # sobre TODOS
usados = eventos que aportan a la melodía (mismo p y solapamiento ≥ 50 %)
restantes = eventos − usados, con p ≤ 60
bajo = skyline(restantes, alta = false)
si la mediana de alturas del bajo ≥ mediana de la melodía − 5: no ofrecer bajo (no hay línea grave distinta)
```

Test obligatorio: eventos sintéticos con notas 53 y 54 aparecen en alguna parte.

---

## 13. Acordes

### 13.1 `chordsFor(eventos, bpm, origin, bar, key)` (legacy)

```
u = 60 / bpm / 4                        # segundos por semicorchea
ventana = bar/2 = 8 semicorcheas (media redonda en 4/4)
nombres = key < 0 ? bemoles : sostenidos  (Do, Do♯/Re♭, …)
para cada ventana [a, b):
    h[12] = Σ solapamiento·amplitud por clase de altura; bajo = clase con más peso entre notas ≤ 55
    si Σh < 0,05: sin acorde
    para cada raíz r y plantilla (mayor [0,4,7], m [0,3,7], 7 [0,4,7,10], m7 [0,3,7,10], dim [0,3,6]):
        puntuación = Σ h[en plantilla] − 0,6·Σ h[fuera]
                     − 0,1·Σh si es de 4 notas
                     + 0,15·Σh si la raíz es el bajo
    el mejor → nombre de raíz + sufijo
quitar ventanas sin acorde y repeticiones consecutivas
```

### 13.2 `attachChords(notas, acordes)`

Para cada acorde, la nota cuyo inicio está más cerca de `u` (y sin cifrado aún), si la distancia ≤ 4 semicorcheas →
`nota.c = nombre`.

### 13.3 UI

- Casilla "Poner los acordes arriba de la partitura" (marcada por defecto).
- Resumen: "Acordes: Do · Sol · Lam · Fa…" (máximo 12, con "…").

---

## 14. Tempo (`guessTempo`)

```
ioi = diferencias entre inicios consecutivos > 0,08 s
sin ioi → 90
md = mediana(ioi)
bpm = 60 / (md ≥ 0,4 ? md : 2·md)      # suponer que la mediana es negra o corchea
mientras bpm > 150: bpm /= 2 ; mientras bpm < 60: bpm *= 2
refinar: para b en [0,9·bpm, 1,1·bpm] paso 0,25:
    e8 = 60 / b / 2
    puntuación = Σ cos(2π·(inicio − origen) / e8)
    quedarse con la mejor
return round(mejor)
```

El rango 60-150 se comunica en el mensaje: "Si el ritmo quedó raro, cambia el Tempo arriba y pulsa «Reajustar ritmo
al tempo»."

---

## 15. Tonalidad (`guessKey`)

Krumhansl-Schmuckler con perfiles de Krumhansl-Kessler:

```
MAYOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MENOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
h[12] = duración total por clase de altura
para cada tónica t: correlación de Pearson de h con MAYOR y MENOR rotados t
mejor mayor t → tónica t ; mejor menor t → tónica relativa mayor (t + 3) mod 12
return normalizeFifths(tónica · 7)
```

Salida: armadura (no modo). Ejemplo: La menor → 0 (Do mayor/La menor).

---

## 16. Cuantización

### 16.1 `quantize(raw, bpm, origin?)` (legacy + timeline)

```
u = 60 / bpm / 4 ; o = origin ?? raw[0].t0 ; out = [] ; timeline = [] ; prev = 0
para cada r:
    s = round((r.t0 − o)/u) ; e = round((r.t1 − o)/u)
    si s < prev: s = prev ; si e ≤ s: e = s + 1
    gap = s − prev
    si gap > 0:
        si gap ≤ 1 y la última salida es nota: alargarla (evita silencios de semicorchea espurios)
        si no: agregar silencio {null, gap}
    agregar {p: r.m, d: e − s} ; timeline.push({index, t0: r.t0, t1: r.t1})
    prev = e
recortar a 3 000 notas
return { notes, timeline }
```

### 16.2 `timeline`

Nuevo, para F16: por cada nota (no silencio) de la salida, el intervalo de tiempo del audio original del que salió.

---

## 17. De resultado a partitura

### 17.1 Modos solo y mezcla

```
raw = resultado del Worker (+ inicio de región)
si raw.length < 2: error específico del modo (25)
bpm = guessTempo(raw) ; {notes, timeline} = quantize(raw, bpm)
score = {
  title: (nombreAudio || 'Melodía') + ' (de oído)', composer: '', key: guessKey(raw), meter: '4/4', tempo: bpm,
  notes, source: modo == solo ? 'ear_solo' : 'ear_mix', instrumentId: actual, showNames: false, showTab: false,
}
library.prepareReplace() → editor.replaceScore(score)
EarSession = { raw, origin: null, timeline, revisionAtImport: editor.revision }
mensaje: "Listo: N notas a ♩ = B. Escúchala con ▶. [borrador…] Si el ritmo quedó raro, …"
mostrar "Reajustar ritmo al tempo"
```

### 17.2 Modo partes ("Abrir" una parte)

```
notes, timeline = quantize(parte.raw, PARTS.bpm, PARTS.origin)
si "Poner los acordes" marcado: attachChords(notes, PARTS.chords)
instrumento = parte.instrumentId ?? (actual es bajo o contrabajo ? 'piano' : actual)
title = (nombreAudio || 'Canción') + ' – ' + parte.name
source = 'ear_parts'
replaceScore … ; EarSession con origin = PARTS.origin
mensaje: "Abrí la parte de melodía (♩ = B). Es un borrador: escúchala con ▶ y compárala con el audio. Puedes abrir otra parte arriba."
```

Todas las partes de un análisis comparten `origin` → abrir la melodía y luego el bajo da compases alineados.

---

## 18. Reajustar ritmo al tempo (US-E05)

```
si no hay EarSession: botón oculto
el usuario cambia el Tempo en el formulario y pulsa el botón
notes, timeline = quantize(EarSession.raw, score.tempo, EarSession.origin)
si es una parte con acordes y la casilla está marcada:
    attachChords(notes, chordsFor(PARTS.events, score.tempo, PARTS.origin, 16, score.key))
editor.replaceNotesKeepingMeta(notes)        # entra al historial → se puede deshacer
EarSession.timeline = timeline ; revisionAtImport = editor.revision
mensaje "Ritmo reajustado a ♩ = T."
```

`EarSession` se descarta al cargar otra partitura que no venga de este audio o al cerrar el audio.

---

## 19. La partitura sigue al audio (F16, US-E09)

### 19.1 Comportamiento

Mientras se reproduce el **audio original** en el panel, la nota de la partitura que corresponde a ese instante se
resalta con la misma clase `.play` que usa la reproducción de la partitura.

### 19.2 Condiciones

| Condición | Si no se cumple |
|---|---|
| Hay `EarSession` con `timeline` | Sin resaltado |
| `editor.revision === EarSession.revisionAtImport` (la partitura no se editó desde el análisis o el reajuste) | Sin resaltado y una línea discreta: "La partitura cambió; el seguimiento del audio se desactivó." |
| La partitura actual es la que salió de este audio | Sin resaltado |

Motivo de la segunda condición: al insertar o borrar notas, los índices dejan de corresponder con la línea de
tiempo. Recalcular la correspondencia tras ediciones arbitrarias queda fuera del MVP (Q3).

### 19.3 Implementación (`use-follow-audio.ts`)

```
en cada frame de la animación del reproductor (5.4):
    t = posición actual del audio (segundos, ya corregida por velocidad y bucle)
    índice = búsqueda binaria en timeline por t ∈ [t0, t1)  → −1 si cae en un silencio
    si índice cambió: usePlaybackPositionStore.set(índice)    # score-view mueve .play (notation-core 13)
al pausar o detener: set(−1)
```

Costo: O(log n) por frame; sin renders del editor.

---

## 20. Workers: protocolo, cancelación, errores

### 20.1 Protocolo

Definido en technical-decisions 8.7 (`WorkerRequest` / `WorkerResponse`). Detalles:

| Worker | Peticiones | Respuestas |
|---|---|---|
| pitch | `detect` (mode solo/mix, samples, sampleRate) | progress, detect_done, error, cancelled |
| basic-pitch | `parts` (samples22k) | progress (stage loading_model / analyzing), parts_done, error, cancelled |
| stretch | `stretch` (samples, sampleRate, speed) | stretch_done, error |

### 20.2 Transferencia de memoria

- Al pedir un análisis se **copia** la región (`mono.slice(a, b)`) y se transfiere la copia
  (`postMessage(msg, [copia.buffer])`). El `mono` original se conserva para la onda y la reproducción.
- Las respuestas con `Float32Array` (stretch) se transfieren de vuelta.

### 20.3 Progreso

- El Worker envía `progress` como máximo cada 100 ms.
- La UI muestra "Escuchando la melodía… 45 %", "Buscando la voz principal… 45 %", "Preparando la inteligencia
  artificial… (la primera vez tarda unos segundos)" y "Escuchando todos los instrumentos… 45 %" según modo y etapa.

### 20.4 Cancelación (nuevo, US-E06)

```
UI: botón "Cancelar" visible durante el análisis
cancel(id):
    postMessage({type: 'cancel', id})
    el Worker revisa una bandera entre bloques (cada trama de 150 en YIN, cada ventana en Basic Pitch) y responde cancelled
    si no responde en 500 ms → worker.terminate() y recrear al próximo uso
estado vuelve a "Listo" sin mensaje de error
```

### 20.5 Errores

| Código de Worker | Mensaje al usuario |
|---|---|
| model_load_failed | "No se pudo cargar la inteligencia artificial. Revisa tu conexión e inténtalo de nuevo." |
| webgl_unavailable | (no es error: se usa CPU con aviso) |
| out_of_memory | "Ese pedazo es demasiado largo para este teléfono. Selecciona uno más corto." |
| no_notes | Mensaje por modo (25) |
| internal | "No se pudo analizar el audio. Prueba con un pedazo más corto." |

Un error de Worker no deja el botón deshabilitado (siempre `finally`).

---

## 21. Guardar el audio (F14, *Could*)

Solo si el flag `features.audioUpload` está activo:

- Casilla "Guardar el audio en este dispositivo junto a la partitura" desmarcada por defecto.
- El audio **no sale del dispositivo**: se guarda como Blob en el store `audio` de IndexedDB (technical-decisions
  7.3), con `scoreId` de la partitura resultante.
- Límites: 20 MB por archivo, 200 MB en total. Si se supera: "El espacio para audios está lleno. Borra algún audio
  guardado."
- Reabrir la partitura ofrece "Abrir el audio guardado" (Blob → `decodeAudioData`), lo que también reactiva el
  seguimiento F16 si la partitura no cambió.
- El respaldo puede incluir los audios (casilla "Incluir audios", desmarcada por defecto por tamaño).

---

## 22. Textos y límites (deuda 6)

### 22.1 Constantes únicas (`core/analysis/limits.ts`)

```typescript
export const EAR_LIMITS = {
  fileMaxBytes: 50 * 1024 * 1024,
  durationMaxSec: 900,
  soloMaxSec: 300,
  mixMaxSec: 180,
  partsMaxSec: 90,
  stretchSegmentSec: 90,
  loopMinSec: 0.3,
} as const;
```

### 22.2 Textos derivados de las constantes (`strings.ts`)

Los textos se generan con funciones que reciben las constantes, p. ej.
`partsHint(EAR_LIMITS.partsMaxSec)` → "Funciona mejor con pedazos de hasta minuto y medio." Un test compara que
ningún texto contenga una duración literal distinta de las constantes.

| Texto | Contenido |
|---|---|
| Consejo 1 | "**Que se escriba solo:** graba una nota de voz cantando («la la la») o tocando la melodía, una nota a la vez, súbela y pulsa «Escribir la melodía sola»." |
| Consejo 2 | "**Canción completa:** sube el audio (MP3, M4A o un video de tu teléfono) y elige «separar melodía, bajo y acordes». Una inteligencia artificial que funciona en tu teléfono escucha todos los instrumentos y te da la partitura de cada parte. Funciona mejor con pedazos de hasta minuto y medio." |
| Consejo 3 | "**Sacarla de oído:** sube el audio, selecciona un pedazo arrastrando sobre la onda, ponlo más lento y escribe las notas con el teclado de abajo." |
| Privacidad | "Tu audio no sale de tu teléfono." (nuevo) |
| Modos | "Una voz o un instrumento solo" · "Canción completa: separar melodía, bajo y acordes" · "Canción completa: solo la voz (más rápido)" |
| Recorte | "Analicé los primeros {N}; selecciona otro pedazo para seguir." |

---

## 23. Máquina de estados del panel

```
            elegir archivo
 ┌──────┐ ───────────────► ┌──────────────┐  ok   ┌─────────┐
 │ Vacío│                  │ Decodificando│ ────► │  Listo  │◄──────────────────────┐
 └──────┘ ◄─────────────── └──────────────┘       └──┬───┬──┘                       │
           error (mensaje)                           │   │ reproducir / A-B / vel.  │
                                                     │   └──► (Listo, reproduciendo) │
                                       analizar      │                               │
                                                     ▼                               │
                                        ┌────────────────────────┐ cancelar          │
                                        │ Analizando (progreso)  │ ─────────────────►│
                                        └───────┬───────┬────────┘                   │
                                   ok solo/mix  │       │ ok partes                  │
                                                ▼       ▼                            │
                                   ┌───────────────┐ ┌───────────────┐               │
                                   │ Abierta en el │ │ Partes listas │──"Abrir"──┐   │
                                   │ editor        │ └───────────────┘           │   │
                                   └───────┬───────┘                             ▼   │
                                           │ reajustar ritmo           Abierta en el │
                                           └──────────────► (misma)    editor ───────┘
                       error / sin notas ─► Listo con mensaje de error
```

Estado del reducer:

```typescript
type EarState =
  | { kind: 'empty' }
  | { kind: 'decoding'; fileName: string }
  | { kind: 'ready'; audio: DecodedAudio; message?: Message }
  | { kind: 'analyzing'; audio: DecodedAudio; mode: EarMode; progress: number; stage: string }
  | { kind: 'parts'; audio: DecodedAudio; analysis: PartsAnalysis; message?: Message };
// reproducción, posición, A-B y velocidad viven en use-audio-player (ortogonal al análisis)
```

---

## 24. Edge cases

| # | Caso | Esperado |
|---|---|---|
| A1 | Audio de 0,5 s | Análisis devuelve < 2 notas → mensaje de "no encontré notas" |
| A2 | Silencio total | Ídem |
| A3 | Audio estéreo con voz solo en un canal | Mono por promedio; funciona (a mitad de nivel) |
| A4 | Audio de 48 kHz y de 8 kHz (nota de voz de baja calidad) | Diezmado correcto; YIN funciona en 8 kHz (factor 1) |
| A5 | Video .mov de iPhone | Decodifica la pista de audio |
| A6 | Archivo que no es audio | Mensaje de decodificación |
| A7 | 16 min de audio | Rechazado por duración |
| A8 | 6 min en modo solo sin A-B | Analiza 5 min + mensaje de recorte |
| A9 | Modo partes con A-B de 2 min | Analiza 90 s + mensaje |
| A10 | Cantante desafinado uniformemente 30 cents | Compensado por la mediana de desviación |
| A11 | Vibrato amplio | La mediana móvil y MIN lo estabilizan |
| A12 | Notas repetidas iguales sin silencio (staccato muy ligado) | Pueden unirse en una nota larga (limitación conocida; se corrige a mano) |
| A13 | Canción sin bajo distinguible | Solo se ofrece "Melodía" |
| A14 | Eventos con MIDI 53-54 | Aparecen en melodía o bajo (deuda 4) |
| A15 | Tempo real 180 bpm | Se pliega a 90; el usuario puede reajustar |
| A15b | Tempo exacto de 150 bpm (negras de 0,4 s) | El intervalo cae en el límite negra/corchea y da 75 (igual que legacy); se corrige con "Reajustar ritmo" |
| A16 | Abrir melodía y luego bajo del mismo análisis | Compases alineados (mismo origen) |
| A17 | Instrumento actual = bajo y se abre la melodía | Cambia a piano |
| A18 | Cambiar la velocidad durante la reproducción | Reinicia desde la posición actual a la nueva velocidad |
| A19 | Arrastrar A-B mientras suena | Reinicia con el bucle |
| A20 | Cancelar durante la carga del modelo | Worker se termina; la siguiente vez vuelve a cargar (desde caché HTTP) |
| A21 | Sin conexión y modelo no cacheado | model_load_failed con mensaje |
| A22 | WebGL no disponible en Worker | CPU con aviso o plan B (11.2) |
| A23 | Editar una nota y reproducir el audio | Sin seguimiento + aviso (19.2) |
| A24 | Reajustar ritmo y luego deshacer | Vuelve al ritmo anterior; seguimiento desactivado hasta reajustar de nuevo |
| A25 | Cerrar el panel durante el análisis | Se cancela el análisis y se detiene el audio |
| A26 | Pestaña en segundo plano durante el análisis | El Worker sigue; al volver se ve el progreso |
| A27 | Elegir otro audio durante el análisis | Se cancela el anterior |
| A28 | Partitura con cambios sin guardar al abrir el resultado | `prepareReplace` decide antes |
| A29 | Teléfono con poca memoria y 90 s de Basic Pitch | out_of_memory → mensaje |
| A30 | Doble toque en "Escribir la melodía sola" | Botón deshabilitado durante el análisis |

---

## 25. Errores

| Situación | Mensaje |
|---|---|
| Decodificación | "No se pudo leer ese audio. Prueba con MP3, M4A (notas de voz) o WAV." |
| Archivo grande | "El audio es demasiado grande (máximo 50 MB). Recórtalo e inténtalo de nuevo." |
| Duración | "El audio dura más de 15 minutos. Recórtalo e inténtalo de nuevo." |
| Sin notas, solo | "No encontré notas claras. Usa una grabación de una sola voz o instrumento, sin acompañamiento y sin ruido. Si es una canción completa, elige «Canción completa»." |
| Sin notas, mezcla | "No encontré una melodía clara. Prueba seleccionando solo un pedazo donde se oiga bien la voz." |
| Sin notas, partes | "No encontré notas claras en ese pedazo. Prueba con otro." |
| Errores de Worker | Tabla 20.5 |

Todos en el panel (`aria-live="polite"`), clase `.err`.

---

## 26. Accesibilidad

- Onda: `<canvas>` con `aria-label="Onda del audio: toca para mover, arrastra para repetir un pedazo"` y, además,
  control alternativo accesible: los botones "Desde aquí"/"Hasta aquí" + flechas ← → para mover la posición 1 s
  cuando la onda tiene el foco (nuevo).
- Tiempo y bucle legibles por lector de pantalla (`aria-live="off"` para no saturar; se anuncian al pausar).
- Progreso con `role="progressbar"` y `aria-valuenow`.
- Botones con texto, no solo iconos (salvo ▶ con `aria-label`).

---

## 27. Performance

| Operación | Objetivo (iPhone 12) | Legacy (estimado) |
|---|---|---|
| YIN, 60 s | ≤ 6 s | ~20-40 s en hilo principal |
| Mezcla, 60 s | ≤ 10 s | ~15 s |
| Basic Pitch, 30 s WebGL | ≤ 20 s | similar |
| Carga del modelo (caché fría, 4G) | ≤ 3 s | base64 de 1 MB + `atob` |
| WSOLA 90 s a 70 % | ≤ 2 s | congelaba la UI |
| Onda (recalcular picos) | ≤ 30 ms | igual |
| Seguimiento F16 por frame | ≤ 0,1 ms | — |
| Memoria pico en partes 90 s | ≤ 400 MB | — |

Medición con `performance.now()` en el Worker y reporte en diagnóstico; test de rendimiento en Playwright WebKit.

---

## 28. Testing scenarios

### 28.1 Fixtures de audio (todos gratuitos y propios)

| Archivo | Cómo se obtiene |
|---|---|
| `sine-scale-c4.wav` | Generado por script: escala de Do con senos, negras a 100 bpm |
| `saw-melody-detuned.wav` | Generado: melodía con sierra, desafinada +30 cents, vibrato |
| `himno-voz.m4a` | Grabación propia del equipo cantando el Himno de la alegría |
| `mix-synth.wav` | Generado: melodía + bajo + acordes sintetizados con alturas conocidas |
| `notes-53-54.wav` | Generado: notas Fa3 y Fa♯3 en contexto polifónico |
| `silence.wav`, `noise.wav` | Generados |

Scripts en `scripts/gen-audio-fixtures.mjs` (Node, sin dependencias de pago). Los audios generados tienen
"verdad" conocida (archivo `.json` con las notas esperadas).

### 28.2 Unit (core/analysis)

| ID | Función | Escenario | Esperado |
|---|---|---|---|
| T-YIN-01 | yin | Seno de 440 Hz | f0 = 440 ± 1 Hz |
| T-YIN-02 | yin | Senos 65 Hz y 1 100 Hz (límites) | Detectados |
| T-YIN-03 | yin | Ruido | Sin f0 en ≥ 95 % de tramas |
| T-YIN-04 | yin (FFT) vs yin legacy | Fixtures | Notas iguales en ≥ 98 % |
| T-SEG-01 | segmentNotes | Secuencias con glitches de 1-2 tramas | Absorbidos |
| T-SEG-02 | segmentNotes | Fuera de 28..100 | Descartadas |
| T-MIX-01 | melodyMix | `mix-synth.wav` | ≥ 80 % de notas de la melodía (verdad conocida) |
| T-MIX-02 | dropOutliers | Nota corta con salto de 12 | Eliminada |
| T-SKY-01 | skyline | Casos de 12.1 (reemplazo < 60 ms, corte, continuación) | Según reglas |
| T-SPL-01 | splitParts | `notes-53-54` en eventos | Ambas en alguna parte |
| T-SPL-02 | splitParts | Bajo indistinguible | Sin parte de bajo |
| T-CHD-01 | chordsFor | Tríadas sintéticas Do, Lam, Sol7, Rem7, Si dim | Nombres correctos |
| T-CHD-02 | chordsFor | key < 0 | Nombres con bemoles |
| T-CHD-03 | attachChords | Distancia > 4 | No se asigna |
| T-TMP-01 | guessTempo | Clics a 60, 90, 120, 148 bpm | ±1 bpm (150 exacto: ver A15b) |
| T-TMP-02 | guessTempo | 180 bpm | 90 |
| T-KEY-01 | guessKey | Escalas mayores en 12 tónicas | Armadura correcta |
| T-KEY-02 | guessKey | Escalas menores armónicas | Armadura de la relativa |
| T-QNT-01 | quantize | Jitter ±20 ms a 100 bpm | Duraciones exactas |
| T-QNT-02 | quantize | Hueco de 1 semicorchea | Absorbido por la nota anterior |
| T-QNT-03 | quantize | timeline | Un intervalo por nota, índices correctos |
| T-QNT-04 | quantize | > 3 000 notas | Recortado |
| T-WSO-01 | wsola | Seno a 50 % | Duración ×2, frecuencia igual (±1 %) |
| T-LIM-01 | strings | Ningún texto con duración literal distinta de EAR_LIMITS | Sí |

### 28.3 Workers y service

| ID | Escenario | Esperado |
|---|---|---|
| T-WRK-01 | detect solo con fixture | detect_done con notas |
| T-WRK-02 | Progreso como máximo cada 100 ms | Sí |
| T-WRK-03 | Cancelar a mitad | cancelled en < 500 ms |
| T-WRK-04 | Worker que no responde a cancel | terminate y recreación |
| T-WRK-05 | Transferencia: el mono original sigue utilizable tras pedir análisis | Sí |
| T-WRK-06 | Basic Pitch carga el modelo una vez para dos análisis | Una petición de red al modelo |
| T-WRK-07 | Fallo de carga del modelo | model_load_failed → mensaje |
| T-SVC-01 | Resultado solo → replaceScore con título "(de oído)", source ear_solo | Sí |
| T-SVC-02 | Abrir parte bajo → instrumento bajo; melodía con instrumento actual bajo → piano | Sí |
| T-SVC-03 | Reajustar ritmo entra al historial | Deshacer restaura |
| T-F16-01 | Seguimiento: posición 1,23 s → índice correcto | Sí |
| T-F16-02 | Partitura editada → seguimiento desactivado + aviso | Sí |
| T-F16-03 | Silencio → índice −1 | Sí |

### 28.4 Componentes

| ID | Escenario |
|---|---|
| T-UI-01 | Onda: toque mueve posición; arrastre > 6 px crea A-B ≥ 0,3 s |
| T-UI-02 | Desde aquí / Hasta aquí con y sin A-B previo (reglas 5.3) |
| T-UI-03 | Velocidad < 100 % muestra "Preparando audio lento…" y luego reproduce |
| T-UI-04 | Botón principal deshabilitado durante el análisis; Cancelar visible |
| T-UI-05 | Lista de partes con rango "Do3–Sol4" y resumen de acordes |
| T-UI-06 | Casilla de acordes afecta el resultado |
| T-UI-07 | Texto de privacidad visible |
| T-UI-08 | Mensajes de error por modo |

### 28.5 E2E

| ID | Flujo | Navegadores |
|---|---|---|
| E2E-EAR-01 | Subir `sine-scale-c4.wav`, modo solo → 8 notas Do-Do, ♩ ≈ 100 | Chromium, WebKit |
| E2E-EAR-02 | Subir `mix-synth.wav`, modo partes → Melodía y Bajo; abrir Melodía con acordes | Chromium |
| E2E-EAR-03 | Reproducir audio al 50 % con A-B | Chromium |
| E2E-EAR-04 | Cancelar análisis | Chromium |
| E2E-EAR-05 | Interceptar red durante todo el flujo: ningún request con el audio (US-E07) | Chromium |
| E2E-EAR-06 | Reproducir el audio tras abrir el resultado: `.play` se mueve en la partitura (F16) | Chromium |
| E2E-EAR-07 | Rendimiento YIN 60 s | WebKit |

---

## 29. Quality Gates

| Métrica | Umbral |
|---|---|
| Cobertura `core/analysis` | ≥ 90 % líneas, ≥ 85 % ramas |
| Cobertura `modules/ear` | ≥ 80 % |
| Precisión YIN en fixtures sintéticos | ≥ 95 % de notas |
| Precisión YIN en `himno-voz.m4a` | ≥ 90 % de notas (US-E01) |
| Precisión mezcla en `mix-synth.wav` | ≥ 80 % |
| Equivalencia YIN-FFT vs legacy | ≥ 98 % |
| Funciones de análisis | ≤ 60 líneas, complejidad ≤ 10 |
| Bundle | TF.js y el módulo `ear` fuera del chunk inicial |
| Privacidad | E2E-EAR-05 verde obligatorio |

---

## 30. Trazabilidad

| Historia | Criterio | Sección | Tests |
|---|---|---|---|
| US-E01 | ≥ 90 % notas en voz sola | 8, 9, 16, 17.1 | T-YIN-*, T-SEG-*, E2E-EAR-01, gate |
| US-E01 | 60 s ≤ 6 s sin congelar | 8.2, 20 | T-YIN-04, E2E-EAR-07 |
| US-E02 | Partes con rango, acordes opcionales, límite real 90 s | 11-13, 22 | T-SPL-*, T-CHD-*, T-LIM-01, E2E-EAR-02 |
| US-E03 | Velocidad sin cambio de tono | 7 | T-WSO-01, E2E-EAR-03 |
| US-E04 | Repetir un pedazo | 5.2, 6 | T-UI-01/02 |
| US-E05 | Reajustar ritmo | 18 | T-SVC-03 |
| US-E06 | Cancelar | 20.4 | T-WRK-03/04, E2E-EAR-04 |
| US-E07 | El audio no se sube | 1, 21 | E2E-EAR-05 |
| US-E08 | Guardar audio (Could) | 21 | (si se implementa) |
| US-E09 | Seguimiento del audio | 19 | T-F16-*, E2E-EAR-06 |

---

## 31. Diferencias intencionales con legacy

| # | Legacy | Nuevo | Motivo |
|---|---|---|---|
| D1 | Análisis en el hilo principal con `setTimeout` | Workers | Deuda 5 |
| D2 | YIN con doble bucle | Diferencia vía FFT | Deuda 5 |
| D3 | Melodía ≥ 55 / bajo ≤ 52 | Skyline sobre todo + resto | Deuda 4 |
| D4 | Texto "hasta 1 minuto" con límite de 90 s | Constantes únicas | Deuda 6 |
| D5 | Sin cancelar | Cancelar | US-E06 |
| D6 | Modelo JSON base64 con `atob` | Binario estático con caché | Tamaño y velocidad |
| D7 | Sin seguimiento del audio | F16 | Aprobado 2026-10-18 |
| D8 | Sin aviso de privacidad | "Tu audio no sale de tu teléfono." | Diferenciador (análisis competitivo) |
| D9 | Sin límite de tamaño/duración | 50 MB / 15 min | Memoria en móviles |
| D10 | Onda solo con gestos | + control por teclado | Accesibilidad |

---

## 32. Preguntas abiertas

| ID | Pregunta | Propuesta por defecto |
|---|---|---|
| Q1 | ¿Paquete npm `@spotify/basic-pitch` o código vendorizado de legacy? | Decidir en semana 1 por prueba |
| Q2 | ¿Basic Pitch en Worker en Safari de iPhone? | Probar en semana 1; plan B hilo principal |
| Q3 | ¿Mantener el seguimiento (F16) tras editar, realineando por tiempo? | No en el MVP |
| Q4 | ¿Ofrecer "solo la voz" en mezcla como modo por defecto para canciones? | No; el modo por defecto sigue siendo "solo" |
| Q5 | ¿Detectar compás (3/4, 6/8) además de tempo? | No en el MVP; siempre 4/4 como legacy |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Spec Writer
