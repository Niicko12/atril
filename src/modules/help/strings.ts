export const S = {
  title: 'Ayuda y acerca de Atril',
  close: 'Cerrar',
  intro: 'Un atril digital para escribir, escuchar y transportar melodías. Sin cuentas ni servidor de partituras.',
  start: 'Para empezar',
  steps: [
    'Elige tu instrumento y toca el piano, el diapasón o los botones Do-Re-Mi. Cambia la duración antes de escribir, o selecciona una nota para corregirla.',
    'Usa Editor visual para arrastrar notas, ajustar duraciones y escuchar un borrador antes de aplicar. Cancelar conserva la partitura original; Aplicar permite deshacer el conjunto.',
    'Navega por compases y escucha desde un compás, la nota seleccionada o el inicio. En instrumentos transpositores puedes cambiar entre la partitura escrita y el sonido real.',
    'Usa Buscar o abrir para buscar partituras clásicas gratuitas en línea y cargarlas directamente, o importar MusicXML, MIDI o ABC. La consulta opcional conecta con GitHub sin enviar tus partituras; revisa las condiciones de la fuente. Los sonidos de instrumentos descargan muestras de FluidR3 al primer uso; necesitan conexión y no envían tus notas. Si fallan, se indica el sonido sintetizado de respaldo. Puedes descargar la partitura como PDF o imagen, y copiar su texto ABC.',
  ],
  ear: 'De una grabación a notas',
  earText:
    'En De oído puedes subir una grabación, repetir un fragmento A-B y escucharlo más lento sin cambiar el tono. El modo de partes ofrece melodía, bajo y acordes; son borradores que conviene revisar al oído.',
  earPrivacy:
    'El audio se procesa en tu dispositivo. Basic Pitch descarga un modelo al primer uso; no envía tu grabación a una IA externa. El audio cargado se descarta al cerrar el panel.',
  openEar: 'Abrir De oído',
  backup: 'Tus partituras y copias',
  backupText:
    'Las partituras se guardan en este navegador, no en una cuenta. Si borras los datos del navegador, cambias de dispositivo o usas navegación privada, podrías perderlas. En Mis partituras puedes crear y restaurar una copia de respaldo.',
  sharedDevice:
    'En un dispositivo compartido, otra persona que abra este mismo navegador puede ver tus partituras. Conserva copias de los archivos que necesites.',
  migration:
    'Si vienes de la versión original de Atril, descarga allí tus partituras para MuseScore y abre esos archivos aquí con Buscar o abrir.',
  library: 'Abrir Mis partituras',
  shortcuts: 'Usar Atril con teclado',
  keys: [
    ['a w s e d f t g y h u j k o l', 'Notas cromáticas, desde Do.'],
    ['1 · 2 · 3 · 4 · 5', 'Redonda, blanca, negra, corchea y semicorchea.'],
    ['[ · ]', 'Reducir a la mitad o duplicar la duración de la nota seleccionada.'],
    ['Espacio', 'Reproducir o detener la partitura.'],
    ['Ctrl/Cmd + Z', 'Deshacer; con Mayús, rehacer. Ctrl + Y también rehace.'],
    ['← →', 'Mover la selección; en la onda del audio, mover un segundo.'],
    ['Enter / Espacio', 'Activar el botón o la tecla musical que tiene el foco.'],
    ['Tab / Mayús + Tab', 'Recorrer controles; Escape cierra un diálogo.'],
  ],
  keyboardNote:
    'Los atajos de notas no actúan mientras el foco está en un campo, botón o enlace, ni dentro de los diálogos.',
  diagnostic: 'Diagnóstico local',
  diagnosticText:
    'Solo muestra capacidades del navegador. No incluye títulos de partituras, notas, archivos, datos de salud ni audio; no se envía a ningún servicio.',
  copy: 'Copiar diagnóstico',
  copied: 'Diagnóstico copiado.',
  select: 'No se pudo copiar automáticamente. Puedes seleccionar y copiar el texto de abajo.',
  output: 'Texto del diagnóstico',
  licenses: 'Tecnologías y licencias',
} as const;
export const LICENSES = [
  ['FluidR3 · muestras de instrumentos', 'CC BY 3.0', 'fluidsoundfont-notice.txt'],
  ['React', 'MIT', 'react.txt'],
  ['React DOM', 'MIT', 'react-dom.txt'],
  ['abcjs', 'MIT', 'abcjs.txt'],
  ['Zustand', 'MIT', 'zustand.txt'],
  ['fflate', 'MIT', 'fflate.txt'],
  ['jsPDF', 'MIT', 'jspdf.txt'],
  ['TensorFlow.js', 'Apache-2.0', 'apache-2.0.txt'],
  ['Basic Pitch · Spotify', 'Apache-2.0', 'basic-pitch-notice.txt'],
  ['Work Sans', 'SIL OFL 1.1', 'work-sans.txt'],
  ['Bodoni Moda', 'SIL OFL 1.1', 'bodoni-moda.txt'],
] as const;
