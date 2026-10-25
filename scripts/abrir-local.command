#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")/.."
if ! command -v npm >/dev/null 2>&1; then
  print 'No se encontró npm. Abre esta carpeta en una terminal con Node.js instalado.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  print 'Faltan las dependencias. Ejecuta npm ci en esta carpeta y vuelve a abrir este archivo.'
  exit 1
fi
print 'Atril se abrirá en la dirección local que aparece abajo. Para detenerlo, pulsa Ctrl+C.'
exec npm run dev -- --host 127.0.0.1
