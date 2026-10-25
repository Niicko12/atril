# Editor visual de notas — piano roll

Autorizado 2026-10-25 como continuación de las mejoras identificadas en YuE2-Studio. Implementación propia, sin copiar código ni añadir dependencias.

- Acceso «Editor visual» desde Atril; diálogo adaptable, carga diferida, sin atajos globales mientras está abierto.
- Borrador independiente de las notas originales; no modifica metadatos, identidad, cifrados ni guardado hasta «Aplicar cambios». Cancelar, Escape o cerrar descarta el borrador. Reiniciar recupera las notas de apertura.
- Altura en sonido real (MIDI 0–127, incluidos los tonos importados), tiempo en semicorcheas enteras, duración 1–48. La cuadrícula muestra cuatro compases por página y permite zoom horizontal, desplazamiento y notas/silencios.
- Arrastrar verticalmente cambia altura por semitonos; horizontalmente reordena eventos consecutivos sin crear polifonía ni huecos implícitos. Arrastrar el extremo derecho cambia duración y desplaza los eventos posteriores. Rejilla de una semicorchea visible. Las pausas se escriben mediante silencios. Un gesto cancelado no se aplica.
- Alternativa accesible al arrastre: selector de evento, altura y duración numéricas, anterior/siguiente posición, añadir nota/silencio y borrar. Admite mouse, lápiz y toque; el fondo permite desplazamiento.
- Escuchar reproduce el borrador mediante el motor existente, sin alterar las notas originales ni sus resaltados. Editar, aplicar y cerrar detienen reproducción. Ningún audio se transmite.
- Aplicar valida la partitura y reemplaza notas en una sola acción deshacible con el historial existente. Una comprobación de id/revision evita sobrescribir una partitura cambiada desde la apertura; el guardado automático no invalida el borrador. Aplicar sin cambios no agrega historial.
- Sin nuevos formatos, esquema de IndexedDB, motores GPU ni servicios externos. ABC, MIDI y MusicXML siguen usando el modelo monofónico actual y sus límites.
- Verificación: pruebas de operaciones y límites; borrador sin efectos, cancelación, aplicar/deshacer, conflicto de versión, silencios/cifrados; detección de E2E de apertura y adaptación a móvil/escritorio. La ejecución de navegador depende de permisos del host.

## Revisión para reducir desplazamiento (2026-10-25)

La rejilla se ajusta por defecto al ancho y a las alturas utilizadas por las notas visibles. La última página solo dibuja los compases existentes; no agrega tres compases vacíos a una pieza de un compás. Las filas se ajustan al alto disponible y los gestos usan su tamaño real. Se conservan los zoom manuales para edición precisa.

En escritorio, los controles se agrupan en un inspector lateral, junto a la rejilla. La ayuda se pliega y Escuchar/Aplicar permanecen en un pie visible. En pantallas estrechas el inspector se sitúa debajo y los controles secundarios se pliegan para reducir altura. No cambiar la música ni perder el borrador al ajustar la distribución.
