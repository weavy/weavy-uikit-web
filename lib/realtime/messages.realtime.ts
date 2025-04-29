import { WeavyComponent } from "../classes/weavy-component";
import { NamedEvent } from "../types/generic.types";
import { WyMessageEventDetailType, WyMessageEventType } from "../types/messages.events";
import { RealtimeMessageEventType } from "../types/realtime.types";

/**
 * Listener for the message realtime event which fires a `wy-message` event.
 * 
 * @fires {WyMessageEventType} wy-message
 * @param {RealtimeMessageEventType} realtimeEvent 
 * @returns 
 */
export function handleRealtimeMessage (this: WeavyComponent, realtimeEvent: RealtimeMessageEventType) {
    if (!this.weavy || !this.app) {
      return;
    }

    const messageDetail: WyMessageEventDetailType = {
      message: realtimeEvent.message,
      direction: realtimeEvent.message.created_by.id === this.user?.id ? "outbound" : "inbound",
    };

    if (realtimeEvent.message.created_by.is_bot) {
      messageDetail.bot = realtimeEvent.message.created_by.uid;
    }

    const messageEvent: WyMessageEventType = new (CustomEvent as NamedEvent)("wy-message", {
      bubbles: false,
      cancelable: false,
      composed: true,
      detail: messageDetail,
    });
    this.dispatchEvent(messageEvent);
}