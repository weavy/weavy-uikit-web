import { PlainObjectType } from "./generic.types";

export type QueryResultType<TDataItem> = Array<TDataItem & PlainObjectType>;

export type InfiniteQueryResultType<TDataItem> = {
    data?: Array<TDataItem & PlainObjectType>;
    start?: number;
    end?: number;
    count: number;
};