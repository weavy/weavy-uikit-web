import { EntityType } from "./app.types";
import { EmbedType } from "./embeds.types";
import { BlobType, FileType } from "./files.types";
import { JsonType } from "./generic.types";

export type ContextDataType = Blob | File | BlobType | FileType | URL | EmbedType | EntityType | JsonType | string;

export type ContextDataBlobsType = number[] | undefined

export type ContextIdType = string;