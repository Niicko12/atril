---
name: atril-checklist-pre-codigo
status: completed
created: 2026-10-18T13:03:42Z
updated: 2026-10-18T13:03:42Z
---

# Checklist pre-código — Atril

Verificación de la metodología Oden antes de escribir la primera línea de la app.

## Resultado

```
🎯 CHECKLIST PRE-CÓDIGO
═══════════════════════════

✅ technical-decisions.md: 2 006 líneas (mín. 2 000)
✅ Persistencia definida: IndexedDB (stores, índices, migraciones, formato de respaldo)
✅ Interfaces TypeScript: unidades, partitura, instrumentos, notación, importación, análisis, workers,
   reproducción, biblioteca, errores
✅ competitive-analysis.md: 1 053 líneas, 5 competidores (mín. 3)
✅ editor-spec.md:          1 173 líneas
✅ formats-spec.md:         1 058 líneas
✅ ear-spec.md:             1 006 líneas
✅ notation-core-spec.md:     935 líneas
✅ library-spec.md:           871 líneas
⚠️ playback-spec.md:          658 líneas (mín. 800) — excepción justificada, ver abajo
✅ implementation-plan.md: plan semana por semana con milestones M1-M4 y margen
✅ Estructura docs/ creada
✅ Decisión MVP documentada (6-8 semanas, monofónico)
✅ Stack justificado (con alternativas descartadas)
✅ Máquinas de estado: selección, reproducción, De oído, guardado, respaldo, papelera
✅ Edge cases: editor 30, notation-core 24, formats 37, ear 30, library 25, playback 18
✅ Code structure guidelines y quality rules medibles

TOTAL: 9 028 / 8 000 líneas mínimas ✅
```

## Excepción: playback-spec.md

658 líneas frente al mínimo de 800. Se acepta porque:

- El módulo es pequeño: 14 archivos, < 15 KB gzip, sin persistencia ni UI propia más allá de un botón.
- La spec cubre todo: parámetros exactos de los 8 timbres, desbloqueo en iOS, programador con lookahead,
  máquina de estados, 18 edge cases, 30 tests y trazabilidad.
- Agregar líneas sin contenido nuevo contradice la regla de Oden "no dupliques información".

## Decisiones del usuario registradas (2026-10-18)

| Decisión | Dónde |
|---|---|
| Migrar el artifact a app propia (React + Vite) | technical-decisions 2 |
| MVP de 6-8 semanas | technical-decisions 1.3 |
| Sin API de Claude ni IA externa (R1) | technical-decisions 1.4 |
| Todo gratis: GitHub + Vercel (R7) | technical-decisions 2.5 |
| Repo en GitHub y despliegue en Vercel (R8) | technical-decisions 1.4 |
| **Sin login ni backend** (R3) | technical-decisions 2.2, 7 |
| Flauta dulce, seguimiento del audio, La cucaracha, compartir | technical-decisions 3.1 |

## Pendientes conocidos (no bloquean empezar)

| Pendiente | Cuándo se resuelve |
|---|---|
| Basic Pitch: paquete npm o vendorizado; Worker o hilo principal en Safari | Spike semana 1 |
| CSP final con TF.js | Spike semana 1 |
| Verificar "La cucaracha" al oído | Semana 7 |
| Verificar precios de competidores | Antes de cualquier decisión de monetización |
| Pruebas de 30 min con cada competidor | Opcional, antes de la semana 2 |

## Veredicto

**✅ Listo para empezar a codificar: Semana 1 del plan (fundaciones).**
