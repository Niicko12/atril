# Verificar Atril antes de publicar

## Abrir en tu computadora

Desde la carpeta del proyecto:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

También puedes abrir `scripts/abrir-local.command` con doble clic si ya instalaste las dependencias. La terminal muestra la dirección local; déjala abierta mientras usas Atril.

## Controles automáticos

```sh
npm run typecheck
npm run lint
npm run depcruise
npm run check:modules
npm test -- --coverage
npm run test:model
npm run build
```

El modelo real se prueba por separado: usa los pesos locales y CPU, sin subir audio. No sustituye la comprobación del Worker/WebGL en Safari.

## Pruebas de navegador

Instala los navegadores una vez (requiere internet y espacio local):

```sh
npx playwright install chromium webkit
npm run e2e
```

Playwright abre su propio servidor. Para investigar un fallo:

```sh
npm run e2e -- --project=chromium --headed
npm run e2e -- --project=webkit --headed
npx playwright show-trace test-results/RUTA-DEL-CASO/trace.zip
```

Los escenarios comprueban transcripción, privacidad de red, partes, cancelación, seguimiento, edición/deshacer, persistencia tras recargar, papelera/restauración, contenido del ZIP y foco de Ayuda. `--list` solo comprueba que se descubran los casos; no los ejecuta.

En PR hacia `main`, GitHub Actions ejecuta Chromium y WebKit después de los controles de calidad. Conserva informe HTML y trazas de fallos durante siete días. Los dos casos del modelo de partes están pendientes en WebKit y se omiten explícitamente allí; el resto corre en ambos proyectos. WebKit con perfil móvil no equivale a un iPhone físico.

## Comprobaciones manuales pendientes

- iPhone/Safari y Android/Chrome: escribir notas con el teclado, desplazarse por la partitura, escuchar con y sin auriculares y reanudar tras bloquear la pantalla.
- VoiceOver/TalkBack: recorrer metadatos y controles musicales; abrir/cerrar diálogos y comprobar anuncios de notas sin perder el foco.
- Dos pestañas: abrir la misma partitura, editar una y comprobar el aviso en la otra; cambiar de partitura debe retirar el aviso anterior.
- Respaldo: exportar una copia y restaurarla en otro navegador; comprobar títulos, notas, instrumento y papelera.
- MuseScore Studio 4: abrir el MusicXML exportado de flauta y de un instrumento transpositor; revisar ritmo, armadura y cifrados.
- De oído: comprobar voz, mezcla, A-B lento, cancelación y 90 segundos con el modelo en un dispositivo real; revisar memoria y latencia.
- Escuchar «La cucaracha» antes de marcar el ejemplo como verificado.
- Ejecutar axe en pantallas principales y Lighthouse sobre el preview; registrar resultados reales antes de cerrar M4.

No publicar ni marcar estos criterios como completados únicamente porque compilen o pasen las pruebas de componentes.
