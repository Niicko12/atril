# YuE2-Studio: ideas aplicables a Atril

Fecha: 2026-10-25. Objetivo: revisar el proyecto solicitado y mejorar la adaptación de Atril a distintos dispositivos.

## Alcance y evidencia

Revisión de archivos públicos de `timoncool/YuE2-Studio`, rama `main`, consultados por web. No se ejecutó YuE2-Studio ni se descargaron modelos. Los archivos consultados pueden cambiar después de esta revisión.

REA 6.5.0 está disponible por CLI. Su diagnóstico marca `config_drift` en la integración Codex y no hay herramientas MCP conectadas. La terminal no pudo resolver github.com al consultar el repositorio. Se retiene el [diagnóstico acotado](evidence/yue2-rea-diagnostic.json). **No hay Evidence de un análisis REA del repositorio ni de su binario**. La guía REA además distingue el análisis ordinario de fuentes del análisis de artefactos/runtime; las conclusiones siguientes proceden de archivos públicos, no de decompilación.

## Hallazgos comprobados y decisiones para Atril

| Evidencia primaria | Observación | Aplicación propuesta |
|---|---|---|
| [Configuración Tauri](https://github.com/timoncool/YuE2-Studio/blob/main/desktop/src-tauri/tauri.conf.json) | Ventana inicial 1440×960, mínimo 1024×720; contenedor nativo. | Atril debe seguir funcionando desde 320 px, sin heredar esos mínimos. La adaptabilidad de la interfaz web no acredita soporte nativo móvil. |
| [App.tsx](https://github.com/timoncool/YuE2-Studio/blob/main/app/App.tsx) | Paneles laterales limitados respecto del ancho disponible; control con mouse y teclado; estado distinto para móvil y detalles. | Mantener un área musical amplia. En pantallas pequeñas mostrar herramientas en diálogos desplazables; en grandes valorar paneles ajustables. No añadir paneles persistentes que reduzcan el pentagrama en móvil. |
| [Estilos](https://github.com/timoncool/YuE2-Studio/blob/main/app/src-styles.css) | Breakpoint a 768 px, áreas seguras y utilidades para gestos y desplazamiento. | Aplicar áreas seguras, alturas dinámicas, desplazamiento contenido y controles táctiles a los componentes de Atril. Adaptar también alturas cortas y orientación horizontal. |
| [CreatePanel.tsx](https://github.com/timoncool/YuE2-Studio/blob/main/app/components/CreatePanel.tsx) | Conserva borradores y conecta la partitura con un editor MIDI. | Próxima mejora musical: piano roll de altura/tiempo con acción explícita Aplicar y posibilidad de cancelar; conservar notas originales hasta aplicar. El guardado actual de Atril ya cubre persistencia de partituras. |
| [Notas de versiones](https://github.com/timoncool/YuE2-Studio/releases) | Documenta navegación temporal con cursor, pausa y selección de notas. | Valorar reproducción desde una nota seleccionada y posición temporal visible. Atril ya resalta notas durante reproducción: evitar duplicar esa función. |
| [Dependencias](https://github.com/timoncool/YuE2-Studio/blob/main/app/package.json) | Comparte React, abcjs y herramientas de exportación con Atril; también incluye integraciones nativas y multimedia. | Las ideas de interacción encajan con nuestro stack. No incorporar el conjunto de dependencias ni un servicio Rust para conseguirlas. |
| [README](https://github.com/timoncool/YuE2-Studio) | Generación musical local con modelos grandes y GPU; Windows como destino principal, Linux experimental. | La generación de canciones y separación avanzada requieren un estudio aparte. No son una mejora portable inmediata para el navegador de un teléfono. |
| [Licencia](https://github.com/timoncool/YuE2-Studio/blob/main/LICENSE) | Código bajo MIT; los modelos y componentes externos tienen sus propias condiciones. | Si se adapta código, retener sus avisos y revisar cada dependencia. En esta pasada se implementan ajustes propios de Atril, sin copiar componentes del proyecto. |

## Prioridad

1. **Ahora:** evitar desbordamiento de formularios, resultados y diálogos; hacer accesibles los controles en 320–1440 px, orientación horizontal y pantallas con áreas seguras. Añadir escenarios de navegador que detecten desbordamiento y controles inaccesibles.
2. **Siguiente funcionalidad musical:** piano roll con edición por arrastre, cuantización visible y Aplicar/Cancelar; luego reproducción desde selección y secciones por compás. Requiere actualizar modelo/specs y verificar importación/exportación antes de implementarlo.
3. **Investigación separada:** inferencia generativa, voz, separación multicanal y motor nativo. No imponer GPU, descargas de varios GB ni servicios externos al flujo habitual de Atril.

## Límites de compatibilidad

El objetivo de Atril sigue siendo una aplicación web adaptable en navegadores modernos de Windows, macOS, Linux, Android e iOS. No se afirma compatibilidad universal con todos los dispositivos o navegadores antiguos. Una captura redimensionada tampoco verifica audio, rendimiento, Safari real, teclado virtual, tecnologías asistivas o instalación como aplicación. Esas comprobaciones requieren los dispositivos y motores correspondientes.

## Implementación posterior autorizada

Se incorporaron las mejoras locales de interfaz: área de trabajo y dock a todo el ancho del monitor, densidad automática de 2–12 compases por línea, navegación y escucha desde compás/selección/inicio y un editor visual monofónico con borrador Aplicar/Cancelar. El editor visual permite arrastrar altura/orden, redimensionar duración, editar mediante campos accesibles, escuchar y aplicar en un único paso deshacible. Se mantienen los formatos y metadatos existentes. Ver [spec del editor visual](modules/piano-roll-spec.md).

No se integraron motores generativos ni código nativo de YuE2-Studio. Las funcionalidades son una implementación propia sobre el modelo actual de Atril; la revisión no se convierte por ello en análisis REA.
