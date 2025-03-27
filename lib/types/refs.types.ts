import { EntityType } from "./app.types";
import { EmbedType } from "./embeds.types";
import { BlobType, FileType } from "./files.types";

export type DataRefType = DataRefFileType | DataRefUrlType; // | DataRefBlobType | DataRefEntityType;

export type DataRefBlobType = {
  type: "blob";
  item: Blob; //| BlobType
};

export type DataRefFileType = {
  type: "file";
  item: File; //| FileType
};

export type DataRefUrlType = {
  type: "url";
  item: URL; //| EmbedType
};

export type DataRefEntityType = {
  type: "entity";
  item: EntityType;
};

export type ContextDataType = Blob | File | BlobType | FileType | URL | EmbedType | EntityType | string;
