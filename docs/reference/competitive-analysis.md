---
name: atril-competitive-analysis
status: in-progress
created: 2026-10-18T12:11:33Z
updated: 2026-10-18T12:51:10Z
---

# Análisis Competitivo - Atril

**Estado:** 🟡 En Progreso (completo para el MVP; revisar precios antes de lanzar)
**Última actualización:** 2026-10-18
**Autor:** Domain Expert (Oden Forge)

---

## Índice

1. Resumen ejecutivo
2. Metodología y fuentes
3. Mapa competitivo
4. Fichas por competidor
   - 4.1 MuseScore (Studio + musescore.com + app)
   - 4.2 Flat.io
   - 4.3 Noteflight
   - 4.4 Soundslice
   - 4.5 Moises
5. Matriz comparativa de funcionalidades
6. Huecos de mercado y propuesta de valor de Atril
7. User personas
8. Journey maps
9. User stories
10. Priorización de features
11. Implicaciones para specs y arquitectura
12. Riesgos competitivos
13. Fuentes

---

## 1. Resumen ejecutivo

### 1.1 Conclusión en una frase

Ningún competidor junta en una sola app **gratuita, en español y pensada para el celular** las tres cosas que
necesita un músico aficionado: *escribir una melodía sin saber mucho de partitura*, *tenerla transportada para su
instrumento* y *sacarla de un audio*. Atril puede ocupar ese hueco si mantiene el editor simple y hace muy bien la
transposición y "De oído".

### 1.2 Hallazgos clave

| # | Hallazgo | Implicación para Atril |
|---|---|---|
| H1 | MuseScore, Flat y Noteflight son **editores completos** con curva de aprendizaje alta en el celular | No competir en profundidad de notación; competir en rapidez y simplicidad móvil |
| H2 | Moises domina "sacar de un audio" (separación de pistas, acordes), pero **no entrega partitura editable de la melodía** como producto central (no verificado en esta investigación) | "De oído → partitura para mi instrumento" es diferenciador si la calidad es aceptable |
| H3 | Soundslice tiene la mejor experiencia de **práctica** (partitura sincronizada con audio/video, ralentizar, bucles) | Copiar el patrón A-B + velocidad que ya existe en legacy y unirlo a la partitura |
| H4 | La **transposición para instrumentos transpositores** existe en los editores, pero está escondida en menús | Hacerla el centro: "elige tu instrumento" en el primer paso |
| H5 | Los modelos de negocio rondan **US$40-50 al año** para el plan individual (precios aproximados, ver 2.3) | El MVP es gratuito; monetización después y por debajo de ese rango |
| H6 | Reseñas públicas de musescore.com mencionan quejas por **cobros y cancelación** | Ventaja de confianza: sin muro de pago en el MVP y sin suscripciones confusas |
| H7 | Flat y Noteflight apuntan fuerte a **escuelas** (Google Classroom, LTI) | Segmento educativo queda para después; el MVP apunta al músico individual |
| H8 | El español suele ser una traducción de la interfaz, no un producto pensado para Latinoamérica (repertorio, solfeo Do-Re-Mi) | Solfeo latino por defecto, ejemplos tradicionales latinoamericanos, tono cercano |

### 1.3 Recomendaciones

1. **Mantener el alcance del MVP** definido en `technical-decisions.md` (sección 3): ya cubre lo que diferencia a
   Atril.
2. **Subir de prioridad** dos detalles baratos que los competidores hacen bien:
   - Partitura que **sigue al audio** en "De oído" (resaltar la nota mientras suena el audio original) → nueva
     historia US-E09 como *Should*.
   - **Compartir por enlace de solo lectura** → *Could* post-MVP (requiere cambio de schema; ver 11).
3. **No intentar** igualar polifonía, partes de orquesta, ni biblioteca de partituras con licencia.

---

## 2. Metodología y fuentes

### 2.1 Selección de competidores

Elegidos por el usuario el 2026-10-18:

| Competidor | Por qué está | Tipo |
|---|---|---|
| MuseScore (Studio, musescore.com, app) | Referente gratuito de notación + mayor comunidad de partituras | Directo (escribir) e indirecto (encontrar partituras) |
| Flat.io | Editor web colaborativo, usable en el navegador del celular | Directo |
| Noteflight | Editor web de larga trayectoria, fuerte en educación | Directo |
| Soundslice | Práctica con partitura sincronizada, escaneo de partituras | Indirecto (practicar/aprender) |
| Moises | Separación de pistas y acordes desde audio | Indirecto (sacar de oído) |

Soundslice y Moises se agrupan en una sola opción del cuestionario, pero se analizan por separado porque resuelven
problemas distintos.

### 2.2 Criterios de evaluación

| Criterio | Peso | Qué se mira |
|---|---|---|
| Escribir en el celular | 20 % | ¿Se puede escribir una melodía de 16 compases con el dedo en < 5 min? |
| Transposición por instrumento | 15 % | ¿Elegir "saxofón alto" basta para ver la parte correcta? |
| De audio a partitura | 15 % | ¿Puedo obtener la melodía escrita desde una grabación? |
| Práctica (escuchar, ralentizar, bucles) | 10 % | Herramientas para estudiar |
| Importar / exportar | 10 % | MusicXML, MIDI, PDF |
| Precio y modelo | 10 % | Qué es gratis, cuánto cuesta lo demás |
| Español y contexto latino | 10 % | Idioma, solfeo, repertorio |
| Curva de aprendizaje | 10 % | Tiempo hasta el primer resultado útil |

### 2.3 Fuentes y limitaciones

- **Precios:** tomados de páginas oficiales cuando aparecieron en la búsqueda (Noteflight) y de tiendas de apps o
  listados de terceros en el resto. Varían por país y cambian con frecuencia. **Todos los precios de este documento
  son aproximados en USD a octubre de 2026 y deben verificarse en el sitio oficial antes de usarlos para decisiones
  de negocio.**
- **Funcionalidades:** combinan búsquedas de octubre de 2026 con conocimiento general del producto. Las marcadas
  **(no verificado)** no se confirmaron con una fuente en esta investigación.
- **No se hicieron pruebas de usuario** con los competidores. Se recomienda una sesión de 30 min por competidor
  antes de la spec de `editor` (tarea en 11.3).

---

## 3. Mapa competitivo

### 3.1 Ejes: profundidad de notación vs. foco en audio

```
                     Foco en AUDIO (sacar de oído, practicar)
                                    ▲
                                    │
                         Moises ●   │
                                    │        ● Soundslice
                                    │
                                    │
            ★ Atril (objetivo)      │
                                    │
  Simple ◄──────────────────────────┼──────────────────────────► Notación profunda
  (aficionado)                      │                            (profesional)
                                    │
                                    │                 ● Noteflight
                                    │          ● Flat.io
                                    │
                                    │                         ● MuseScore Studio
                                    ▼
                     Foco en PARTITURA (escribir, grabar)
```

Atril se ubica en el cuadrante **simple + audio-partitura**: más fácil que los editores y con salida escrita, a
diferencia de Moises.

### 3.2 Ejes: móvil vs. precio

```
                         Gratis
                           ▲
     MuseScore Studio ●    │   ★ Atril (MVP gratis, móvil primero)
     (escritorio)          │
                           │
  Escritorio ◄─────────────┼─────────────► Móvil
                           │
     Noteflight ●          │       ● Moises
     Flat.io ●             │   ● musescore.com app
     Soundslice ●          │
                           ▼
                   Suscripción ~US$40-60/año
```

