import { EntityType } from "./app.types";
import { EmbedType } from "./embeds.types";
import { FileType } from "./files.types";
import { MeetingType } from "./meetings.types";
import { MemberType } from "./members.types";
import { PollOptionType } from "./polls.types";
import { ReactableType } from "./reactions.types";

/* Base type for Comment, Message, Post etc */
export type MsgType = {
    id: number;
    app_id: number;
    parent?: EntityType;
    text: string;
    html: string;
    plain: string;
    created_at: string;
    created_by: MemberType;
    created_by_id: number;
    modified_at?: string;
    modified_by?: MemberType;
    modified_by_id?: number;
    trashed_at?: string;
    trashed_by?: MemberType;
    attachments: FileType[];
    attachment_ids?: number[]; // Non-existent?
    attachment_count?: number;
    embed?: EmbedType;
    embed_id?: number;
    meeting?: MeetingType;
    meeting_id?: number;
    reactions: ReactableType[];
    is_trashed: boolean;
    options?: PollOptionType[];
    option_count?: number;
    metadata?: MetadataType;
}
  
  export type MetadataType = {
    [Key: string]: string
  }