# Revisión de Flat para Atril

Fecha: 2026-10-25. Objetivo: identificar mejoras concretas para el editor de Atril, preservando funcionamiento local, ausencia de cuentas/backend, servicios gratuitos y la petición de aprovechar todo el ancho del monitor.

## Alcance y evidencia

Esta revisión usa páginas públicas oficiales de Flat y lectura del código local de Atril. No es una captura de ejecución de Flat ni una inspección de sus paquetes. No se inició sesión, no se usaron funciones de pago, no se copiaron sus recursos ni se alteró el navegador activo del usuario.

Se consultó la skill REA `reverse-engineer-anything` y su guía `references/runtime-observation.md`. El diagnóstico existente `/tmp/atril-rea-yue2-doctor.json` identifica CLI 6.5.0, `config_drift`/registro ausente para Codex; no hay herramientas MCP de REA conectadas a esta sesión. No se repitió el diagnóstico ni se modificó configuración. Por tanto **no hay Evidence IDs ni observación REA de Flat que citar**. Una futura comprobación de interacción necesitaría herramientas REA disponibles y un navegador de prueba con CDP, independiente del navegador que está usando el usuario.

Las afirmaciones sobre Flat son documentación del proveedor; las prioridades y soluciones propuestas para Atril son decisiones de diseño, no funciones observadas en ejecución.

## Qué documenta Flat y qué conviene adaptar

| Evidencia oficial de Flat | Situación de Atril leída en código | Propuesta para Atril y prioridad |
|---|---|---|
| Selección de intervalos con ratón, Mayús+flechas y anclas táctiles. [Selección de rango](https://help.flat.io/es/music-notation-software/range-selection/) | `score.store.ts` guarda una selección individual. El editor visual permite mover/reordenar eventos y editar duración en un borrador. | **P1: selección de varias notas**. Primero seleccionar inicio/fin, duplicar, borrar y transponer el fragmento. Una operación debe ser un paso de deshacer; no interferir con el arrastre de una nota. |
| Número máximo de compases por sistema y separación de notas ajustables. [Compases y espaciado](https://help.flat.io/es/music-notation-software/layout-measures/) | `render-options.ts` ya adapta automáticamente la densidad al ancho: 2–12 compases preferidos; exportación separada a cuatro. | **P0: ajuste de lectura visible**: Automático / Compacto / Amplio, además de tamaño del pentagrama. Mantener todo el ancho de la ventana; no recuperar una columna central estrecha. El máximo por línea debe ceder si las notas no caben. |
| Tamaño del pentagrama y distancia entre sistemas configurables. [Pentagramas](https://help.flat.io/es/music-notation-software/layout-staves/) | Hoja SVG con ancho medido; no se encontró control de usuario de escala/espaciado en el recorrido revisado. | **P1: vista de práctica** con notas grandes y barra de herramientas discreta. Separar preferencia de lectura y maquetación de PDF, para que ampliar en pantalla no altere el archivo exportado. |
| Conservación de cambios y edición/reapertura sin red mediante PWA; sincronización posterior con su cuenta. [Modo sin conexión](https://help.flat.io/es/music-notation-software/offline/) | Biblioteca IndexedDB, guardado y respaldo ya locales. No se encontró registro de service worker en la búsqueda acotada de `src/main.tsx`, `src/app` y `public`. El catálogo remoto necesita red. | **P1: apertura realmente sin conexión**: cachear la aplicación y los recursos ya descargados, señalar qué partituras están disponibles y probar recarga con red desactivada. Atril no debe prometer sincronización entre dispositivos: conserva respaldo por archivo. |
| Instrumentos basados en grabaciones y varias intensidades. [Instrumentos HQ](https://flat.io/es/instruments) | `playback/engine/synth-*` genera timbres localmente con Web Audio; no usa esos instrumentos de Flat. | **P2: mejora de escucha**. Antes de bancos grandes, volumen y metrónomo locales. Después, muestras pequeñas con licencia redistribuible, carga opcional y caché. Medir memoria/latencia móvil; no descargar ni reutilizar sonidos de Flat. |
| Edición colaborativa, historial, importación/exportación y diversas formas de introducción. [Producto](https://flat.io/es/product-overview), [capacidades](https://help.flat.io/es/music-notation-software/capabilities/) | Deshacer/rehacer, piano, diapasón, Do-Re-Mi, importadores y exportadores ya existen. Se incorporaron editor visual y navegación por compases en esta etapa. | **P2: versiones locales recuperables**. Crear versiones con nombre antes de una edición importante y restaurarlas desde la biblioteca, con límite de almacenamiento y respaldo. Evitar duplicar herramientas que ya funcionan. |

## Orden de trabajo recomendado

1. Cerrar la interacción del editor visual actual: selección clara, arrastre horizontal/vertical distinguible, duración editable sin desplazar por accidente otras notas, escucha del borrador y aplicar/cancelar con deshacer. Revisar ratón y teclado; no anunciarlo como probado por analizar la documentación de Flat.
2. Añadir los controles de lectura/densidad y una acción de enfocar el compás seleccionado. Aprovechar `ScoreNavigator` existente para escuchar desde compás, selección o inicio, en vez de construir otro navegador paralelo.
3. Introducir selección de intervalos y operaciones sobre fragmentos. Definir antes qué pasa con notas ligadas que cruzan compases y con acordes cifrados; no confundir selección visual con polífonía o varias partes.
4. Completar una PWA local con actualización segura y pruebas reales de reapertura sin red. El texto «guardada en este dispositivo» ya informa de datos locales, pero no acredita que todos los archivos de la aplicación estén disponibles sin conexión.
5. Evaluar sonidos opcionales y versiones guardadas tras medir presupuesto de carga y espacio. Conservar siempre la síntesis disponible como alternativa local.

## Qué dejar fuera del alcance actual

- **Colaboración multiusuario y nube de Flat**: requerirían identidad, permisos, almacenamiento compartido y resolución de conflictos. Es una ampliación de arquitectura respecto a Atril sin backend; no aporta una solución inmediata a la edición local.
- **OMR desde PDF/foto**: la página anuncia esa capacidad, pero no acredita un motor local reutilizable ni su licencia. El flujo de foto de Atril prepara la imagen y sigue dependiendo de reconocimiento externo; no confundirlo con reconocimiento incorporado.
- **Sonidos, marca y editor de Flat**: la página de producto no concede permiso para copiar activos o incorporar su código. Adoptar patrones de uso mediante implementación propia y revisar por separado cualquier SDK o licencia que se quisiera introducir.
- **Catálogo universal por artista**: las páginas revisadas no acreditan una API gratuita, completa y descargable para ese propósito. El catálogo de music21 integrado en Atril mantiene su alcance clásico; no prometer que Flat resuelve esa carencia sin investigar una fuente concreta.

## Verificación pendiente

Este documento completa la revisión de capacidades y prioridades, no una auditoría de ejecución. Quedan pendientes una sesión de Flat en navegador de prueba si se habilita REA, comparación de gestos reales, y validación de Atril en Chromium/WebKit/dispositivos físicos. No se implementaron funciones a partir de esta revisión ni se cambiaron archivos existentes.