Nota: Flat, Noteflight y Soundslice funcionan en el navegador del celular, pero su experiencia de *edición* está
pensada para pantalla grande (no verificado en pruebas propias).

---

## 4. Fichas por competidor

### 4.1 MuseScore (Muse Group)

#### 4.1.1 Qué es

Ecosistema de tres piezas:

| Pieza | Qué hace | Plataforma |
|---|---|---|
| **MuseScore Studio** | Editor de notación de escritorio, gratuito y de código abierto | Windows, macOS, Linux |
| **musescore.com** | Comunidad y catálogo de partituras subidas por usuarios y con licencia | Web |
| **App MuseScore** | Ver, escuchar y practicar partituras del catálogo | iOS, Android |

Muse Group también vende sonidos para reproducción (MuseSounds Pro, ~US$199/año o US$19.99/mes, según KVR Audio).

#### 4.1.2 Público

- Compositores y arreglistas (Studio).
- Músicos que buscan partituras de canciones populares (musescore.com).
- Estudiantes de piano y guitarra que practican con la app.

#### 4.1.3 Modelo de negocio y precios (aproximados)

| Plan | Precio | Fuente |
|---|---|---|
| MuseScore Studio | Gratis | — |
| MuseScore Pro (app/web) | ~US$6.99/mes o ~US$40-50/año, varía por tienda y región | Listados de App Store vía terceros |
| MuseScore Pro+ | Hasta ~US$99.99/año en algunos listados | Ídem |
| MuseSounds Pro | US$199/año o US$19.99/mes | KVR Audio |

#### 4.1.4 Funcionalidades relevantes para Atril

| Funcionalidad | MuseScore | Comentario |
|---|---|---|
| Escribir notas | ✅ Completo (Studio) | Teclado + ratón; muy potente; curva alta |
| Escribir en el celular | ❌ / limitado | La app es sobre todo para ver y practicar (no verificado en detalle) |
| Transposición | ✅ | Instrumentos transpositores y "concert pitch" en Studio |
| Polifonía, letra, dinámicas | ✅ | Muy por encima del alcance de Atril |
| De audio a partitura | ❌ (no verificado) | No es una función central |
| Importar/exportar MusicXML, MIDI, PDF | ✅ | Estándar del sector |
| Catálogo de partituras | ✅ Enorme | Muchas detrás de Pro |
| Práctica (tempo, bucles) | ✅ en la app | Parte de Pro en varias funciones (no verificado) |
| Español | ✅ Interfaz traducida | Solfeo configurable |

#### 4.1.5 Fortalezas

- Gratis y de código abierto en escritorio: estándar de facto para aficionados.
- Comunidad gigante; casi cualquier canción tiene una partitura.
- Formato `.mscz` y exportación MusicXML de muy buena calidad.

#### 4.1.6 Debilidades

- Escribir en el celular no es su fuerte.
- El catálogo web mezcla calidad muy variable.
- Reseñas públicas en Trustpilot con quejas sobre cobros y dificultad para cancelar (anecdótico; MuseScore
  responde caso por caso).
- Muchas funciones de la app y descargas detrás del plan Pro.

#### 4.1.7 Lecciones para Atril

| Copiar | Evitar |
|---|---|
| Exportar un MusicXML que MuseScore abra sin errores (ya es requisito: test con XSD) | Muro de pago para descargar |
| "Concert pitch" como un solo interruptor | Menús profundos para transportar |
| Reproducción con sonido creíble | Pedir instalar algo para empezar |

**Relación estratégica:** MuseScore es **complemento**, no enemigo: Atril es el "bloc de notas rápido" y MuseScore
el "estudio". El botón "Descargar para MuseScore" de legacy refuerza esa posición y debe mantenerse con ese nombre.

---

### 4.2 Flat.io

#### 4.2.1 Qué es

Editor de partituras en el navegador, colaborativo en tiempo real (estilo Google Docs), con fuerte orientación a
escuelas: integraciones con Google Classroom y otros LMS (según su sitio y reseñas).

#### 4.2.2 Público

- Profesores de música y sus alumnos (principal).
- Compositores aficionados que quieren trabajar en la nube.

#### 4.2.3 Modelo de negocio y precios (aproximados)

| Plan | Precio | Fuente |
|---|---|---|
| Gratis | Limitado en número de partituras (no verificado el límite actual) | — |
| Individual ("Power" en listados de terceros) | ~US$6/usuario/mes según SoftwareSuggest; antes US$9.99/mes o US$49/año según una reseña académica | Terceros, no verificado |
| Flat for Education | Teacher Plan (hasta 2 profesores), School & District, District Site License; algún listado da ~US$5/alumno/año | help.flat.io (planes), Subscribed.fyi (precio) |

#### 4.2.4 Funcionalidades relevantes para Atril

| Funcionalidad | Flat | Comentario |
|---|---|---|
| Escribir notas | ✅ | Paleta + teclado de computadora + teclado virtual |
| Escribir en el celular | ⚠️ | Funciona en el navegador; edición incómoda en pantalla chica (no verificado) |
| Transposición | ✅ | Por instrumento y transposición de toda la partitura |
| Colaboración en tiempo real | ✅ | Diferenciador principal |
| De audio a partitura | ❌ (no verificado) | |
| Importar/exportar | ✅ | MusicXML, MIDI, PDF |
| Tareas y evaluación | ✅ | Para escuelas |
| Español | ✅ Interfaz traducida | |

#### 4.2.5 Fortalezas

- Cero instalación, guardado en la nube, historial.
- Colaboración real y flujo de tareas para docentes.
- Interfaz moderna y limpia.

#### 4.2.6 Debilidades

- Producto pensado para escritorio y aula.
- Modelo de precios orientado a instituciones; el individual es menos visible.
- No ayuda a quien no sabe leer partitura.

#### 4.2.7 Lecciones para Atril

| Copiar | Evitar |
|---|---|
| Guardado automático en la nube sin pensar en "guardar" | Exigir cuenta antes de probar |
| Historial / recuperar versiones (post-MVP) | Interfaz de paletas densa en móvil |
| Compartir por enlace (post-MVP) | Orientar el MVP a escuelas |

---

### 4.3 Noteflight (Hal Leonard)

#### 4.3.1 Qué es

Editor de notación en el navegador con catálogo de partituras con licencia (Hal Leonard) y una versión para
escuelas (Noteflight Learn) con integración LTI (Google Classroom, Canvas, Blackboard).

#### 4.3.2 Público

- Escuelas y profesores (Learn).
- Estudiantes y aficionados que quieren escribir y acceder a partituras con licencia (Premium).

#### 4.3.3 Modelo de negocio y precios (página oficial)

| Plan | Precio | Incluye |
|---|---|---|
| Gratis | US$0 | Edición básica con límite de partituras |
| Premium | US$7.95/mes o US$49/año | Creación ilimitada, 85 instrumentos de alta calidad, acceso a más de 80 000 títulos digitales |
| Learn | Desde US$69/año (mínimo 10 usuarios), +US$2/usuario/año adicional | Todo Premium + integración LMS |
| Contenido Premium (Learn) | +US$3/usuario/año | Catálogo de 80 000+ obras |
| SoundCheck (Learn) | +US$8/usuario/año | Evaluación de interpretación |

