export type SortOrderType = {
  by: string;
  descending: boolean;
};

/** Optional additional metadata */
export type MetadataType = {
  [Key: string]: string;
};

/** Optional tags */
export type TagsType = string[];