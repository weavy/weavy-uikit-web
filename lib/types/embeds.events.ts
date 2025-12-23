export type EmbedRemoveEventType = CustomEvent<{ id: number }> & { type: "embed-remove", bubbles: false, composed: false }

export type EmbedSwapEventType = CustomEvent & { type: "embed-swap", bubbles: false, composed: false }
