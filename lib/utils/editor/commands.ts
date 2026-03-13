import type { KeyBinding } from "@codemirror/view";
import { completionStatus, acceptCompletion } from "@codemirror/autocomplete";

export const weavyKeymap: KeyBinding[] = [
  {
    key: "Tab",
    run: (e) => {
      if (completionStatus(e.state)) return acceptCompletion(e);
      return false;
    },
  }
];
