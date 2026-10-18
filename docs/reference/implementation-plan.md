---
name: atril-implementation-plan
status: in-progress
created: 2026-10-18T12:11:33Z
updated: 2026-10-18T13:03:42Z
---

# Plan de Implementación - Atril (MVP, 6-8 semanas)

**Estado:** 🟡 Aprobado para empezar (2026-10-18)
**Equipo:** 1 persona + Claude Code
**Dedicación supuesta:** ~25 h por semana
**Modalidad:** MVP (technical-decisions 1.3), sin login ni backend (R3), todo gratis (R7)

---

## 1. Resumen

| Semana | Tema | Milestone |
|---|---|---|
| 1 | Fundaciones: repo, Vite, CI, Vercel, núcleo musical con tests dorados, pruebas de riesgo | **M1** la app vacía se despliega sola y el núcleo pasa los dorados |
| 2 | Partitura en pantalla + editor básico | |
| 3 | Editor completo + sonido | **M2** se puede escribir, escuchar y transportar en el celular |
| 4 | "Mis partituras" + exportar | |
| 5 | Importar + De oído (voz sola, mezcla, reproductor) | **M3** paridad con legacy salvo Basic Pitch |
| 6 | De oído: partes con Basic Pitch, acordes, seguimiento del audio | |
| 7 | Calidad: accesibilidad, rendimiento, E2E en WebKit, pantalla de inicio, verificaciones manuales | **M4** MVP listo para usuarios |
| 8 | Margen (buffer) + lanzamiento | Publicación |

Margen: la semana 8 completa (~14 % del total) más ~10 % dentro de cada semana.

---

## 2. Dependencias entre bloques

```
S1 núcleo (theory, instruments, rhythm, notation, formats-export) ──┬─► S2 score-view ─► S3 editor + playback
                                                                    │                        │
S1 infra (Vite, CI, Vercel, idb)  ──────────────────────────────────┼────────────────────────┼─► S4 library + export
                                                                    │                        │
S1 spikes (Basic Pitch en Worker, CSP, iOS audio) ─────────────────►│                        └─► S5 import + ear solo/mix
                                                                    └──────────────────────────────► S6 ear partes
```

---

## 3. Semana 1 — Fundaciones

**Objetivo:** que todo lo que viene después se construya sobre algo probado y desplegado.

### 3.1 Tareas

| # | Tarea | Spec | Estimado |
|---|---|---|---|
| 1.1 | Crear app Vite + React + TypeScript strict, estructura de carpetas (technical-decisions 6.6), alias `@/` | TD 2, 6.6, 9.6 | 2 h |
| 1.2 | ESLint (límites de 9.1-9.2), Prettier, dependency-cruiser (9.4), `check-module-size.mjs` | TD 9, 17.1 | 3 h |
| 1.3 | Vitest + Testing Library + fake-indexeddb; Playwright con Chromium y WebKit | TD 16.1 | 2 h |
| 1.4 | GitHub Actions: typecheck, lint, depcruise, test, build, tamaño de bundle | TD 17.2 | 2 h |
| 1.5 | Conectar el repo a Vercel (Hobby), `vercel.json` con CSP y cabeceras, preview por rama | TD 2.3, 13.5-13.6 | 1 h |
| 1.6 | `scripts/legacy-fixtures.mjs`: generar dorados desde `legacy/index.html` | TD 16.2 | 2 h |
| 1.7 | Portar `core/theory`, `core/instruments` (19 instrumentos), `core/rhythm` con tests | notation-core 3-9 | 4 h |
| 1.8 | Portar `core/notation` (`buildAbc` + D1/D2) con dorados | notation-core 10-11 | 3 h |
| 1.9 | Portar `core/formats` export (MusicXML con `<transpose>` general y `<harmony>`, MIDI) con dorados y XSD | formats 4-5 | 4 h |
| 1.10 | **Spike** Basic Pitch: paquete npm vs vendorizado; Worker + WebGL en Safari iPhone; `split-bp-model.mjs` | ear 11, Q1-Q2 | 3 h |
| 1.11 | **Spike** CSP: TF.js y abcjs funcionan con la CSP de 13.5 | TD 13.5, RK7 | 1 h |

