// Dirección de capas: technical-decisions.md 9.4.
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'core-es-puro',
      comment: 'src/core solo importa src/core (sin React, DOM ni otras capas).',
      severity: 'error',
      from: { path: '^src/core' },
      to: { pathNot: ['^src/core', '^node_modules'], dependencyTypesNot: ['type-only'] },
    },
    { name: 'core-sin-react', severity: 'error', from: { path: '^src/core' }, to: { path: 'node_modules/(react|react-dom|abcjs|zustand)/' } },
    {
      name: 'workers',
      severity: 'error',
      from: { path: '^src/workers' },
      to: { path: '^src/(modules|infra|app|shared)' },
    },
    {
      name: 'app-por-index',
      comment: 'app solo importa el index.ts de cada módulo (technical-decisions 9.4).',
      severity: 'error',
      from: { path: '^src/app' },
      to: { path: '^src/modules/[^/]+/.+', pathNot: '^src/modules/[^/]+/index\\.ts$' },
    },
    { name: 'infra', severity: 'error', from: { path: '^src/infra' }, to: { path: '^src/(modules|app)' } },
    { name: 'shared', severity: 'error', from: { path: '^src/shared' }, to: { path: '^src/(modules|infra|app)' } },
    {
      name: 'modulos-por-index',
      comment: 'Entre módulos solo se importa el index.ts del otro módulo.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/.+', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.app.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '\\.test\\.' },
  },
};
