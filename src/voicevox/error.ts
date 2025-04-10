/**
 * エラーハンドリングを行い、適切なエラーメッセージとともに例外をスローします
 * @param message エラーメッセージのプレフィックス
 * @param error 発生したエラー
 * @returns never（常に例外をスロー）
 */
export function handleError(message: string, error: unknown): never {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`${message}: ${errorMsg}`, error);
  throw new Error(`${message}: ${errorMsg}`);
}

/**
 * エラーハンドリングを行い、エラーメッセージを返します (例外をスローしない)
 * @param message エラーメッセージのプレフィックス
 * @param error 発生したエラー
 * @returns エラーメッセージ
 */
export function formatError(message: string, error: unknown): string {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`${message}: ${errorMsg}`, error);
  return `${message}: ${errorMsg}`;
}