Total ≈ 27 h.

### 3.2 Entregables y criterios (M1)

- [ ] `main` despliega en Vercel automáticamente; la URL muestra la pantalla base de Atril.
- [ ] CI verde con todos los gates (sin E2E todavía).
- [ ] `core/*` portado con cobertura ≥ 95 % y dorados 100 % iguales salvo excepciones registradas.
- [ ] Decisiones de los spikes registradas como ADR en `technical-decisions.md` (Basic Pitch: paquete o vendorizado;
      Worker o hilo principal; CSP final).

### 3.3 Riesgos de la semana

| Riesgo | Plan B |
|---|---|
| Basic Pitch no corre en Worker en Safari | Hilo principal con progreso (ear 11.2) |
| TF.js exige `unsafe-eval` | ADR documentando la excepción |
| Diferencias en los dorados difíciles de explicar | Comparar paso a paso con legacy en Node; no avanzar hasta explicarlas |

---

## 4. Semana 2 — Partitura en pantalla + editor básico

### 4.1 Tareas

| # | Tarea | Spec | Estimado |
|---|---|---|---|
| 2.1 | Tokens de tema (portados de legacy), modo oscuro, fuentes locales, componentes base (Button, Segmented, Overlay, Toast, Field) | TD 10.7 | 4 h |
| 2.2 | `AppShell` con layout de atril: cabecera, formulario, barra de vista, hoja, dock | editor 2, 10 | 3 h |
| 2.3 | `score-view`: render con abcjs por rAF, ResizeObserver, opciones 12.3, mapa de elementos | notation-core 12, 11 | 5 h |
| 2.4 | Resaltados `.sel`, `.oor`, `.play`; barra de estado | notation-core 13, 15 | 3 h |
| 2.5 | `useScoreStore` con acciones 4.1-4.9 y `core/score/score-ops.ts` | editor 4-5 | 5 h |
| 2.6 | Piano en pantalla (40 px) + `useNoteInput` | editor 8.1 | 3 h |
| 2.7 | Herramientas de duración, puntillo, silencio, borrar | editor 9 | 2 h |

Total ≈ 25 h.

### 4.2 Criterios

- [ ] Escribir con el piano y ver las notas aparecer en ≤ 50 ms con 200 notas (medido).
- [ ] Seleccionar una nota tocándola y reemplazarla.
- [ ] Probado en Chrome de escritorio y Safari de iPhone.

---

## 5. Semana 3 — Editor completo + sonido (M2)

### 5.1 Tareas

| # | Tarea | Spec | Estimado |
|---|---|---|---|
| 3.1 | Historial con rehacer y agrupación de título | editor 6 | 3 h |
| 3.2 | Diapasón y Do-Re-Mi, modo de entrada persistido | editor 8.2-8.3 | 4 h |
| 3.3 | Teclado de computadora completo (incluye Ctrl/Cmd+Z/Shift+Z, `repeat`) | editor 8.4 | 2 h |
| 3.4 | Formulario de metadatos y barra de vista, mover todo con aviso de recorte | editor 10, 4.9 | 3 h |
| 3.5 | `playback`: contexto, unlock iOS, Karplus-Strong, piano, sostenidos | playback 4-7 | 6 h |
| 3.6 | Programador con lookahead, posición, `stopAll` | playback 9-12 | 3 h |
| 3.7 | E2E del editor (E2E-ED-*) y de playback (E2E-PB-*) | editor 19.6, playback 20.3 | 3 h |

Total ≈ 24 h.

### 5.2 Criterios (M2)

