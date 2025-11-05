import type { EditorView, KeyBinding } from "@codemirror/view";
import { completionStatus, acceptCompletion } from "@codemirror/autocomplete";

export const weavyModifierEnterSendKeymap: KeyBinding[] = [{ key: "Mod-Enter", run: softSubmit }];

export const weavyEnterSendKeymap: KeyBinding[] = [{ key: "Enter", run: softSubmit }];

export const weavyKeymap: KeyBinding[] = [
  {
    key: "Tab",
    run: (e) => {
      if (completionStatus(e.state)) return acceptCompletion(e);
      return false;
    },
  },
];

function softSubmit(target: EditorView) {
  // dispatch event on the outer codemirror dom element
  const event = new Event("Weavy-SoftSubmit");
  target.dom.dispatchEvent(event);
  return true;
}
