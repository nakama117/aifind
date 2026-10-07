/** Language metadata is authoritative. Shared Han characters alone cannot identify Japanese. */
export function isJapaneseText(text: string, language?: string | null): boolean {
  if (language) return /^ja(?:[-_]|$)/i.test(language);
  return /[\u3040-\u30ff]/.test(text) && !/[\uac00-\ud7af]/.test(text);
}

/** Generated headlines can be entirely kanji; do not reject them as Chinese by character alone. */
export function looksJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text) && !/[\uac00-\ud7af]/.test(text);
}
