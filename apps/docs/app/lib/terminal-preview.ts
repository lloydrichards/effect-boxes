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
