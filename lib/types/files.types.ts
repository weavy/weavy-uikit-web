import { EntityType } from "./app.types";
import { CommentType } from "./comments.types";
import type { SortOrderType } from "./lists.types";
import { MetadataType } from "./msg.types";
import type { UserType } from "./users.types";
import { type Mutation } from "@tanstack/query-core";

export type FileOrderByType = "id" | "name" | "size" | "created_at" | "modified_at" | "timestamp";

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

export type ProviderType = "google-drive" | "onedrive" | "box" | "dropbox";

export type BlobType = {
  id: number;
  name: string;
  size?: number;
  media_type?: string;
  thumbnail_url?: string;
};

export type ExternalBlobType = {
  provider: "Box" | "Dropbox" | "Google Drive" | "OneDrive";
  link: string;
  name: string;
  size: number;
  raw: unknown;
  media_type?: string;
  embed?: string;
};

export type FileType = {
  id: number;
  app_id?: number;
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
  provider?: ProviderType; // string
  download_url?: string;
  application_url?: string;
  embed_url?: string;
  external_url?: string;
  preview_format: PreviewFormatType;
  preview_url?: string;
  thumbnail_url?: string;
  created_at: string;
  created_by?: UserType;
  created_by_id: number;
  modified_at?: string;
  modified_by?: UserType;
  modified_by_id?: number;
  comment_count?: number;
  comment_ids?: number[];
  comments?: CommentType[];
  is_subscribed: boolean;
  is_trashed: boolean;
  refId?: number; //*
};

export type FilesResultType = {
  data?: FileType[];
  start?: number;
  end?: number;
  count: number;
};

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
