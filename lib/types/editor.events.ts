import type { SelectionRange } from "@codemirror/state";
import { PollOptionType } from "./polls.types";

// Core editor
export type EditorTextEventDetailType = {
  text: string;
};

export type EditorSelectionEventDetailType = {
  selection: SelectionRange;
};

export type EditorLoadedEventType = CustomEvent & { type: "loaded" };

export type EditorSubmitEventType = CustomEvent<EditorTextEventDetailType> & { type: "submit" };
export type EditorEditEventType = CustomEvent<EditorTextEventDetailType> & { type: "edit" };
export type EditorChangeEventType = CustomEvent<EditorTextEventDetailType> & { type: "change" };
export type EditorSelectEventType = CustomEvent<EditorTextEventDetailType & EditorSelectionEventDetailType> & { type: "select" };
export type EditorClearEventType = CustomEvent & { type: "clear" };
export type EditorTypingEventType = CustomEvent & { type: "typing" };

// MSG editor
export type MsgEditorSubmitEventDetailType = {
  text: string;
  meetingId?: number | undefined;
  blobs?: number[] | undefined;
  attachments?: number[] | undefined;
  pollOptions?: PollOptionType[] | undefined;
  embedId?: number | undefined;
  contextData?: number[] | undefined;
};


export type MsgEditorSubmitEventType = CustomEvent<MsgEditorSubmitEventDetailType> & { type: "submit" };


export type FileEditorSaveEventType = CustomEvent<EditorTextEventDetailType> & { type: "save" };
export type FileEditorDraftEventType = CustomEvent<EditorTextEventDetailType> & { type: "draft" };