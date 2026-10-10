import GithubSlugger from "github-slugger";

const publicModules = [
  "Annotation",
  "Ansi",
  "Box",
  "Cmd",
  "FrameEncoder",
  "Html",
  "Layout",
  "Reactive",
  "Renderer",
];

/** Unwrap fenced @example tags without changing source line numbers. */
export const normalizeExampleFences = (source: string): string =>
  source.replace(/\/\*\*[\s\S]*?\*\//g, (comment) => {
    let inExample = false;
    return comment
      .split("\n")
      .map((line) => {
        if (/^\s*\*\s*@\w+/.test(line)) {
          inExample = /^\s*\*\s*@example\b/.test(line);
        }
        return inExample
          ? line.replace(
              /^(\s*\*)\s*```(?:typescript|tsx?|js|javascript)?\s*$/,
              "$1"
            )
          : line;
      })
      .join("\n");
  });

/** Reject incomplete or unexpected output before replacing any API pages. */
export const validateModuleFiles = (files: ReadonlyArray<string>): void => {
  const expected = publicModules.map((name) => `${name}.ts.md`);
  const actual = files.filter((file) => file.endsWith(".ts.md"));
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));
  if (missing.length || unexpected.length) {
    throw new Error(
      `Incomplete API output. Missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}. Existing API pages were preserved.`
    );
  }
};

/** Preserve Markdown code spans while quoting unformatted TypeScript generics. */
export const escapeLineForMdx = (line: string): string => {
  const linked = line.replace(/\{@link\s+([^}]+)\}/g, "`$1`");
  const escapeProse = (prose: string): string => {
    let result = "";
    let start = 0;
    for (const match of prose.matchAll(/[A-Za-z_$][\w.$]*</g)) {
      if (match.index < start) continue;
      let depth = 1;
      let end = match.index + match[0].length;
      while (end < prose.length && depth > 0) {
        if (prose[end] === "<") depth++;
        if (prose[end] === ">") depth--;
        end++;
      }
      if (depth !== 0) continue;
      result +=
        prose.slice(start, match.index) +
        "`" +
        prose.slice(match.index, end) +
        "`";
      start = end;
    }
    return result + prose.slice(start);
  };
  let result = "";
  let start = 0;
  for (const span of linked.matchAll(/(`+).*?\1/g)) {
    result += escapeProse(linked.slice(start, span.index)) + span[0];
    start = span.index + span[0].length;
  }
  return result + escapeProse(linked.slice(start));
};

/** Match the overview's heading levels and link local symbol references. */
export const finalizeApiContent = (content: string): string => {
  const lines = content.split("\n");
  let inOverview = true;
  let inCode = false;
  const normalized = lines.map((line) => {
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode) return line;
    if (/^## /.test(line)) inOverview = false;
    return inOverview
      ? line.replace(/^(#{3,6}) /, (_, hashes: string) => `${hashes.slice(1)} `)
      : line;
  });
  const slugger = new GithubSlugger();
  const symbols = new Map<string, string>();
  inCode = false;
  for (const line of normalized) {
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode) continue;
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (!heading) continue;
    const title = heading[2] ?? "";
    const anchor = slugger.slug(title);
    if ((heading[1]?.length ?? 0) < 3) continue;
    const symbol =
      /^(\w+)(?: \((?:interface|type alias|namespace|class|function)\))?$/.exec(
        title
      )?.[1];
    if (symbol && !symbols.has(symbol)) symbols.set(symbol, anchor);
  }
  inCode = false;
  return normalized
    .map((line) => {
      if (line.startsWith("```")) inCode = !inCode;
      if (inCode || /^#{1,6} /.test(line)) return line;
      return line.replace(
        /(?<![[`])`(\w+)`(?![\]`])/g,
        (span, symbol: string) => {
          const anchor = symbols.get(symbol);
          return anchor ? `[${span}](#${anchor})` : span;
        }
      );
    })
    .join("\n");
};