#### 4.3.4 Funcionalidades relevantes para Atril

| Funcionalidad | Noteflight | Comentario |
|---|---|---|
| Escribir notas | ✅ | Editor web clásico |
| Escribir en el celular | ⚠️ | Funciona en navegador; experiencia de escritorio (no verificado) |
| Transposición | ✅ | |
| Catálogo con licencia | ✅ 80 000+ | Ventaja que Atril no puede replicar |
| Evaluación de interpretación | ✅ SoundCheck (Learn) | Escucha al alumno tocar |
| De audio a partitura | ❌ (no verificado) | |
| Importar/exportar | ✅ | MusicXML, MIDI |
| Español | ✅ Página Premium disponible en español (`?lang=es`) | |

#### 4.3.5 Fortalezas

- Catálogo legal grande gracias a Hal Leonard.
- Integración madura con plataformas escolares.
- Precio claro y publicado.

#### 4.3.6 Debilidades

- Interfaz más antigua.
- Valor principal ligado al catálogo en inglés/EE. UU.
- No orientado al celular.

#### 4.3.7 Lecciones para Atril

| Copiar | Evitar |
|---|---|
| Precio simple y visible (para cuando se monetice) | Depender de un catálogo con licencia |
| Idea de "evaluar mi interpretación" (post-MVP; Atril ya tiene detección de tono) | Interfaz de escritorio en móvil |

---

### 4.4 Soundslice

#### 4.4.1 Qué es

Plataforma para **aprender y enseñar** con partitura/tablatura interactiva sincronizada con audio o video real
(YouTube o propio). Incluye editor, escáner de partituras (foto/PDF → notación) y venta de cursos.

#### 4.4.2 Público

- Profesores que venden lecciones (sobre todo guitarra).
- Estudiantes que practican con transcripciones sincronizadas.

#### 4.4.3 Modelo de negocio y precios (aproximados)

| Plan | Precio | Fuente |
|---|---|---|
| Gratis | Escáner limitado (2 documentos de una página al mes según blog de 2024) | soundslice.com/blog |
| Plus | US$5/mes o US$50/año | soundslice.com/blog |
| Teachers | US$20/mes o US$200/año, alumnos gratis | SBO Magazine (no oficial) |
| Venta de cursos | Comisión; precio mínimo US$1 por curso | soundslice.com/help |

#### 4.4.4 Funcionalidades relevantes para Atril

| Funcionalidad | Soundslice | Comentario |
|---|---|---|
| Partitura sincronizada con audio/video | ✅ | Diferenciador principal |
| Ralentizar, bucles | ✅ | Excelente experiencia de práctica |
| Escanear partitura (imagen → notación) | ✅ | Con límites en plan gratis |
| Escribir notas | ✅ | Editor propio, orientado a transcribir |
| De audio a partitura automática | ❌ / no central (no verificado) | La sincronización es manual/asistida |
| Tablatura | ✅ | Muy fuerte en guitarra |
| Transposición | ✅ (no verificado en detalle) | |
| Español | ⚠️ Ayuda disponible en inglés principalmente (no verificado) | |

#### 4.4.5 Fortalezas

- La mejor experiencia de "estudiar una pieza" del grupo.
- Calidad de grabado y tablatura.
- Modelo para creadores de contenido.

#### 4.4.6 Debilidades

- Requiere que alguien haya hecho y sincronizado la transcripción.
- Foco en guitarra y en profesores.
- No resuelve "tengo una grabación y quiero la partitura" de forma automática.

#### 4.4.7 Lecciones para Atril

| Copiar | Evitar |
|---|---|
| Resaltar en la partitura lo que suena en el audio original (nueva US-E09) | Depender de transcripciones manuales |
| Bucle A-B + velocidad con controles grandes (legacy ya lo tiene) | Complejidad de plataforma de cursos |
| Escanear partitura desde foto (idea post-MVP; requiere OMR, fuera de alcance) | |

---

### 4.5 Moises

#### 4.5.1 Qué es

App para músicos basada en IA: separa una canción en pistas (voz, batería, bajo, guitarra, etc.), detecta acordes,
cambia tono y tempo, metrónomo. Muy popular entre músicos que tocan sobre grabaciones.

#### 4.5.2 Público

- Músicos que practican tocando encima de canciones.
- Bandas que ensayan, cantantes que quieren pistas sin voz.

#### 4.5.3 Modelo de negocio y precios (aproximados)

| Plan | Precio | Incluye | Fuente |
|---|---|---|---|
| Gratis | US$0 | Separación de voz, batería y bajo; detección de acordes; metrónomo | App Store |
| Premium | ~US$5.99/mes o ~US$39.99/año (EE. UU.); £3.99/mes en Reino Unido | Separación avanzada de guitarra y voces | App Store, RouteNote |
| Pro | ~US$29.99/mes (EE. UU.); £29.99/mes o £299.99/año en Reino Unido | Modelos Hi-Fi, más pistas, hasta 180 min por archivo | App Store, RouteNote |

Las fuentes no coinciden entre sí (otra reseña, de un competidor, da US$3.99 y US$9.99); diferencias regionales o
desactualizadas.

#### 4.5.4 Funcionalidades relevantes para Atril

| Funcionalidad | Moises | Comentario |
|---|---|---|
| Separación de pistas | ✅ Excelente | En servidor; muy superior a lo que Atril hace en el navegador |
| Detección de acordes | ✅ Gratis | Competencia directa con los acordes de "De oído" |
| Cambio de tono y tempo | ✅ | Equivalente a la velocidad de legacy, más el cambio de tono |
| Partitura de la melodía | ❌ (no verificado) | No apareció en la investigación como función |
| Escribir / editar notas | ❌ | No es un editor |
| Español | ✅ App disponible en la tienda de México en español | |

#### 4.5.5 Fortalezas

- Calidad de separación de pistas líder.
- Interfaz móvil excelente y muy simple.
- Plan gratis generoso para empezar.

#### 4.5.6 Debilidades

- No entrega partitura editable ni transportada para un instrumento (según lo investigado).
- Procesa en la nube: requiere subir el audio.
- Planes Pro caros.

#### 4.5.7 Lecciones para Atril

| Copiar | Evitar |
|---|---|
| Simplicidad radical en móvil: subir audio → resultado | Prometer calidad de separación de servidor desde el navegador |
| Mostrar acordes de forma clara y grande | Subir el audio sin necesidad (Atril procesa local: argumento de privacidad) |
| Cambiar tono del audio además de velocidad (post-MVP) | |

**Relación estratégica:** Moises es el competidor más peligroso **si añade "partitura de la melodía para tu
instrumento"**. Ver riesgo RC1 en la sección 12.

---

## 5. Matriz comparativa de funcionalidades

Leyenda: ✅ sí · ⚠️ parcial o limitado · ❌ no · ? no verificado · 💲 de pago · **MVP** = plan para Atril.

### 5.1 Escribir y ver

