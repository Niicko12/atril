export interface BasicPitchNoteEvent {
  startFrame: number;
  durationFrames: number;
  pitchMidi: number;
  amplitude: number;
}
export interface BasicPitchTimedNote {
  pitchMidi: number;
  amplitude: number;
  startTimeSeconds: number;
  durationSeconds: number;
}
export interface BasicPitchModel {
  evaluateModel(
    audio: Float32Array,
    onFrames: (frames: number[][], onsets: number[][], contours: number[][]) => void,
    onProgress: (p: number) => void,
  ): Promise<void>;
}
export interface BasicPitchLib {
  BasicPitch: new (model: unknown) => BasicPitchModel;
  outputToNotesPoly(
    frames: number[][],
    onsets: number[][],
    onsetThresh: number,
    frameThresh: number,
    minNoteLen: number,
  ): BasicPitchNoteEvent[];
  noteFramesToTime(notes: BasicPitchNoteEvent[]): BasicPitchTimedNote[];
}
export function installBasicPitch(): BasicPitchLib;
