import type { EditorView, KeyBinding } from "@codemirror/view";
import { completionStatus, acceptCompletion } from "@codemirror/autocomplete";

export const weavyKeymap: KeyBinding[] = [
  { key: "Mod-Enter", run: softSubmit },
  {
    key: "Tab",
    run: (e) => {
      if (completionStatus(e.state)) return acceptCompletion(e);
      return false;
    },
  },
];

export const weavyDesktopMessageKeymap: KeyBinding[] = [{ key: "Enter", run: softSubmit }];

function softSubmit(target: EditorView) {
  // dispatch event on the outer codemirror dom element
  const event = new Event("Weavy-SoftSubmit");
  target.dom.dispatchEvent(event);
  return true;
}
