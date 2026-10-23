import { EmbedType } from "./embeds.types";
import { MeetingType } from "./meetings.types";
import { PollOptionType } from "./polls.types";

export type EditorDraftType = {
  text: string | undefined;
  meeting?: MeetingType | undefined;
  pollOptions?: PollOptionType[];
  embeds?: EmbedType[];
  updatedAt: string;
};

export type EnterToSend = 
  /** No keymap */
  "never" |
  /** Mod+Enter */
  "modifier" |
  /** Mod+Enter for all. Enter for "messages" on desktop. */
  "auto" |
  /** Mod+Enter and Enter for all. */
  "always";