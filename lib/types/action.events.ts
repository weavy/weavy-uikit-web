import { ActionType } from "./action.types";
import { AppRef } from "./app.types";
import { EmbedType } from "./embeds.types";
import { UserOrAgentType } from "./users.types";

export type WyActionEventDetailType = {
  /* The type of action. A built-in action or a custom action. */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  action: ActionType | String;

  /** Embed data when the event origins from an embed. May be `null` to indicate that the embed is *none*. */
  embed?: EmbedType | null;

  /** App data when the event origins from an app item. May be `null` to indicate that the app is *none*. */
  app?: AppRef | null;

  /** App data when the event origins from a referenced user or agent, such as a message author or a mention. Contains at least `id` and `name` when set. May be `null` to indicate that the user is *none*.*/
  user?: UserOrAgentType | null;

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

/** Type guard for action events */
export function isActionEvent(e: Event | WyActionEventType): e is WyActionEventType {
  return (e as WyActionEventType) instanceof CustomEvent && typeof (e as WyActionEventType).detail.action === "string";
}