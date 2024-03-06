export { EditorView, keymap, placeholder, dropCursor, ViewUpdate, type KeyBinding } from "@codemirror/view";
export { EditorState, type Extension } from "@codemirror/state";
export { markdown } from "@codemirror/lang-markdown";
export { languages } from "@codemirror/language-data";
export { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
export { type Completion, CompletionContext, type CompletionResult, autocompletion } from "@codemirror/autocomplete";
export { weavyDesktopMessageKeymap, weavyKeymap } from "./commands";
export { mentions } from "./mentions";
export { defaultKeymap, history, historyKeymap } from "@codemirror/commands";