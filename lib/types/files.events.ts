import { SubscribeEventType } from "./app.events";
import { AppType } from "./app.types";
import { ContextDataBlobsType } from "./context.types";
import { BlobType, ExternalBlobType, FileType } from "./files.types";

// Local ShadowDOM events (composed: false, bubbling: true)

export type FileEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  file: FileType;
} & TAdditionalDetail>

export type FilesEventType = CustomEvent<{ files: File[] | FileList | null }>

export type FileOpenEventType = CustomEvent<{ fileId: number; tab?: "comments" | "versions" }> & { type: "file-open" };

export type ExternalBlobsEventType = CustomEvent<{ externalBlobs: ExternalBlobType[] | null }> & {
  type: "external-blobs";
};

export type BlobUploadedEventType = CustomEvent<{
  blob: BlobType;
}> & { type: "blob-uploaded" }

export type UploadFilesEventType = FilesEventType & { type: "upload-files" };

export type DropFilesEventType = FilesEventType & { type: "drop-files" }

export type CreateFilesEventType = CustomEvent<{
  blobs: BlobType[] | null;
  replace: boolean;
}> & { type: "create-files" }

export type FileEditNameEventType = FileEventType & { type: "edit-name" }

export type FileRenameEventType = FileEventType<{ name: string }> & { type: "rename" }

export type FileTrashEventType = FileEventType & { type: "trash" }

export type FileRestoreEventType = FileEventType & { type: "restore" }

export type FileDeleteForeverEventType = FileEventType & { type: "delete-forever" }

export type FileSubscribeEventType = SubscribeEventType<{ file: FileType }>

export type FileVersionSelectEventType = CustomEvent<{
  versionFile: FileType;
}> & { type: "file-version-select" }

/**
 * Fired when a file preview is considered loaded.
 */
export type FilePreviewLoadedEventType = CustomEvent<{
  file?: FileType;
}> & {
  type: "file-preview-loaded";
};

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
  /** Any uploaded context data */
  contextDataBlobs: ContextDataBlobsType;
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
    "wy-preview-open": WyPreviewOpenEventType;
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
    "wy-preview-close": WyPreviewCloseEventType;
  }
}