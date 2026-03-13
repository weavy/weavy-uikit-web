import { PollOptionType } from "./polls.types";

// Core editor
export type EditorTextEventDetailType = {
  text: string;
};

export type EditorSubmitEventType = CustomEvent<EditorTextEventDetailType> & { type: "submit" };
export type EditorEditEventType = CustomEvent<EditorTextEventDetailType> & { type: "edit" };
export type EditorChangeEventType = CustomEvent<EditorTextEventDetailType> & { type: "change" };
export type EditorClearEventType = CustomEvent & { type: "clear" };
export type EditorTypingEventType = CustomEvent & { type: "typing" };

// MSG editor
export type MsgEditorSubmitEventDetailType = {
  text: string;
  meetingId: number | undefined;
  blobs: number[] | undefined;
  attachments: number[];
  pollOptions: PollOptionType[];
  embedId: number;
  contextData: number[] | undefined;
};


export type MsgEditorSubmitEventType = CustomEvent<MsgEditorSubmitEventDetailType> & { type: "submit" };