| Funcionalidad | Atril MVP | MuseScore | Flat | Noteflight | Soundslice | Moises |
|---|---|---|---|---|---|---|
| Editor en el navegador | ✅ | ❌ (escritorio) | ✅ | ✅ | ✅ | ❌ |
| Escribir con el dedo en el celular, diseñado para móvil | ✅ | ⚠️ | ⚠️ ? | ⚠️ ? | ⚠️ ? | ❌ |
| Piano en pantalla | ✅ | ✅ | ✅ | ✅ | ? | ❌ |
| Diapasón en pantalla | ✅ | ? | ? | ? | ✅ ? | ❌ |
| Botones Do-Re-Mi | ✅ | ❌ ? | ❌ ? | ❌ ? | ❌ ? | ❌ |
| Atajos de teclado | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Polifonía / varias voces | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Letra | ❌ | ✅ | ✅ | ✅ | ? | ❌ |
| Tablatura | ✅ (guitarra, bajo) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Nombres de notas bajo cada nota | ✅ | ✅ (plugin/opción) | ✅ ? | ? | ? | ❌ |
| Cifrado de acordes | ✅ (desde De oído) | ✅ | ✅ | ✅ | ✅ | ✅ (sin partitura) |

### 5.2 Instrumento y transposición

| Funcionalidad | Atril MVP | MuseScore | Flat | Noteflight | Soundslice | Moises |
|---|---|---|---|---|---|---|
| Elegir instrumento → parte escrita correcta | ✅ (19) | ✅ | ✅ | ✅ | ? | ❌ |
| Interruptor sonido real / escrito | ✅ | ✅ | ✅ | ✅ ? | ? | ❌ |
| Aviso de notas fuera de rango | ✅ | ✅ | ✅ ? | ✅ ? | ? | ❌ |
| Transportar toda la pieza por semitonos | ✅ | ✅ | ✅ | ✅ | ✅ ? | ✅ (audio) |

### 5.3 Audio

| Funcionalidad | Atril MVP | MuseScore | Flat | Noteflight | Soundslice | Moises |
|---|---|---|---|---|---|---|
| Reproducción de la partitura | ✅ (sintetizada) | ✅ (alta calidad 💲) | ✅ | ✅ (85 inst. 💲) | ✅ | ❌ |
| Voz cantada → partitura | ✅ (local) | ❌ ? | ❌ ? | ❌ ? | ❌ ? | ❌ ? |
| Canción completa → melodía escrita | ⚠️ (borrador, local) | ❌ ? | ❌ ? | ❌ ? | ❌ ? | ❌ ? |
| Separación de pistas | ⚠️ (melodía/bajo, local) | ❌ | ❌ | ❌ | ❌ | ✅ (nube) |
| Detección de acordes | ⚠️ (local) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ralentizar sin cambiar tono | ✅ | ✅ (app) | ⚠️ | ⚠️ | ✅ | ✅ |
| Bucle A-B | ✅ | ✅ ? | ? | ? | ✅ | ✅ |
| Partitura sincronizada con grabación real | ❌ (US-E09 Should) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Procesa el audio sin subirlo | ✅ | — | — | — | ❌ ? | ❌ |

### 5.4 Archivos y nube

| Funcionalidad | Atril MVP | MuseScore | Flat | Noteflight | Soundslice | Moises |
|---|---|---|---|---|---|---|
| Importar MusicXML | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Importar MIDI | ✅ | ✅ | ✅ | ✅ | ? | ❌ |
| Importar ABC | ✅ | ⚠️ (plugin) | ❌ ? | ❌ ? | ❌ ? | ❌ |
| Exportar PDF | ✅ | ✅ | ✅ | ✅ | ✅ ? | ❌ |
| Exportar MusicXML + MIDI | ✅ (ZIP) | ✅ | ✅ | ✅ | ✅ ? | ❌ |
| Guardar en la nube | ❌ (en el dispositivo + respaldo; sin login, R3) | ✅ (web) | ✅ | ✅ | ✅ | ✅ |
| Usar sin cuenta | ✅ (nunca hay cuenta) | ✅ (Studio) | ❌ ? | ❌ ? | ⚠️ | ❌ ? |
| Compartir por enlace | ❌ (post-MVP) | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Colaboración en tiempo real | ❌ | ❌ | ✅ | ❌ ? | ❌ | ❌ |
| Catálogo de partituras | ⚠️ (3 ejemplos + enlaces) | ✅ | ⚠️ | ✅ (80 000+ 💲) | ✅ | ❌ |

### 5.5 Negocio y contexto

| Aspecto | Atril MVP | MuseScore | Flat | Noteflight | Soundslice | Moises |
|---|---|---|---|---|---|---|
| Precio individual | Gratis | Gratis (Studio) / ~US$40-50 año (Pro) | ~US$49 año ? | US$49 año | US$50 año | ~US$40 año (Premium EE. UU.) |
| Interfaz en español | ✅ nativa | ✅ | ✅ | ✅ | ⚠️ ? | ✅ |
| Solfeo Do-Re-Mi por defecto | ✅ | ⚠️ configurable | ? | ? | ? | ? |
| Repertorio latino de ejemplo | ⚠️ (ampliar) | Comunidad | ❌ | ❌ | ❌ | — |
| Foco educativo institucional | ❌ | ⚠️ | ✅ | ✅ | ✅ (profesores) | ❌ |

### 5.6 Puntuación ponderada (criterios de 2.2, escala 1-5)

Puntuación del analista basada en la matriz anterior; los ítems "?" se puntuaron de forma conservadora.

| Criterio (peso) | Atril MVP | MuseScore | Flat | Noteflight | Soundslice | Moises |
|---|---|---|---|---|---|---|
| Escribir en el celular (20 %) | 4 | 2 | 3 | 2 | 2 | 1 |
| Transposición (15 %) | 5 | 4 | 4 | 4 | 3 | 1 |
| Audio → partitura (15 %) | 3 | 1 | 1 | 1 | 2 | 2 |
| Práctica (10 %) | 3 | 4 | 2 | 2 | 5 | 4 |
| Importar/exportar (10 %) | 4 | 5 | 4 | 4 | 4 | 1 |
| Precio (10 %) | 5 | 4 | 3 | 3 | 3 | 3 |
| Español y contexto (10 %) | 5 | 3 | 3 | 3 | 2 | 3 |
| Curva de aprendizaje (10 %) | 4 | 2 | 3 | 3 | 3 | 5 |
| **Total ponderado** | **4.10** | **2.95** | **2.85** | **2.65** | **2.85** | **2.25** |

La puntuación refleja el **segmento objetivo** (aficionado hispanohablante en el celular), no la calidad general.
En "notación profesional" MuseScore ganaría con claridad.

---

## 6. Huecos de mercado y propuesta de valor de Atril

### 6.1 Huecos detectados

| Hueco | Evidencia | Cómo lo cubre Atril |
|---|---|---|
| G1. "Quiero la parte de **mi** instrumento" sin saber transportar | Los editores lo permiten pero esconden la opción | Instrumento como primer dato; vista escrita por defecto |
| G2. "Tengo un audio y quiero la partitura" | Moises da acordes y pistas, no la partitura de la melodía (según lo investigado) | De oído: voz sola, mezcla y partes, todo local |
| G3. Escribir rápido en el celular | Editores pensados para escritorio | Dock inferior con piano, diapasón y Do-Re-Mi; un toque = una nota |
| G4. Sin muros de pago para lo básico | Exportar y descargar suele ser de pago | MVP gratis, incluido PDF y MusicXML |
| G5. Privacidad del audio | Moises y otros procesan en la nube | Procesamiento local; el audio nunca sale del teléfono |
| G7. Sin registro | Todos los competidores piden cuenta para guardar | Sin login: se abre y se usa (decisión 2026-10-18) |
| G6. Solfeo latino y tono cercano | Traducciones genéricas | Español como idioma de diseño |

