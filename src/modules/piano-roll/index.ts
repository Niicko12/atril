export const loadPianoRoll = () =>
  import('./components/piano-roll-overlay').then((m) => ({ default: m.PianoRollOverlay }));
export { S as pianoRollStrings } from './strings';
