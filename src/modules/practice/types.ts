export interface PracticeOptions {
  start: number;
  end: number;
  bar: number;
  beat: number;
  speed: number;
  repeat: boolean;
  metronome: boolean;
  countIn: boolean;
}
export interface PracticeEvent {
  i: number;
  s: number;
  e: number;
  p: number | null;
}
