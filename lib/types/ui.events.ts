// TODO: Make global open/close events
/**
 * Fired when a component is hidden.
 */
export type HideEventType = CustomEvent & { type: "hide" };

/**
 * Fired when a component is closed.
 */
export type CloseEventType = CustomEvent & { type: "close" };

/**
 * Fired when a component is closed
 */
export type ClosedEventType = CustomEvent<{
  /** Whether to silence (not perform) actions after the event. */
  silent: boolean 
}> & { type: "closed" };

/**
 * Unread event detail data.
 */
export type WyUnreadEventDetailType = {
  /** The number of unread items */
  unread: number;
}

/**
 * Fired when app data changes.
 */
export type WyUnreadEventType = CustomEvent<WyUnreadEventDetailType> & {
  type: 'wy-unread';
  bubbles: false;
  composed: true;
};

declare global {
  interface GlobalEventHandlersEventMap {
    
    /**
     * A 'wy-unread' event can be emitted when the underlying number of unread items change.
     */
    "wy-unread": WyUnreadEventType
  }
}