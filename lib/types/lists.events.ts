import { SortOrderType, ViewType } from "./lists.types";

export type OrderEventType<TOrder extends SortOrderType = SortOrderType> = CustomEvent<{
    order: TOrder;
}> & { type: "order" }

export type ViewEventType<TView extends ViewType = ViewType> = CustomEvent<{
    view: TView;
}> & { type: "view" }

export type ShowTrashedEventType = CustomEvent<{
    showTrashed: boolean;
}> & { type: "show-trashed" }