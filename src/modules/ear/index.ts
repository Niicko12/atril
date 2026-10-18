/** Carga diferida del panel "De oído" (fuera del JS inicial). */
export const loadEarPanel = () => import('./components/ear-panel').then((m) => ({ default: m.EarPanel }));
export { S as earStrings } from './strings';