### 6.2 Propuesta de valor

> **Atril: escribe, escucha y saca de oído la melodía para tu instrumento, desde el celular y en español. Gratis.**

### 6.3 Posicionamiento frente a cada competidor

| Frente a | Mensaje |
|---|---|
| MuseScore | "Para la idea rápida en el celular; cuando quieras más, ábrela en MuseScore" |
| Flat / Noteflight | "Sin cuenta ni menús: elige tu instrumento y toca" |
| Soundslice | "No necesitas que alguien la haya transcrito: sácala tú del audio" |
| Moises | "Además de los acordes, te da la melodía escrita para tu instrumento, sin subir tu audio" |

### 6.4 Lo que Atril **no** será (para proteger el foco)

- Un editor profesional de orquesta.
- Una tienda de partituras.
- Una plataforma de cursos.
- Un separador de pistas de calidad de estudio.

---

## 7. User personas

### 7.1 Persona 1 — Marco, saxofonista de banda de pueblo

| Campo | Detalle |
|---|---|
| Edad | 34 |
| Ubicación | Oaxaca, México |
| Instrumento | Saxofón alto en Mi♭ |
| Lectura musical | Básica; aprendió de oído en la banda |
| Dispositivo | Android de gama media, datos móviles |
| Contexto | La banda toca en fiestas; el director pasa melodías por WhatsApp como audios o como partituras para piano |
| Objetivo | Tener la melodía escrita **para saxofón alto** antes del ensayo |
| Frustración | Las partituras que recibe están en Do (para piano) y transportarlas a mano le toma mucho y se equivoca |
| Cita | "Me mandan la partitura en Do y yo tengo que andar sacando cuentas de cuántos tonos subir." |
| Uso de Atril | Importa el PDF... ❌ (no hay OMR); importa MusicXML si se lo pasan, o canta la melodía en una nota de voz → De oído → instrumento Saxofón alto → exporta PDF |

**Implicación:** necesita "De oído (voz sola)" fiable, la vista escrita para Mi♭ y PDF. El OMR (foto de partitura)
le serviría mucho → registrar como idea post-MVP de alto valor.

### 7.2 Persona 2 — Lucía, estudiante de violín

| Campo | Detalle |
|---|---|
| Edad | 16 |
| Ubicación | Bogotá, Colombia |
| Instrumento | Violín (no transpositor) |
| Lectura musical | Media; estudia en una escuela de música |
| Dispositivo | iPhone heredado, Wi-Fi en casa |
| Objetivo | Escribir ejercicios y melodías que escucha para practicarlos |
| Frustración | Los editores en el celular son difíciles; en la escuela usan computadora |
| Cita | "Quiero anotar rápido una melodía antes de que se me olvide." |
| Uso de Atril | Escribe con Do-Re-Mi o piano, reproduce para comprobar, guarda en "Mis partituras" |

**Implicación:** editor rápido, aviso de notas fuera de rango del violín. Para pasar partituras entre su iPhone y la
computadora de la escuela usa el **archivo de respaldo** o exporta el ZIP para MuseScore (sin login, R3).

### 7.3 Persona 3 — Don Ernesto, guitarrista aficionado

| Campo | Detalle |
|---|---|
| Edad | 58 |
| Ubicación | Santiago, Chile |
| Instrumento | Guitarra |
| Lectura musical | Ninguna en pentagrama; lee tablatura y acordes |
| Dispositivo | Tablet Android |
| Objetivo | Sacar la melodía y los acordes de canciones que le gustan |
| Frustración | Las apps en inglés y los planes de pago |
| Cita | "Yo toco por acordes; si me pone la tablatura de la melodía, ya está." |
| Uso de Atril | De oído (partes) → acordes encima + tablatura → escucha a 70 % de velocidad |

**Implicación:** tablatura y acordes visibles; textos simples; botones grandes; la velocidad lenta es clave.

### 7.4 Persona 4 — Profesora Ana, maestra de música en primaria

| Campo | Detalle |
|---|---|
| Edad | 41 |
| Ubicación | Lima, Perú |
| Instrumento | Piano y flauta dulce |
| Lectura musical | Avanzada |
| Dispositivo | Laptop en la escuela, celular en casa |
| Objetivo | Preparar melodías sencillas para que los niños las toquen con flauta |
| Frustración | Flat y Noteflight piden licencias escolares; MuseScore requiere instalar |
| Cita | "Necesito sacar una hoja con la melodía y los nombres de las notas para los niños." |
| Uso de Atril | Escribe con el teclado de la laptop, activa "Nombres de notas", exporta PDF |

**Implicación:** nombres de notas bajo cada nota, PDF limpio, atajos de teclado. Las funciones de aula (tareas,
alumnos) quedan fuera del MVP pero son un segmento futuro.

> Nota: la flauta dulce (soprano en Do, suena una octava arriba) no está en el catálogo de 18 instrumentos. Se
> registra como candidata para agregar (barato: es una fila del catálogo).

### 7.5 Anti-persona — Compositor profesional

Escribe partituras orquestales con varias voces y dinámicas. Atril no es para él; debe usar MuseScore, Dorico o
Sibelius. Atril no debe agregar funciones solo para este perfil.

### 7.6 Resumen de necesidades por persona

| Necesidad | Marco | Lucía | Ernesto | Ana |
|---|---|---|---|---|
| Transposición automática | ●●● | ● | ● | ●● |
| De oído (voz sola) | ●●● | ●● | ● | ● |
| De oído (canción completa, acordes) | ● | ● | ●●● | ● |
| Escribir rápido en el celular | ●● | ●●● | ● | ● |
| Teclado de computadora | ● | ●● | ● | ●●● |
| Tablatura | — | — | ●●● | — |
| Nombres de notas | ●● | ● | ●● | ●●● |
| PDF | ●●● | ●● | ● | ●●● |
| Pasar partituras entre dispositivos (respaldo) | ● | ●●● | ● | ●● |
| Velocidad lenta / bucle | ●● | ●● | ●●● | ● |

---

## 8. Journey maps

### 8.1 Marco: de un audio de WhatsApp a la parte de saxofón

| Etapa | Acción | Pensamiento | Emoción | Oportunidad |
|---|---|---|---|---|
| 1. Recibe | El director manda un audio cantando la melodía | "Otra vez a sacarla de oído" | 😐 | — |
| 2. Abre Atril | Desde el navegador del celular | "¿Tengo que registrarme?" | 😟 | Sin cuenta (R3) |
| 3. Elige instrumento | Saxofón alto | "Ojalá lo tenga" | 🙂 | Instrumento visible arriba |
| 4. De oído | Sube el audio, "Escribir la melodía sola" | "¿Funcionará con mi teléfono?" | 😬 | Progreso claro; análisis en Worker |
| 5. Revisa | Reproduce y compara con el audio | "Esta nota está mal" | 😐 | Seleccionar nota y corregir con un toque |
| 6. Corrige | Ajusta 3 notas | "Ya quedó" | 😀 | Deshacer fiable |
| 7. Exporta | PDF → lo comparte por WhatsApp a la sección de saxos | "Se los paso a todos" | 😀 | PDF con nombre "título - Saxofón alto en Mib" |

