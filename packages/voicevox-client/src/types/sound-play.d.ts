declare module 'sound-play' {
  interface PlayOptions {
    player?: string;
  }

  export function play(filePath: string, options?: PlayOptions): Promise<void>;
}