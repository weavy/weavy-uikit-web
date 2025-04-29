export type EmbedRemoveEventType = CustomEvent<{ id: number }> & { type: "embed-remove"}

export type EmbedSwapEventType = CustomEvent & { type: "embed-swap"}