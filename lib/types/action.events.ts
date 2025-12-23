import { ActionType } from "./action.types";
import { AppRef } from "./app.types";
import { EmbedType } from "./embeds.types";

export type WyActionEventDetailType = {
  /* The type of action. A built-in action or a custom action. */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  action: ActionType | String;

  /** Embed data when the event origins from an embed. May be `null` to indicate that the embed is *none*. */
  embed?: EmbedType | null;

  /** App data when the event origins from an app item. May be `null` to indicate that the app is *none*. */
  app?: AppRef | null;

  // notification?: NotificationType;
};

/**
 * Fired when a user performs an action related to a Weavy entity such as an app, post, file, comment, message or similar.
 */
export type WyActionEventType = CustomEvent<WyActionEventDetailType> & {
  type: "wy-action";
  bubbles: true;
  composed: true;
  cancelable: true;
};

declare global {
  interface ElementEventMap {
    "wy-action": WyActionEventType;
  }
}