**Momento crítico:** etapa 4. Si el análisis tarda o congela el teléfono, Marco abandona → justificación del
Worker y del objetivo ≤ 6 s por 60 s de audio.

### 8.2 Lucía: anotar una melodía antes de olvidarla

| Etapa | Acción | Emoción | Oportunidad |
|---|---|---|---|
| 1. Escucha una melodía | — | 🙂 | — |
| 2. Abre Atril | Recupera el borrador de ayer | 😐 | "Nueva" visible; el borrador no se pierde |
| 3. Escribe | Do-Re-Mi, corchea, puntillo | 🙂 | Duración actual siempre visible |
| 4. Se equivoca | Borra / deshace | 😟 → 🙂 | Deshacer y rehacer |
| 5. Se guarda sola | Ve "Guardada en este dispositivo" | 🙂 | Sin login ni botón Guardar |
| 6. En la escuela | Se manda la copia de respaldo por WhatsApp y la restaura en la computadora | 😐 | Respaldo en 2 toques + atajos de teclado |

### 8.3 Ernesto: melodía y acordes de una canción

| Etapa | Acción | Emoción | Oportunidad |
|---|---|---|---|
| 1. Tiene el MP3 | — | 🙂 | — |
| 2. De oído → "separar melodía, bajo y acordes" | Espera la primera carga del modelo | 😬 | Mensaje "la primera vez tarda unos segundos" |
| 3. Ve partes | Abre "Melodía" con acordes arriba | 🙂 | — |
| 4. Activa Tablatura | Instrumento Guitarra | 😀 | Tablatura legible |
| 5. Practica | Audio al 70 % en bucle | 😀 | (Should) resaltar la nota que suena en el audio original |

---

## 9. User stories

Formato: *Como [persona], quiero [acción], para [beneficio].* Cada historia tiene criterios de aceptación (CA) y
se vincula a una feature de `technical-decisions.md` (F01-F15) y a una prioridad MoSCoW.

### 9.1 Épica E1 — Escribir (F01, F10, F15)

**US-W01** — Como Lucía, quiero tocar una tecla del piano en pantalla y que aparezca la nota en la partitura, para
escribir sin saber de notación.
- CA1: Al tocar, suena la nota en ≤ 30 ms y aparece en la partitura con la duración actual.
- CA2: Funciona con el dedo en iPhone y Android sin zoom accidental ni menú contextual.
- CA3: El piano se desplaza horizontalmente y arranca centrado en Do4.
- Prioridad: **Must** · F01

**US-W02** — Como Lucía, quiero escribir con botones Do-Re-Mi, para no tener que buscar la tecla.
- CA1: Respeta la armadura de la tonalidad elegida.
- CA2: Elige la octava más cercana a la nota anterior; 8↑ y 8↓ la corrigen.
- CA3: ♭, ♮ y ♯ aplican solo a la próxima nota.
- Prioridad: **Must** · F01

**US-W03** — Como Ernesto, quiero escribir tocando el diapasón de la guitarra, para usar lo que ya sé.
- CA1: El diapasón usa la afinación del instrumento elegido (guitarra, bajo, ukulele, cuerdas frotadas).
- CA2: Muestra el nombre de la nota en cada posición.
- Prioridad: **Must** · F01

**US-W04** — Como Ana, quiero escribir con el teclado de la computadora, para ir rápido.
- CA1: Atajos de legacy: A W S E D F T G Y H U J K O L (notas), Z/X (octava), 1-5 (duración), `.` (puntillo),
  0/R (silencio), ⌫ (borrar), espacio (reproducir), flechas (navegar/octava), Esc (deseleccionar).
- CA2: Los atajos no se activan mientras se escribe en un campo de texto.
- CA3: Ctrl/Cmd+Z deshace y Ctrl/Cmd+Shift+Z rehace (nuevo).
- Prioridad: **Must** · F01, F10

**US-W05** — Como Lucía, quiero tocar una nota de la partitura para cambiarla, para corregir errores.
- CA1: La nota seleccionada se resalta y suena.
- CA2: La siguiente tecla reemplaza su tono y la selección avanza.
- CA3: Cambiar la duración con la selección activa cambia esa nota.
- Prioridad: **Must** · F01

**US-W06** — Como Lucía, quiero deshacer y rehacer cualquier cambio, incluidos tonalidad, tempo y compás, para
experimentar sin miedo.
- CA1: Hasta 200 pasos.
- CA2: Escribir el título no genera un paso por letra.
- Prioridad: **Must** · F10

**US-W07** — Como Marco, quiero subir o bajar toda la pieza medio tono u octava, para adaptarla a mi registro.
- CA1: Medio tono cambia también la tonalidad con la ortografía más simple.
- CA2: Si alguna nota queda en el límite del rango, se avisa cuántas, con "Deshacer".
- Prioridad: **Must** · F15

**US-W08** — Como Lucía, quiero añadir silencios y puntillos, para escribir el ritmo correcto.
- Prioridad: **Must** · F01

**US-W09** — Como Lucía, quiero empezar una partitura nueva sin perder la actual por accidente.
- CA1: "Nueva" pide confirmación con un segundo toque (como legacy).
- CA2: La actual ya quedó guardada sola en el dispositivo.
- Prioridad: **Must** · F01, F09

### 9.2 Épica E2 — Instrumento y vista (F02, F03)

**US-I01** — Como Marco, quiero elegir "Saxofón alto en Mi♭" y ver la parte escrita para mi instrumento.
- CA1: Armadura y notas transportadas (+9 semitonos).
- CA2: El estado muestra "Tonalidad escrita: X mayor".
- Prioridad: **Must** · F02

**US-I02** — Como Ana, quiero alternar entre "Para el instrumento" y "Sonido real", para comparar con el piano.
- CA1: El interruptor solo se habilita en instrumentos transpositores.
- Prioridad: **Must** · F03

**US-I03** — Como Lucía, quiero ver qué notas están fuera del rango del violín, para no escribir algo imposible.
- CA1: Notas fuera de rango en otro color + texto con el rango (p. ej. "Sol3–Mi7").
- Prioridad: **Must** · F02

**US-I04** — Como Ernesto, quiero ver la tablatura debajo del pentagrama.
- CA1: Disponible para guitarra y bajo.
- Prioridad: **Must** · F02

**US-I05** — Como Ana, quiero ver el nombre de cada nota (Do, Re, Mi) debajo, para los niños.
- Prioridad: **Must** · F03

**US-I06** — Como Ana, quiero el instrumento "Flauta dulce soprano".
- CA1: Escrita en Do, suena una octava arriba; rango Do5–Re7 sonando.
- Prioridad: **Should** · F02 (nueva fila del catálogo)

### 9.3 Épica E3 — Escuchar (F04)

**US-P01** — Como Lucía, quiero reproducir la partitura y ver qué nota suena.
- CA1: Resalta la nota en curso.
- CA2: Si hay una nota seleccionada, empieza desde ahí.
- CA3: El sonido imita la familia del instrumento.
- Prioridad: **Must** · F04

**US-P02** — Como Marco, quiero que suene aunque mi iPhone esté en silencio.
- Prioridad: **Must** · F04

**US-P03** — Como Lucía, quiero cambiar el tempo para practicar más lento.
- CA1: 30-240 negras por minuto.
- Prioridad: **Must** · F04

### 9.4 Épica E4 — Abrir y exportar (F05, F06, F12, F13)

