import { PlainObjectType } from "./generic.types";

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