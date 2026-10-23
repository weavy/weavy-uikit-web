import { languages } from "@codemirror/language-data";
import { LanguageDescription } from "@codemirror/language";
export { EditorView, keymap, placeholder, dropCursor, ViewUpdate, type KeyBinding, tooltips, type ViewPlugin, lineNumbers, gutter } from "@codemirror/view";
export { EditorState, type Extension, Compartment } from "@codemirror/state";
//export { markdown } from "@codemirror/lang-markdown";
export { languages } from "@codemirror/language-data";
export { /*defaultHighlightStyle,*/ syntaxHighlighting, LanguageDescription } from "@codemirror/language";
export { type Completion, CompletionContext, type CompletionResult, autocompletion } from "@codemirror/autocomplete";
export { weavyKeymap } from "./commands";
export { markdownKeymap } from "./commands-markdown";
export { mentions } from "./mentions";
export { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
export { weavyHighlighter } from "./highlight";

export async function loadMarkdown() {
 const md = await import('@codemirror/lang-markdown');
 // Config for markdown
 return md.markdown({ base: md.markdownLanguage, codeLanguages: languages })
}

const markdownLanguage = languages.find((language) => language.name === "Markdown");

if (markdownLanguage) {
  // Override load to be able to set config
  markdownLanguage.load = loadMarkdown;
}

/**
 * Closest CodeMirror language for extensions that have no grammar of their own, keyed by lowercase extension.
 * Razor is HTML with C# islands, so the markup and attributes highlight while the `@` code stays plain.
 */
const languageAliases: Record<string, string> = {
  cshtml: "HTML",
  razor: "HTML",
};

/**
 * Finds the correct language support based on a filename.
 * @param filename - e.g., "script.ts" or "index.html"
 */
export async function getLanguageFromFilename(filename: string) {
  // 1. Find the language description that matches the filename, or the closest language for aliased extensions
  const alias = languageAliases[filename.slice(filename.lastIndexOf(".") + 1).toLowerCase()];
  const langDesc = alias
    ? LanguageDescription.matchLanguageName(languages, alias)
    : LanguageDescription.matchFilename(languages, filename);

  if (langDesc) {
    // 2. Load the language (this returns a Promise<LanguageSupport>)
    return await langDesc.load();
  }

  return null;
}