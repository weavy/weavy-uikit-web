export type CommentEditEventType = CustomEvent<{
    edit: boolean;
}> & { type: "edit" }

export type CommentTrashEventType = CustomEvent<{
    id: number;
}> & { type: "trash" }

export type CommentRestoreEventType = CustomEvent<{
    id: number;
}> & { type: "restore" }