**US-F01** — Como Ana, quiero abrir un archivo MusicXML o MIDI que me pasaron, para editarlo.
- CA1: Se toma la melodía principal; si había acordes o varias voces, se avisa.
- CA2: Las anacrusas no desplazan las barras de compás.
- CA3: Si había cambios de tempo o compás, se avisa que se usó el primero.
- Prioridad: **Must** · F05

**US-F02** — Como Ana, quiero pegar texto ABC de abcnotation.com.
- Prioridad: **Must** · F05

**US-F03** — Como Marco, quiero descargar un PDF con el nombre del instrumento en el archivo.
- CA1: Nombre "Título - Saxofón alto en Mib.pdf".
- CA2: Tamaño carta, márgenes, cortes de página entre sistemas.
- Prioridad: **Must** · F06

**US-F04** — Como Ana, quiero descargar los archivos para MuseScore.
- CA1: ZIP con MusicXML (escrito + `<transpose>`), MIDI (sonido real), ABC y LEEME.
- CA2: MuseScore 4 abre el MusicXML sin advertencias.
- Prioridad: **Must** · F06

**US-F05** — Como Lucía, quiero una imagen de la partitura para mandarla por WhatsApp.
- Prioridad: **Must** · F06

**US-F06** — Como Ernesto, quiero enlaces a sitios donde encontrar partituras.
- Prioridad: **Should** · F13

**US-F07** — Como Lucía, quiero ejemplos para probar la app.
- CA1: Incluir al menos un tema tradicional latinoamericano de dominio público además de los 3 de legacy.
- Prioridad: **Should** · F12

### 9.5 Épica E5 — De oído (F07, F08)

**US-E01** — Como Marco, quiero subir una nota de voz cantando y obtener la melodía escrita.
- CA1: ≥ 90 % de notas correctas en los audios de prueba de una sola voz afinada.
- CA2: Tempo y tonalidad estimados; se pueden corregir.
- CA3: 60 s de audio analizados en ≤ 6 s en iPhone 12, sin congelar la pantalla.
- Prioridad: **Must** · F07

**US-E02** — Como Ernesto, quiero subir una canción completa y obtener melodía, bajo y acordes.
- CA1: Se ofrecen las partes encontradas con su rango.
- CA2: Acordes encima de la partitura (opcional).
- CA3: El texto dice el límite real de duración (90 s).
- Prioridad: **Must** · F07

**US-E03** — Como Ernesto, quiero ralentizar el audio sin que cambie el tono.
- Prioridad: **Must** · F08

**US-E04** — Como Ernesto, quiero repetir un pedazo arrastrando sobre la onda.
- Prioridad: **Must** · F08

**US-E05** — Como Marco, quiero reajustar el ritmo si el tempo detectado quedó mal.
- CA1: Cambiar el tempo y "Reajustar ritmo" re-cuantiza sin volver a analizar.
- Prioridad: **Must** · F07

**US-E06** — Como Marco, quiero cancelar un análisis que tarda demasiado.
- Prioridad: **Must** · F07 (nuevo respecto a legacy)

**US-E07** — Como Ernesto, quiero que mi audio no se suba a ningún servidor.
- CA1: Sin F14 activado, ninguna petición de red contiene el audio (test E2E con intercepción de red).
- Prioridad: **Must** · F07

**US-E08** — Como Marco, quiero guardar el audio junto a la partitura para revisarlo después.
- Prioridad: **Could** · F14

**US-E09** — Como Ernesto, quiero que al reproducir el audio original se resalte la nota correspondiente en la
partitura, para seguirla.
- CA1: Solo para partituras creadas con De oído en la sesión actual (se conservan los tiempos `RawNote`).
- CA2: Resaltado con la misma clase que la reproducción.
- Prioridad: **Should** · F08 (nueva; inspirada en Soundslice)

### 9.6 Épica E6 — Mis partituras, sin login (F09, F11)

**US-L01** — Como Lucía, quiero que la app recuerde lo que estaba escribiendo aunque cierre el navegador, sin
crear cuenta.
- Prioridad: **Must** · F11

**US-L02** — Como Lucía, quiero usar Atril sin registrarme ni iniciar sesión nunca.
- CA1: No existe ninguna pantalla de login, cuenta ni correo (R3).
- Prioridad: **Must** · F09

**US-L03** — Como Lucía, quiero ver mis partituras guardadas en este dispositivo y abrirlas.
- CA1: Lista con título, instrumento y fecha, la más reciente arriba.
- Prioridad: **Must** · F09

**US-L04** — Como Lucía, quiero que mis cambios se guarden solos, sin botón "Guardar".
- CA1: Guardado automático 800 ms después de cada cambio; indicador "Guardada en este dispositivo".
- CA2: Un ejemplo sin tocar no aparece en "Mis partituras".
- Prioridad: **Must** · F09

**US-L05** — Como Lucía, quiero pasar mis partituras a otro dispositivo sin cuenta.
- CA1: "Hacer copia de respaldo" genera un archivo que puedo descargar o compartir (WhatsApp, Drive).
- CA2: "Restaurar copia" en el otro dispositivo agrega las nuevas y actualiza las más recientes, sin borrar nada.
- CA3: Recordatorio si no hice copia en 14 días.
- Prioridad: **Must** · F09

**US-L06** — Como Lucía, quiero recuperar una partitura que borré por error.
- CA1: Papelera de 30 días.
- Prioridad: **Should** · F09

**US-L07** — Como Lucía, quiero duplicar una partitura para hacer otra versión.
- Prioridad: **Should** · F09

**US-L08** — Como Lucía, quiero compartir un enlace de solo lectura.
- Prioridad: **Won't (MVP)** — sin servidor no hay dónde alojar la partitura; alternativa: compartir PDF/imagen (F17)

### 9.7 Resumen de historias

| Épica | Must | Should | Could | Won't | Total |
|---|---|---|---|---|---|
| E1 Escribir | 9 | 0 | 0 | 0 | 9 |
| E2 Instrumento y vista | 5 | 1 | 0 | 0 | 6 |
| E3 Escuchar | 3 | 0 | 0 | 0 | 3 |
| E4 Abrir y exportar | 5 | 2 | 0 | 0 | 7 |
| E5 De oído | 7 | 1 | 1 | 0 | 9 |
| E6 Mis partituras, sin login | 5 | 2 | 0 | 1 | 8 |
| **Total** | **34** | **6** | **1** | **1** | **42** |

---

## 10. Priorización de features

### 10.1 MoSCoW (MVP)

| Prioridad | Features |
|---|---|
| **Must** | F01 Editor · F02 Instrumentos · F03 Vistas · F04 Reproducción · F05 Importar · F06 Exportar · F07 De oído · F08 Reproductor de audio · F09 Mis partituras en el dispositivo + respaldo · F10 Deshacer/rehacer · F11 Borrador local · F15 Aviso de recorte |
| **Should** | F12 Ejemplos (+1 latino) · F13 Enlaces · US-I06 Flauta dulce · US-E09 Partitura sigue al audio · US-L06 Papelera · US-L07 Duplicar |
| **Could** | F14 Guardar audio |
| **Won't (MVP)** | Compartir por enlace · Polifonía · Letra · OMR (foto → partitura) · Cambio de tono del audio · Funciones de aula · "Pedir melodía a Claude" (R1) |

