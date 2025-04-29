/** Sorting order */
export type SortOrderType<TOrderBy extends string = string> = {
  by: TOrderBy;
  descending: boolean;
};

/** Optional additional metadata */
export type MetadataType = {
  [Key: string]: string;
};

/** Optional tags */
export type TagsType = string[];

/** View layout */
export type ViewType = "grid" | "list"