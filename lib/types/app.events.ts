import { AppType } from "./app.types";

// Local ShadowDOM events (composed: false, bubbling: true)

export type SubscribeEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  subscribe: boolean;
} & TAdditionalDetail> & { type: "subscribe" }

export type SelectedEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  id?: number;
} & TAdditionalDetail> & { type: "selected" }

export type StarEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  id: number;
  star: boolean
} & TAdditionalDetail> & { type: "star" }

export type PinEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  id: number;
  pin: boolean
} & TAdditionalDetail> & { type: "pin" }

export type MarkEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  id: number;
} & TAdditionalDetail> & { type: "mark" }

export type LeaveEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  id: number;
} & TAdditionalDetail> & { type: "leave" }

export type RemoveEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  id: number;
} & TAdditionalDetail> & { type: "remove" }

export type TrashEventType<TAdditionalDetail extends object = object> = CustomEvent<{
  id: number;
} & TAdditionalDetail> & { type: "trash" }
// Public component API events (composed: true, bubbling: false)

/**
 * App event detail data.
 */
export type WyAppEventDetailType = {
  /** The new or updated app data */
  app: AppType;
}

/**
 * Fired when app data changes.
 */
export type WyAppEventType = CustomEvent<WyAppEventDetailType> & {
  type: 'wy-app' | `wy-app-${string}`;
  bubbles: false;
  composed: true;
};

declare global {
  interface ElementEventMap {
    "wy-app": WyAppEventType,
  }
}
