# Diferencias intencionales con legacy

Los dorados de `core.json` se generan con `npm run fixtures:legacy` desde `legacy/index.html`.
Las diferencias intencionales no se comparan contra el dorado; se cubren con tests propios.

| ID | Spec | Diferencia | Test propio |
|---|---|---|---|
| D1 | notation-core 10.4 | La continuación ligada tras la barra lleva la alteración | `abc-builder.test.ts` (T-ABC-02) |
| D2 | notation-core 10.5 | `%` eliminado de título y compositor | `abc-builder.test.ts` (T-ABC-04) |
| — | notation-core 3.2 | Flauta dulce (no existe en legacy) | `instruments.test.ts` (T-INS-04) |

Estado al 2026-10-18: ningún caso de `cases.json` cae en D1/D2, así que los 864 ABC se comparan completos.
