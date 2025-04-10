/**
 * テキストを自然な区切りで分割します
 * @param text 分割するテキスト
 * @param maxLength セグメントの最大長
 * @returns 分割されたテキストの配列
 */
export function splitText(text: string, maxLength: number): string[] {
  // 文の区切りとなるパターン
  const sentenceEndings = /([。！？])/;
  // 自然な区切りとなる接続詞や助詞
  const naturalBreaks =
    /([、しかし、でも、けれど、そして、また、または、それで、だから、ですから、そのため、したがって、ゆえに])/;

  const segments: string[] = [];
  let currentSegment = "";

  // 文を句読点で分割
  const sentences = text.split(sentenceEndings).reduce((acc, part, i, arr) => {
    if (i % 2 === 0) {
      // テキスト部分
      acc.push(part);
    } else {
      // 句読点部分 - 前のテキストと結合
      acc[acc.length - 1] += part;
    }
    return acc;
  }, [] as string[]);

  // 文ごとに処理
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;

    // 現在のセグメントに追加してみる
    const potentialSegment = currentSegment + sentence;

    // 最大長を超えないならそのまま追加
    if (potentialSegment.length <= maxLength) {
      currentSegment = potentialSegment;
    } else {
      // 最大長を超える場合、naturalBreaksで分割を試みる
      const parts = sentence.split(naturalBreaks);

      // 分割パーツを処理
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part.trim()) continue;

        // 現在のセグメントに追加してみる
        const newSegment = currentSegment + part;

        // 最大長を超えるかチェック
        if (newSegment.length <= maxLength) {
          currentSegment = newSegment;
        } else {
          // 既存のセグメントがあれば保存
          if (currentSegment.trim()) {
            segments.push(currentSegment.trim());
          }
          currentSegment = part;
        }
      }
    }

    // 一文が終わったら保存判定
    if (currentSegment.length >= maxLength && currentSegment.trim()) {
      segments.push(currentSegment.trim());
      currentSegment = "";
    }
  }

  // 残りのテキストがあれば追加
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments;
}