- [ ] Las 9 historias US-W y US-P01..P03 pasan sus criterios.
- [ ] Suena en iPhone con el interruptor de silencio.
- [ ] Los 8 timbres revisados con audífonos y altavoz.
- [ ] Demo: escribir "Estrellita" en saxofón alto, verla en La mayor, escucharla, cambiar a sonido real.

---

## 6. Semana 4 — "Mis partituras" + exportar

### 6.1 Tareas

| # | Tarea | Spec | Estimado |
|---|---|---|---|
| 4.1 | `infra/idb.ts` con migración v1 | library 4, TD 7.5 | 2 h |
| 4.2 | Repositorio, mapper, guardado automático, arranque, `prepareReplace` | library 5-7 | 5 h |
| 4.3 | Overlay "Mis partituras": lista, papelera, ejemplos (con La cucaracha en desarrollo) | library 8-10 | 4 h |
| 4.4 | Respaldo: hacer copia y restaurar con fusión | library 11-12 | 4 h |
| 4.5 | Durabilidad: `storage.persist`, manifiesto, sugerencia iOS, recordatorio; varias pestañas | library 13-14 | 3 h |
| 4.6 | Exportar: ZIP MuseScore (fflate), PNG, PDF (jsPDF diferido), copiar ABC, compartir | formats 6-10 | 5 h |

Total ≈ 23 h.

### 6.2 Criterios

- [ ] Recargar la página conserva todo; un ejemplo sin tocar no ensucia la lista.
- [ ] Copia en un navegador y restauración en otro con resultado idéntico.
- [ ] MusicXML abre en MuseScore Studio 4 sin avisos (verificación manual de formats 22.5, primera ronda).
- [ ] Compartir PDF por WhatsApp desde un Android y un iPhone.

---

## 7. Semana 5 — Importar + De oído básico (M3)

### 7.1 Tareas

| # | Tarea | Spec | Estimado |
|---|---|---|---|
| 5.1 | Importadores: MusicXML (cursor de tiempo, anacrusa, acordes), .mxl, MIDI (running status), ABC; `decodeText` | formats 11-15 | 7 h |
| 5.2 | UI "Buscar o abrir" y panel de avisos | formats 16-17 | 2 h |
| 5.3 | Panel De oído: cargar audio, onda, transporte, A-B | ear 4-6 | 4 h |
| 5.4 | `stretch.worker` (WSOLA) | ear 7 | 2 h |
| 5.5 | `pitch.worker`: YIN con FFT, segmentación, mezcla; tempo, tonalidad, cuantización; cancelar | ear 8-10, 14-17, 20 | 7 h |
| 5.6 | Script de audios de prueba y verdad conocida | ear 28.1 | 2 h |

Total ≈ 24 h.

### 7.2 Criterios (M3)

- [ ] Abre los fixtures de MuseScore, Finale y Sibelius de `tests/fixtures/files/`.
- [ ] Voz sola: ≥ 90 % de notas en `himno-voz.m4a`; 60 s en ≤ 6 s en iPhone 12 sin congelar.
- [ ] Paridad con legacy en todo excepto Basic Pitch.

---

## 8. Semana 6 — De oído: partes, acordes y seguimiento

### 8.1 Tareas

| # | Tarea | Spec | Estimado |
|---|---|---|---|
| 6.1 | Modelo Basic Pitch como estático con caché; `basic-pitch.worker` (o plan B del spike) | ear 11 | 6 h |
| 6.2 | `splitParts` sin hueco 53-54, skyline | ear 12 | 2 h |
| 6.3 | Acordes y `attachChords`, lista de partes, casilla de acordes | ear 13, 17.2 | 3 h |
| 6.4 | Reajustar ritmo al tempo | ear 18 | 1 h |
| 6.5 | F16: la partitura sigue al audio | ear 19 | 3 h |
| 6.6 | Textos derivados de `EAR_LIMITS`, mensaje de privacidad | ear 22 | 1 h |
| 6.7 | E2E de De oído (incluida la prueba de red sin audio) | ear 28.5 | 4 h |
| 6.8 | F14 (audios locales) **solo si todo lo anterior está verde** | ear 21, library 17 | 4 h |

