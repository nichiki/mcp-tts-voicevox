import { VoicevoxClient } from "./voicevox";

async function main() {
  try {
    console.log("VOICEVOXテストを開始します...");
    const player = new VoicevoxClient({
      url: "http://localhost:50021",
    });

    // 複数のテキストをキューに追加
    const result = await player.speak(
      "おはようございます!今日の天気はあめ！", //  長い文章
      1
    );

    console.log(result);
  } catch (error) {
    console.error("テスト中にエラーが発生しました:", error);
    process.exit(1);
  }
}

main();
