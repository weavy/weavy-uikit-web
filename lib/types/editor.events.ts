import { PollOptionType } from "./polls.types";

export type EditorSubmitEventDetailType = {
    text: string;
    meetingId: number | undefined;
    blobs: number[] | undefined;
    attachments: number[];
    pollOptions: PollOptionType[];
    embed: number;
    contextData: number[] | undefined;
  };

export type EditorSubmitEventType = CustomEvent<EditorSubmitEventDetailType> & { type: "submit" }