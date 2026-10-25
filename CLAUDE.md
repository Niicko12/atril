# Atril

Editor de partituras (monofónico en el MVP) para músicos hispanohablantes, para computadora, tableta y móvil.

## Metodología
Oden (documentation-first). No escribir código de la app hasta completar el checklist pre-código de
`docs/reference/technical-decisions.md`. Seguir las specs de `docs/reference/modules/` al pie de la letra.

## Stack
React + Vite + TypeScript · abcjs · TensorFlow.js/Basic Pitch (Web Worker) · IndexedDB (datos en el dispositivo) · Vercel. Sin backend.

## Referencia
`legacy/index.html` es la versión original (artifact de Claude). Es la fuente de verdad del comportamiento actual y
del núcleo musical (transposición, ABC, MusicXML, MIDI, detección de tono). No editarla; portar desde ella.
`legacy/bp-model.json` contiene el modelo Basic Pitch (Apache-2.0) con pesos en base64.

## Restricciones
- Todo con planes gratuitos: GitHub Free (repo Niicko12/atril) y Vercel Hobby. No proponer servicios pagos.
- Sin login, cuentas ni backend: las partituras se guardan en IndexedDB del dispositivo; para cambiar de dispositivo, archivo de respaldo.
- Despliegue: push a `main` → Vercel, producción en https://atril-xi.vercel.app (OJO: atril.vercel.app es de otra persona). Previews por rama protegidas por Vercel. Commits con autor `Limber Magana <Niicko12@users.noreply.github.com>` (Vercel bloquea el email local).
- No usar la API de Claude/Anthropic ni otra IA externa. No portar "Pedir melodía a Claude" de legacy.

## Comandos
`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run depcruise` · `npm run build` (incluye presupuesto de bundle) · `npm run fixtures:legacy` (regenera dorados).

## Convenciones
- UI y textos en español.
- Commits solo cuando el usuario lo pida.
