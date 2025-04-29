import { MarkEventType } from "./app.events";
import { MessageType } from "./messages.types";

// Local ShadowDOM events (composed: false, bubbling: true)

export type MessagesMarkEventType = MarkEventType<{ messageId?: number | null }>

// Public component API events (composed: true, bubbling: false)

/**
 * Message event detail data.
 */
export type WyMessageEventDetailType = {
  /** The message data. */
  message: MessageType;
  /** The direction of the message. */
  direction: "inbound" | "outbound",
  /** Bot name when the message is from a bot. */
  bot?: string
}

/**
 * Fired when a message is appended to a conversation.
 */
export type WyMessageEventType = CustomEvent<WyMessageEventDetailType> & {
  type: "wy-message" | `wy-message-${string}`;
  bubbles: false;
  composed: true;
};

declare global {
  interface ElementEventMap {
    "wy-message": WyMessageEventType,
  }
}
