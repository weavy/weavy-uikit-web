import { insertBlankLine } from "@codemirror/commands";
import type { EditorView, KeyBinding } from "@codemirror/view";

export const weavyKeymap: KeyBinding[] = [
  { key: "Mod-Enter", run: softSubmit },
  { key: "Shift-Enter", run: insertBlankLine },
];

export const weavyDesktopMessageKeymap: KeyBinding[] = [{ key: "Enter", run: softSubmit }];

function softSubmit(target: EditorView) {
  // dispatch event on the outer codemirror dom element
  const event = new Event("Weavy-SoftSubmit");
  target.dom.dispatchEvent(event);
  return true;
}
