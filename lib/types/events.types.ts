import { AppType } from "./app.types";
import { FileType } from "./files.types";
import { MessageType } from "./messages.types";

// Local same node events (composed: false, bubbling: false)

// Local ShadowDOM events (composed: false, bubbling: true)

export type FileOpenEventType = CustomEvent<{ fileId: number; tab?: "comments" | "versions" }> & { type: "file-open" };

// Public component API events (composed: true, bubbling: false)

export type WyPreviewOpenEventType = CustomEvent<{
  fileId: number;
  tab?: "comments" | "versions";
  files: FileType[];
  app: AppType;
  features: string;
  isAttachment: boolean;
}> & {
  type: "wy-preview-open";
  cancelable: true;
  bubbles: false;
  composed: true;
};

export type WyPreviewCloseEventType = CustomEvent<never> & {
  type: "wy-preview-close";
  cancelable: false;
  bubbles: false;
  composed: true;
};

export type WyAppEventType = CustomEvent<{
  app: AppType;
}> & {
  type: 'wy-app' | `wy-app-${string}`;
  bubbles: false;
  composed: true;
};

export type WyMessageEventType = CustomEvent<{
  message: MessageType;
  direction: "inbound" | "outbound",
  bot?: string
}> & {
  type: "wy-message" | `wy-message-${string}`;
  bubbles: false;
  composed: true;
};

// Public DOM events (composed: true, bubbling: true)
