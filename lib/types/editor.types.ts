import { EmbedType } from "./embeds.types";
import { MeetingType } from "./meetings.types";
import { PollOptionType } from "./polls.types";

export type EditorDraftType = {
  meeting: MeetingType | undefined;
  text: string | undefined;
  pollOptions: PollOptionType[];
  embeds: EmbedType[];
};

