# Revisión de MuseScore Studio para Atril

Fecha: 2026-10-24.

## Función elegida

MuseScore Studio 4.7 añadió `Q` y `W` para dividir o duplicar la duración de la nota o selección activa. Su manual también describe entrada por teclado, MIDI y piano virtual, acordes, silencios y ligaduras. Atril ya tiene piano virtual, notas por teclado, silencios, ligaduras de duración en el formato, deshacer/rehacer y edición de duración con la barra. La mejora útil y pequeña para su editor monofónico es ajustar rápido la duración de la nota seleccionada.

## Adaptación en Atril

- `[` reduce a la mitad; `]` duplica la duración de la nota seleccionada.
- Se opera sobre una nota o silencio, y se registra en el historial para deshacer y rehacer.
- Las duraciones se limitan a 1–48 semicorcheas, que es el rango admitido por el modelo de partitura de Atril. Al dividir una duración impar, se redondea al entero más cercano.
- No se usa `Q/W`: `W` ya es una tecla de entrada de nota en Atril. Tampoco se añade selección por rango; Atril aún no ofrece selección de compases.

Es una adaptación de una interacción concreta de MuseScore Studio, no una implementación de todo su editor de escritorio.

## Resultado de REA

REA está instalado en la caché local y su diagnóstico confirma la skill, pero la integración MCP de Codex está ausente. Además, no se encontró una instalación de MuseScore Studio en las rutas examinadas y REA no tiene configurado Hopper, Ghidra o IDA para analizar una aplicación nativa. Por eso no se realizó ingeniería inversa del binario ni se atribuyen esos hallazgos a REA. La función se seleccionó a partir de las notas oficiales de versión y el manual público de MuseScore Studio.

## Fuentes

- [MuseScore Studio 4.7: notas de versión](https://musescore.org/en/4.7)
- [Manual de MuseScore Studio: introducir notas y silencios](https://handbook.musescore.org/basics/entering-notes-and-rests)
- [Repositorio oficial de MuseScore Studio](https://github.com/musescore/MuseScore)
