import { EntityType } from "./app.types";

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
