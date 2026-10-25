# Atril

**Editor de partituras y herramienta de práctica musical para computadora, tableta y móvil.**

Atril permite escribir, escuchar, corregir y compartir partituras desde el navegador. Su interfaz se
adapta a pantallas táctiles, portátiles y monitores amplios, con controles de edición mediante ratón,
teclado o entrada táctil. El trabajo se guarda en el dispositivo, sin crear una cuenta.

[Aplicación web](https://atril-xi.vercel.app) · [Documentación](docs/README.md) · [Verificación](docs/guides/verificacion-local.md)

## Funciones

- **Edición musical:** notas, silencios, duraciones, compás, tempo, armadura, transposición y deshacer/rehacer.
- **Edición visual:** arrastrar notas en la partitura para cambiar altura y orden; editor de rejilla con
  ajuste de altura, posición y duración, borrador y confirmación de cambios.
- **Instrumentos y vistas:** pentagrama, tablatura según instrumento, nombres de notas y entradas
  mediante piano, diapasón y Do/Re/Mi.
- **Reproducción:** muestras de instrumentos FluidR3 cuando están disponibles y síntesis de respaldo
  con indicación del estado de sonido.
- **Modo práctica:** selección de un intervalo de compases, repetición, velocidades de 50 %, 75 % y
  100 %, metrónomo, un compás de cuenta de entrada y seguimiento opcional de la partitura. La
  velocidad de escucha no altera la tonalidad ni el tempo guardado.
- **Biblioteca:** partituras guardadas localmente, repertorio incluido y búsqueda por título o
  artista/compositor. La consulta remota ofrece el catálogo disponible en su fuente; no es un
  buscador universal de canciones.
- **Importación:** archivos MusicXML/MXL, MIDI y texto ABC.
- **Exportación:** PDF e imagen, además de copiar la melodía en texto ABC.
- **Compartir por WhatsApp:** preparación de PDF y menú de compartir del sistema cuando admite
  archivos. En otros navegadores, descarga del PDF y apertura de WhatsApp para adjuntarlo manualmente.
- **De oído:** herramientas de audio y transcripción local con Basic Pitch, con revisión del resultado.

## Adaptación a dispositivos

La aplicación usa el ancho disponible en monitores y reorganiza sus controles en pantallas pequeñas.
El piano y el diapasón conservan un tamaño de interacción útil; cuando no caben todas las notas o
trastes, permiten desplazamiento horizontal. Las ventanas y el editor visual se ajustan al espacio
visible de la pantalla.

La compatibilidad concreta de compartir archivos, micrófono y procesamiento de audio depende del
navegador y de sus permisos. Consulte la [guía de verificación](docs/guides/verificacion-local.md)
para las comprobaciones automatizadas y las pruebas manuales en dispositivos.

## Datos y privacidad

Las partituras se guardan en **IndexedDB del navegador y dispositivo utilizados**. No existe una cuenta
ni sincronización automática entre dispositivos. Exporte archivos o respaldos para trasladar su trabajo;
borrar los datos del navegador puede eliminar la biblioteca local.

La búsqueda remota y la descarga de muestras requieren conexión. El procesamiento de audio de la
aplicación se realiza localmente; no se envía a un servicio externo de IA.

## Estado y alcance

Atril está en desarrollo. El modelo actual de partitura es **monofónico**. La edición de múltiples
pistas simultáneas y controles de solo/silencio por pista no están implementados.

Se pueden cargar y preparar fotografías de partituras. **La conversión automática de partituras
manuscritas a notas editables sigue pendiente**; preparar una imagen no equivale a reconocer sus notas.
Los resultados de transcripción de audio deben revisarse antes de usarlos como partitura definitiva.

## Desarrollo local

Requisitos: Node.js 22.12 o superior y npm.

```sh
npm ci
npm run dev
```

Vite muestra la dirección local al arrancar. Para comprobar el proyecto:

```sh
npm run typecheck
npm run lint
npm run depcruise
npm run check:modules
npm test -- --maxWorkers=2
npm run build
```

Las pruebas de navegador se ejecutan con `npm run e2e` en un entorno con Playwright y sus navegadores
instalados. La prueba del modelo de transcripción se ejecuta por separado con `npm run test:model`.

## Arquitectura

React y TypeScript con Vite; abcjs para notación, Web Audio para sonido e IndexedDB para persistencia.
La transcripción usa TensorFlow.js y Basic Pitch en el dispositivo. No requiere un backend propio.

- `src/core/`: modelo y funciones musicales.
- `src/modules/`: edición, partitura, reproducción, práctica, biblioteca, importación y exportación.
- `src/infra/`: almacenamiento e integración con el navegador.
- `docs/`: decisiones técnicas, especificaciones y guías.
- `legacy/`: referencia histórica; no es la aplicación activa.

## Publicación y créditos

El repositorio se despliega en Vercel. La dirección de producción es **https://atril-xi.vercel.app**;
los cambios locales solo aparecen allí después de publicarlos correctamente.

Las dependencias y recursos conservan sus respectivas licencias. Los avisos de las muestras de
instrumentos están en [`public/licenses/fluidsoundfont-notice.txt`](public/licenses/fluidsoundfont-notice.txt).
Consulte también la sección de ayuda y créditos de la aplicación.
