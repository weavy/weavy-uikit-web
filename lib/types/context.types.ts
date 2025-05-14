import { EntityType } from "./app.types";
import { EmbedType } from "./embeds.types";
import { BlobType, FileType } from "./files.types";

export type ContextDataType = Blob | File | BlobType | FileType | URL | EmbedType | EntityType | string;

export type ContextDataBlobsType = number[] | undefined

export type ContextIdType = string;