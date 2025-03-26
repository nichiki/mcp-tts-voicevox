declare module "node-wav" {
  interface WavResult {
    data: Float32Array;
    sampleRate: number;
    channelData: Float32Array[];
  }

  export function decode(buffer: Buffer): WavResult;
}
