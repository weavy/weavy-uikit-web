export type EmbedType = {
    id: number;
    title: string;
    description: string;
    type: "link" | "video" | "photo" | "audio" | "rich";
    host: string;
    original_url: string;
    provider_name: string;
    provider_url?: string;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
    width?: number;
    height?: number;
    author_name: string;
    author_url: string;
    html?: string;
    image?: string;
  };