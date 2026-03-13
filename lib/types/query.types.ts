import { isPlainObject } from "../utils/objects";
import { IntRange, PlainObjectType } from "./generic.types";

export type QueryResultType<TDataItem extends PlainObjectType> = {
    data?: Array<TDataItem>;
    start?: number;
    end?: number;
    count: number;
};

export type InfiniteQueryResultType<TDataItem extends PlainObjectType> = QueryResultType<TDataItem>;

export type MutationAbortProps = {
    signal?: AbortSignal;
    abort?: AbortController["abort"];
}

export type QueryPagingType = {
  skip?: number,
  take?: IntRange<1,100>
}

export type QueryPagingAroundType = QueryPagingType & {
  around?: number;
}

export type QueryFilterType = {
  q?: string;
  tag?: string;
  trashed?: boolean;
  "order_by"?: QueryOrderType;
};

export type QueryOrderType = `${string} ${"desc" | "asc"}`;

export interface QueryFilterProps {
  query?: string | null;
  tag?: string | null;
  trashed?: boolean | null;
  orderBy?: QueryOrderType | null;
};

export function isQueryFilter(filter: unknown): filter is QueryFilterType {
  if(isPlainObject(filter) && (
    typeof filter.q === "string" ||
    typeof filter.tag === "string" ||
    typeof filter.trashed === "boolean" ||
    typeof filter.order_by === "string"
  )) {
    return true;
  } else {
    return false;
  }
}