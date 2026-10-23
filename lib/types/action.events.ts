import { ActionKindType, ActionType } from "./action.types";
import { AppRef } from "./app.types";
import { EmbedType } from "./embeds.types";
import { FileType } from "./files.types";
import { NotificationType } from "./notifications.types";
import { UserOrAgentType } from "./users.types";

export type WyActionEventDetailType = {
  /** The type of action. A built-in action or a custom action. */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  action: ActionType | String;

  /** Embed data when the event origins from an embed. May be `null` to indicate that the embed is *none*. */
  embed?: EmbedType | null;

  /** File data when the event origins from a file. May be `null` to indicate that the file is *none*. */
  file?: FileType | null;

  /** App data when the event origins from an app item. May be `null` to indicate that the app is *none*. */
  app?: AppRef | null;

  /** User data when the event origins from a referenced user or agent, such as a message author or a mention. Contains at least `id` and `name` when set. May be `null` to indicate that the user is *none*.*/
  user?: UserOrAgentType | null;

  /** Notification data when the event origins from a notification. */
  notification?: NotificationType | null;
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
export function isActionEvent(e: Event | WyActionEventType, kind?: ActionKindType, ...actions: ActionType[]): e is WyActionEventType {
  let isAction = (e as WyActionEventType) instanceof CustomEvent && typeof (e as WyActionEventType).detail.action === "string";

  if (isAction && kind) {
    isAction = (e as WyActionEventType).detail[kind] !== undefined
  }

  if (isAction && actions && actions.length) {
    isAction = actions.some((action) => (e as WyActionEventType).detail.action === action)
  }

  return isAction;
}