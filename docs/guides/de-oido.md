# De oído: de una grabación a una partitura

1. Abre **De oído** y elige un audio o video de tu dispositivo.
2. Si necesitas analizar solo un fragmento, arrastra sobre la onda para marcar A-B. También puedes usar **Desde aquí** y **Hasta aquí**. Con la onda enfocada, las flechas desplazan la posición un segundo.
3. Elige el modo:
   - **Una voz o un instrumento solo**: para cantar o tocar una melodía sin acompañamiento.
   - **Canción completa: solo la voz (más rápido)**: intenta extraer una melodía principal.
   - **Canción completa: separar melodía, bajo y acordes**: usa Basic Pitch dentro del navegador. El primer uso descarga el modelo; el audio se procesa en el dispositivo.
4. En modo partes, se analizan hasta 90 segundos. Espera la lista de partes y abre **Melodía** o **Bajo**. El rango de notas y un resumen de acordes ayudan a elegir. Puedes desmarcar **Poner los acordes arriba de la partitura**.
5. Reproduce el audio original para comparar: la nota correspondiente se resalta en la partitura. Puedes reducir la velocidad sin cambiar el tono o repetir A-B.
6. Si cambias notas o metadatos, el seguimiento se desactiva para evitar señalar índices incorrectos. **Reajustar ritmo al tempo** vuelve a cuantizar las notas detectadas y restaura la correspondencia con el audio. Se puede deshacer.

Las partes comparten el mismo inicio temporal, por lo que se mantienen alineadas al abrir una y después otra. La melodía cambia a piano si el instrumento actual es bajo o contrabajo; la parte de bajo usa bajo.

Cancelar o elegir otro archivo descarta el análisis activo. Cerrar el panel detiene el audio. Las transcripciones son borradores: ruido, instrumentos superpuestos y notas ligadas pueden necesitar corrección manual. En navegadores sin aceleración, el análisis usa CPU y tarda más.

## Ejecutar en local

Desde la carpeta `atril`:

```sh
npm run dev
```

Abre la dirección que imprima Vite, normalmente `http://localhost:5173`.

## Comprobaciones

```sh
npm run typecheck
npm run lint
npm run depcruise
npm run check:modules
npm test -- --coverage
npm run test:model
npm run build
```

La prueba real del modelo se ejecuta por separado porque la instrumentación de cobertura vuelve muy lenta la inferencia en CPU. Usa los pesos locales y audio sintético, sin solicitudes de red.

Los escenarios de navegador están en `tests/e2e/ear.spec.ts`; `npm run e2e -- --list` comprueba su descubrimiento. Para ejecutarlos se necesitan los navegadores de Playwright y permiso para iniciar el servidor local. La validación en Safari/iPhone sigue pendiente.

## Ayuda dentro de la aplicación

El botón **Ayuda** explica la entrada de notas, importación/exportación, copias de respaldo, uso sin cuentas y atajos. Incluye las licencias y un diagnóstico de capacidades del navegador que puedes copiar: no recoge nombres de partituras, notas ni grabaciones.

Los diálogos se recorren con Tab y Mayús+Tab y se cierran con Escape. Puedes activar las teclas musicales enfocadas con Enter o Espacio. Al escribir, una región discreta anuncia el nombre y la duración a los lectores de pantalla.

El audio se detiene al ocultar la pestaña. Al cerrar De oído, su reproductor y caché se liberan. Si una herramienta no puede cargar, un mensaje permite volver al editor.

### Arranque de doble clic en macOS

Abre `scripts/abrir-local.command` en Terminal. Usa las dependencias ya instaladas y muestra la dirección local de Vite. Para detenerlo, pulsa Ctrl+C. No despliega nada ni instala paquetes.
