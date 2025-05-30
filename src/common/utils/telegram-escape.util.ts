/**
 * Escapes special characters for Telegram MarkdownV2 formatting.
 * See: https://core.telegram.org/bots/api#markdownv2-style
 *
 * Usage: Use this before sending any dynamic content in MarkdownV2 parse_mode.
 */
export function escapeMarkdownV2(text: string): string {
  if (!text) return '';
  return text.replace(
    /[\\_\*\[\]\(\)~`>#+\-=|{}\.!]/g,
    (match) => '\\' + match,
  );
}
