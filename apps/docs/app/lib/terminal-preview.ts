import { FancyAnsi } from "fancy-ansi";
import * as Width from "../../../../packages/effect-boxes/src/internal/width";

const ansi = new FancyAnsi();
const entities = new Map([
  ["&amp;", "&"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
]);
const escapedCharacters = new Map(
  Array.from(entities, ([entity, character]) => [character, entity])
);

export function renderTerminalPreview(input: string): string {
  const html = ansi.toHtml(prepareTerminalPreview(input));
  // FancyAnsi emits style spans and escaped text. Measure the text inside each
  // style run, then escape it again before inserting cell spans.
  return html.replace(/<[^>]*>|[^<]+/g, (part) => {
    if (part.startsWith("<") || !/\P{ASCII}/u.test(part)) return part;

    const text = part.replace(
      /&(?:amp|lt|gt|quot|#39);/g,
      (entity) => entities.get(entity) ?? entity
    );
    return Width.segments(text)
      .map((segment) => {
        const escaped = segment.replace(
          /[&<>"']/g,
          (character) => escapedCharacters.get(character) ?? character
        );
        if (!/\P{ASCII}/u.test(segment)) return escaped;
        const columns = Width.ofString(segment);
        return columns > 0
          ? `<span class="terminal-cell" style="width:${columns}ch">${escaped}</span>`
          : escaped;
      })
      .join("");
  });
}

/** Split combined SGR colors for fancy-ansi, which parses extended colors only in isolation. */
export function prepareTerminalPreview(input: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: SGR starts with the ESC control character.
  return input.replace(/\u001b\[([\d;]*)m/g, (sequence, parameters: string) => {
    const codes = parameters.split(";");
    if (
      !codes.some((code) => code === "38" || code === "48" || code === "58")
    ) {
      return sequence;
    }
    const commands: string[] = [];
    for (let index = 0; index < codes.length; ) {
      const code = codes[index];
      const extended = code === "38" || code === "48" || code === "58";
      const mode = codes[index + 1];
      const size =
        extended && mode === "2" ? 5 : extended && mode === "5" ? 3 : 1;
      if (index + size > codes.length) return sequence;
      commands.push(`\u001b[${codes.slice(index, index + size).join(";")}m`);
      index += size;
    }
    return commands.join("");
  });
}
