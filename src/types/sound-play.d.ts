declare module "sound-play" {
  function play(filePath: string): Promise<void>;
  export default play;
}