### 10.2 RICE de los candidatos nuevos y post-MVP

Escala: Alcance = usuarios afectados por trimestre (estimado sobre 1 000 usuarios); Impacto 0.25-3; Confianza
%; Esfuerzo en semanas-persona.

| Candidato | Alcance | Impacto | Confianza | Esfuerzo | RICE | Decisión |
|---|---|---|---|---|---|---|
| Partitura sigue al audio (US-E09) | 300 | 1 | 80 % | 0.5 | 480 | Should en MVP |
| Flauta dulce (US-I06) | 150 | 1 | 90 % | 0.1 | 1 350 | Should en MVP |
| Ejemplo latino (F12) | 500 | 0.5 | 90 % | 0.1 | 2 250 | Should en MVP |
| Compartir por enlace (en la URL, sin servidor) | 400 | 2 | 70 % | 1 | 560 | Primera mejora post-MVP |
| OMR (foto de partitura → notas) | 500 | 3 | 30 % | 6 | 75 | Investigación post-MVP |
| Cambiar tono del audio | 200 | 1 | 70 % | 1 | 140 | Post-MVP |
| Grabar con el micrófono (sin subir archivo) | 400 | 1 | 80 % | 0.5 | 640 | Primera mejora post-MVP (requiere quitar `microphone=()` de la política) |
| Polifonía básica (2 voces) | 300 | 2 | 50 % | 6 | 50 | Post-MVP lejano |
| Letra | 200 | 1 | 70 % | 2 | 70 | Post-MVP |
| Funciones de aula | 100 | 2 | 40 % | 8 | 10 | No planeado |

### 10.3 Cambios propuestos al alcance del MVP

| Cambio | Tipo | Efecto en plan |
|---|---|---|
| Agregar US-E09 como Should | Nuevo | +0.5 semana en el buffer |
| Agregar flauta dulce al catálogo | Nuevo | Despreciable |
| Agregar 1 ejemplo latino de dominio público | Nuevo | Despreciable |
| Grabar con micrófono | Candidato fuerte post-MVP | Ninguno en MVP |

> **Aprobados por el usuario el 2026-10-18** junto con el botón Compartir (F17). Reflejados en `technical-decisions.md` sección 3 (F02, F12, F16, F17).

---

## 11. Implicaciones para specs y arquitectura

### 11.1 Para las specs de módulos

| Spec | Requisito derivado del análisis |
|---|---|
| `editor` | Superficies de entrada con objetivos de toque ≥ 40 px (legacy usa 36 px en teclas blancas: revisar); duración actual siempre visible; Ctrl/Cmd+Z/Shift+Z |
| `notation-core` | Agregar `flautadulce` al catálogo si se aprueba; nombres de archivo con el instrumento (US-F03) |
| `formats` | Test de apertura en MuseScore 4 como criterio de aceptación (US-F04) |
| `ear` | Conservar `RawNote` y origen para US-E09; cancelación (US-E06); test de no-red (US-E07); mensajes de límite unificados |
| `library` | Indicador de sincronización con 3 estados visibles (US-L04); papelera y duplicar (Should) |
| `playback` | Sin cambios respecto a la arquitectura |

### 11.2 Para la arquitectura (post-MVP, no aplicar aún)

- **Compartir por enlace sin servidor:** la partitura se codifica en el fragmento de la URL
  (`https://…/#p=<partitura comprimida con fflate en base64url>`). El fragmento no se envía al servidor, así que
  sigue sin haber backend ni login. Una melodía típica (200 notas) ocupa ~1-2 KB. Al abrir el enlace se ofrece
  "Guardar en mis partituras". Límite práctico de longitud de URL en apps de mensajería por verificar.
- **Micrófono:** `MediaRecorder` → `decodeAudioData`; cambiar `Permissions-Policy` a `microphone=(self)`.

### 11.3 Tareas de investigación pendientes

- [ ] Prueba de 30 min por competidor en un celular Android y un iPhone (escribir 8 compases, transportar, exportar).
- [ ] Verificar precios actuales en los sitios oficiales de MuseScore, Flat, Soundslice y Moises.
- [ ] Verificar si Moises o Soundslice ofrecen "audio → partitura de la melodía" (afecta H2 y RC1).

---

## 12. Riesgos competitivos

| ID | Riesgo | Probabilidad | Impacto | Respuesta |
|---|---|---|---|---|
| RC1 | Moises agrega "melodía en partitura para tu instrumento" | Media | Alto | Diferenciarse en edición, transposición, privacidad local y precio; mover rápido |
| RC2 | MuseScore mejora mucho la edición en su app móvil | Media | Medio | Mantener simplicidad y De oído; MuseScore como complemento vía exportación |
| RC3 | Calidad de De oído (mezcla/partes) decepciona frente a Moises | Alta | Medio | Comunicarlo como "borrador"; invertir primero en voz sola, que es más fiable |
| RC4 | Herramientas de IA generalistas transcriben melodías desde audio | Media | Medio | Valor en el flujo completo (editar, transportar, exportar) más que en la transcripción |
| RC5 | Usuarios esperan un catálogo de canciones populares | Alta | Bajo | Enlaces a sitios con licencia; nunca alojar partituras protegidas |

---

## 13. Fuentes

Consultadas el 2026-10-18. Los precios de terceros pueden estar desactualizados.

- MuseScore — listados de la app y precios de compras dentro de la app:
  [App Store (EG)](https://apps.apple.com/EG/app/id835731296),
  [AppPricingLab](https://www.apppricinglab.com/iap/apple/835731296)
- MuseSounds Pro: [KVR Audio](https://www.kvraudio.com/news/muse-group-launches-musesounds-pro-notation-focused-sound-subscription-65943)
- Reseñas de musescore.com: [Trustpilot](https://uk.trustpilot.com/review/musescore.com?page=10)
- Flat for Education, planes: [help.flat.io](https://help.flat.io/en/education/plan/)
- Flat, precios de terceros: [SoftwareSuggest](https://www.softwaresuggest.com/flat/pricing),
  [Subscribed.fyi](https://subscribed.fyi/?p=189549)
- Flat, reseña académica (precios antiguos):
  [Symposium (College Music Society)](https://symposium.music.org/volume-60-no-2/technology-and-online-resource-reviews-1752877062/flat-online-collaborative-music-notation-software)
- Noteflight Premium: [noteflight.com/premium](https://current.production.noteflight.com/premium)
- Noteflight Learn: [noteflight.com/learn](https://current.production.noteflight.com/learn),
  [blog de Noteflight](https://notes.noteflight.com/?p=2909)
- Soundslice Plus anual: [blog de Soundslice](https://www.soundslice.com/blog/225/yearly-plus-plan-now-available)
- Soundslice, precio mínimo de cursos: [ayuda de Soundslice](https://www.soundslice.com/help/en/store-selling/money/148/pricing-tips/)
- Soundslice for Teachers: [SBO Magazine](https://sbomagazine.com/soundslice-for-teachers/)
- Moises: [App Store](https://apps.apple.com/app/id1515796612),
  [App Store México](https://apps.apple.com/MX/app/id1515796612),
  [RouteNote](https://create.routenote.com/blog/?p=17345),
  [StemSplit (reseña de un competidor)](https://stemsplit.io/blog/moises-ai-review)

---

**Creado:** 2026-10-18
**Generado por:** Oden Forge — Domain Expert
