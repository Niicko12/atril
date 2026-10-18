import { EXPECTED, runSpike, type SpikeResult } from './run';

const MODEL_URL = new URL('/models/basic-pitch/model.json', location.href).href;
const out = document.getElementById('out') as HTMLPreElement;
const log = (m: string) => {
  out.textContent += `${m}\n`;
};

document.addEventListener('securitypolicyviolation', (e) =>
  log(`❌ CSP bloqueó: ${e.violatedDirective} → ${e.blockedURI}`),
);
log(`Navegador: ${navigator.userAgent}`);
log(
  `Núcleos: ${navigator.hardwareConcurrency} · OffscreenCanvas en la página: ${typeof OffscreenCanvas !== 'undefined'}`,
);
log(`Notas esperadas: ${EXPECTED.join(', ')}\n`);

function report(r: SpikeResult): void {
  const ok = r.found.length === EXPECTED.length;
  log(`${ok ? '✅' : '⚠️'} [${r.where}] motor=${r.backend} · OffscreenCanvas=${r.offscreenCanvas}`);
  log(`   carga del modelo ${r.loadMs.toFixed(0)} ms · análisis de ${r.audioSec} s en ${r.inferMs.toFixed(0)} ms`);
  log(
    `   notas detectadas: ${r.notes.join(', ') || '(ninguna)'} · esperadas encontradas: ${r.found.length}/${EXPECTED.length}\n`,
  );
}

document.getElementById('worker')?.addEventListener('click', () => {
  log('— Prueba en segundo plano (Worker) —');
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<{ type: string; m?: string; result?: SpikeResult }>) => {
    if (e.data.type === 'log') log(`   ${e.data.m}`);
    if (e.data.type === 'done' && e.data.result) {
      report(e.data.result);
      w.terminate();
    }
    if (e.data.type === 'error') {
      log(`❌ [worker] ${e.data.m}\n`);
      w.terminate();
    }
  };
  w.onerror = (e) => log(`❌ [worker] no arrancó: ${e.message}\n`);
  w.postMessage({ modelUrl: MODEL_URL });
});

document.getElementById('main')?.addEventListener('click', async () => {
  log('— Prueba en la página (hilo principal, plan B) —');
  try {
    report(await runSpike('main', MODEL_URL, (m) => log(`   ${m}`)));
  } catch (err) {
    log(`❌ [main] ${String(err)}\n`);
  }
});
