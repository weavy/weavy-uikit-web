import { SubscribeEventType } from "./app.events";

export type PostEditEventType = CustomEvent<{
    edit: boolean;
}> & { type: "edit" }

export type PostSubscribeEventType = SubscribeEventType<{ id: number }>

export type PostTrashEventType = CustomEvent<{
    id: number;
}> & { type: "trash" }

export type PostRestoreEventType = CustomEvent<{
    id: number;
}> & { type: "restore" }