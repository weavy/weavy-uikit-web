import { AppType } from "./app.types";
import { FileType } from "./files.types";

// Local ShadowDOM events (composed: false, bubbling: true)

export type FileOpenEventType = CustomEvent<{ fileId: number; tab?: "comments" | "versions" }> & { type: "file-open" };

// Public component API events (composed: true, bubbling: false)

/**
 * Preview open detail data.
 */
export type WyPreviewOpenEventDetailType = {
  /** Id of the file to show. */ 
  fileId: number;
  /** Optional tab to show when the preview opens. */
  tab?: "comments" | "versions";
  /** The entire (static) file list provided for the preview. */
  files: FileType[];
  /** The app which the file relates to. */
  app: AppType;
  /** The currently allowed features in the related app. */
  features: string;
  /** Whether the file is an attachment. */
  isAttachment: boolean;
};

/**
 * Fired when a preview overlay is about to open.
 */
export type WyPreviewOpenEventType = CustomEvent<WyPreviewOpenEventDetailType> & {
  type: "wy-preview-open";
  cancelable: true;
  bubbles: false;
  composed: true;
};

declare global {
  interface ElementEventMap {
    "wy-preview-open": WyPreviewOpenEventType,
  }
}


/**
 * Fired when a preview overlay is closed.
 */
export type WyPreviewCloseEventType = CustomEvent<never> & {
  type: "wy-preview-close";
  cancelable: false;
  bubbles: false;
  composed: true;
};

declare global {
  interface ElementEventMap {
    "wy-preview-close": WyPreviewCloseEventType,
  }
}
