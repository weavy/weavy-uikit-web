import { BlobType } from "./files.types";
import { MetadataType } from "./lists.types";

export type EmbedType = {
    id: number;
    title?: string;
    description?: string;
    type: "link" | "video" | "photo" | "rich";
    url?: string;
    provider_name?: string;
    provider_url?: string;
    thumbnail_url?: string;
    width?: number;
    height?: number;
    author_name?: string;
    author_url?: string;
    html?: string;
    image?: BlobType;
    metadata?: MetadataType;
    actions?: string[];
  };