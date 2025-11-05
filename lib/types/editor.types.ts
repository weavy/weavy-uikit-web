import { EmbedType } from "./embeds.types";
import { MeetingType } from "./meetings.types";
import { PollOptionType } from "./polls.types";

export type EditorDraftType = {
  meeting: MeetingType | undefined;
  text: string | undefined;
  pollOptions: PollOptionType[];
  embeds: EmbedType[];
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