Total ≈ 20-24 h.

### 8.2 Criterios

- [ ] `mix-synth.wav` → Melodía y Bajo; melodía ≥ 80 % de notas.
- [ ] Ningún request de red contiene el audio (E2E-EAR-05).
- [ ] Seguimiento del audio visible al reproducir.

---

## 9. Semana 7 — Calidad (M4)

### 9.1 Tareas

| # | Tarea | Estimado |
|---|---|---|
| 7.1 | Auditoría de accesibilidad (axe + lector de pantalla VoiceOver en iPhone y TalkBack en Android) | 4 h |
| 7.2 | Rendimiento: medir todos los objetivos de TD 15.2 y specs; corregir los que fallen | 5 h |
| 7.3 | E2E completos en WebKit móvil; capturas visuales de referencia | 4 h |
| 7.4 | **Verificar "La cucaracha" al oído** y marcarla `verified: true` (o corregirla) | 1 h |
| 7.5 | Verificación manual en MuseScore Studio 4 (formats 22.5), segunda ronda con flauta dulce y cifrados | 2 h |
| 7.6 | Textos: revisión de todos los `strings.ts`, ayuda y "Acerca de" (licencias: abcjs MIT, Basic Pitch Apache-2.0 con NOTICE, TF.js, fflate, jsPDF) | 3 h |
| 7.7 | Aviso en el artifact original: "Atril se mudó a …; descarga tus partituras para MuseScore y ábrelas allá" | 1 h |
| 7.8 | Lighthouse en el preview: LCP ≤ 2 s en 4G, INP ≤ 150 ms | 2 h |

Total ≈ 22 h.

### 9.2 Criterios (M4)

- [ ] Todas las historias Must pasan sus criterios.
- [ ] Gates de calidad verdes (TD 17), cobertura ≥ 85 %.
- [ ] 0 violaciones axe en pantallas principales.
- [ ] Probado en: iPhone (Safari), Android (Chrome), Chrome y Safari de escritorio.

---

## 10. Semana 8 — Margen y lanzamiento

- Absorber retrasos de las semanas anteriores.
- Si sobra: F14, "Compartir por enlace en la URL" (análisis competitivo 11.2) **no** entra (post-MVP).
- Lanzamiento: merge a `main`, comprobar despliegue, probar la URL de producción en los 4 navegadores, anunciar.
- Mover docs de `development/current/` a `development/completed/` (fase 3 de Oden).

---

## 11. Seguimiento

| Práctica | Detalle |
|---|---|
| Log diario | `docs/development/current/AAAA-MM-DD.md`: qué se hizo, qué falta, bloqueos, mediciones |
| Revisión semanal | Al cerrar cada semana: criterios marcados, desvío en horas, ajuste del plan |
| Commits | Pequeños, en español, autor `Niicko12@users.noreply.github.com` (Vercel) |
| Ramas | `main` despliega; trabajo por semana en ramas `semana-N` con PR (preview automático en Vercel) |
| Cambios de alcance | Solo con PRD/decisión registrada en `technical-decisions.md` |

---

## 12. Riesgos del plan

| Riesgo | Señal temprana | Respuesta |
|---|---|---|
| Basic Pitch en iPhone | Spike de la semana 1 falla | Plan B hilo principal; si también falla, ocultar el modo "partes" en iOS para el MVP |
| Port del núcleo más lento de lo previsto | Dorados en rojo al final de la semana 1 | Usar parte del margen de la semana 8 |
| Audio en iOS | Silencio en pruebas manuales | Revisión diaria en iPhone durante la semana 3 |
| Pérdida de datos en Safari | Reportes de usuarios | Recordatorio de copia y sugerencia de instalar ya están en el plan (semana 4) |
| Minutos de GitHub Actions agotados | Aviso de GitHub | E2E solo en PR a `main`; repo público si hace falta (sigue gratis) |

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Implementation Planner
