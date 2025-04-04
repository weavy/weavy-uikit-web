import { MessageType } from "./messages.types";

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
