let markdown: typeof import("@logue/markdown-wasm") | undefined;
let loading: Promise<typeof import("@logue/markdown-wasm")> | undefined;

/**
 * Renders markdown to HTML with the same renderer the file editor uses for its live view.
 * The wasm module is loaded on first use, so views that never render markdown don't pay for it.
 *
 * @param text - Markdown source.
 * @returns The rendered HTML.
 */
export async function renderMarkdown(text: string): Promise<string> {
  if (!markdown) {
    loading ??= import("@logue/markdown-wasm").then(async (markdownModule) => {
      await markdownModule.ready();
      return markdownModule;
    });
    markdown = await loading;
  }
  return markdown.parse(text, { bytes: false })?.toString() ?? "";
}
