export type CommentTrashEventType = CustomEvent<{
    id: number;
}> & { type: "trash" }

export type CommentRestoreEventType = CustomEvent<{
    id: number;
}> & { type: "restore" }