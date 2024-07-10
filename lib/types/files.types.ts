import { AppRef, EntityType } from "./app.types";
import { CommentsResultType } from "./comments.types";
import type { MetadataType, SortOrderType } from "./lists.types";
import { InfiniteQueryResultType } from "./query.types";
import type { UserType } from "./users.types";
import { type Mutation } from "@tanstack/query-core";

export type FileOrderByType = "name" | "updated_at" | "size";

export type FileOrderType = SortOrderType & {
  by: FileOrderByType;
  descending: boolean;
};

export type FileViewType = "grid" | "list";

export type FileKindType =
  | "archive"
  | "audio"
  | "code"
  | "document"
  | "email"
  | "presentation"
  | "spreadsheet"
  | "image"
  | "text"
  | "video"
  | "file";

export type PreviewFormatType = "audio" | "code" | "embed" | "html" | "image" | "pdf" | "text" | "video" | "none";

export type FileProviderType = "Box" | "Dropbox" | "Google Drive" | "OneDrive" | "Confluence";
export type ProviderType = "box" | "dropbox" | "google-drive" | "onedrive" | "confluence";

export type BlobType = {
  id: number;
  name: string;
  size?: number;
  media_type?: string;
  thumbnail_url?: string;
  raw?: string;
};

export type ExternalBlobType = {
  provider: "Box" | "Dropbox" | "Google Drive" | "OneDrive" | "Confluence";
  link: string;
  name: string;
  size: number;
  raw: unknown;
  media_type?: string;
  embed?: string;
};

export type FileType = {
  id: number;
  app: AppRef;
  parent?: EntityType;
  version?: number;
  name: string;
  kind: FileKindType;
  media_type: string;
  width?: number;
  height?: number;
  size?: number;
  metadata?: MetadataType;
  tags?: string[];
  provider?: FileProviderType; // string
  download_url?: string;
  application_url?: string;
  embed_url?: string;
  external_url?: string;
  preview_format: PreviewFormatType;
  preview_url?: string;
  thumbnail_url?: string;
  created_at: string;
  created_by?: UserType;
  updated_at?: string;
  updated_by?: UserType;
  comments?: CommentsResultType;
  is_subscribed: boolean;
  is_starred: boolean;
  is_trashed: boolean;  
  refId?: number; //*
  raw?: string;
  confluence?: boolean;
};

export type FilesResultType = InfiniteQueryResultType<FileType>;

export type FileStatusStateType = "error" | "conflict" | "pending" | "ok";

export type FileStatusType = {
  state: FileStatusStateType;
  progress?: number;
  text?: string;
};

export type FileActionType =
  | "attach"
  | "create"
  | "delete-forever"
  | "edit"
  | "modify"
  | "rename"
  | "replace"
  | "restore"
  | "subscribe"
  | "trash"
  | "unsubscribe"
  | "upload"
  | "version";

export type FileMutationContextType = {
  type: FileActionType;
  file?: FileType;
  status: FileStatusType;
};

export type CreateFileProps = {
  blob: BlobType;
  replace?: boolean;
};

export type UploadProgressProps = {
  progress: number;
};

export type MutateFileProps = {
  file: File;
  onProgress?: (variables: UploadProgressProps) => void; // Hack to be able to pass a progress function in the mutation.
};

export type FileMutationType = Mutation<
  FileType | BlobType,
  Error,
  MutateFileProps,
  FileMutationContextType | undefined
>;

export type FileOpenEventType = CustomEvent<{ fileId: number, tab?: "comments" | "versions" }>