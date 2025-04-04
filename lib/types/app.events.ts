import { AppType } from "./app.types";

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
