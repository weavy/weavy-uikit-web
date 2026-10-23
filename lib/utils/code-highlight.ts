/**
 * Highlights source code as HTML using the editor's CodeMirror languages and its Prism-style token classes, so the
 * result is styled by the same `wy-code` theme as the server-rendered code preview.
 * Everything is loaded on first use since it pulls in the editor chunk.
 *
 * @param text - Source code.
 * @param filename - File name used to pick the language from its extension.
 * @returns The highlighted HTML (without a wrapping `pre`), or `undefined` when no language matches the file name.
 */
export async function highlightCodeAsHtml(text: string, filename: string): Promise<string | undefined> {
  const [{ getLanguageFromFilename }, { weavyHighlighter }, { highlightCode }] = await Promise.all([
    import("./editor/editor"),
    import("./editor/highlight"),
    import("@lezer/highlight"),
  ]);

  const support = await getLanguageFromFilename(filename);
  if (!support) {
    return undefined;
  }

  const tree = support.language.parser.parse(text);
  let html = "";

  highlightCode(
    text,
    tree,
    weavyHighlighter,
    (code, classes) => {
      const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += classes ? `<span class="${classes}">${escaped}</span>` : escaped;
    },
    () => {
      html += "\n";
    },
  );

  return html;
}
