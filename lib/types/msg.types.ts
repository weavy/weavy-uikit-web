import { AppRef, EntityType } from "./app.types";
import { EmbedType } from "./embeds.types";
import { FilesResultType } from "./files.types";
import { MetadataType } from "./lists.types";
import { MeetingType } from "./meetings.types";
import { PollOptionsResultType } from "./polls.types";
import { ReactionsResultType } from "./reactions.types";
import { UserType } from "./users.types";

/* Base type for Comment, Message, Post etc */
export type MsgType = {
  /** The id of the entity */
  id: number;
  /** The app where the message is located */
  app: AppRef;
  /** The parent object of the message (if any). */
  parent?: EntityType;
  /** The message text. */
  text: string;
  /** The message text as html. */
  html: string;
  /** The message text with all formatting stripped. */
  plain: string;
  /** Any *Embed* attached to the message. */
  embed?: EmbedType;
  /** Any *Meeting* attached to the message. */
  meeting?: MeetingType;
  /** Paged list of any attached files. */
  attachments?: FilesResultType;
  /** Paged list of any poll options. */
  options?: PollOptionsResultType;
  /** Paged list of reactions to the message. */
  reactions: ReactionsResultType;
  /** Any additional metadata. */
  metadata?: MetadataType;
  /** List of any tags. */
  tags?: string[];
  /** If the authenticated user has starred the entity. */
  is_starred: boolean;
  /** If the authenticated user has subscribed to the entity. */
  is_subscribed: boolean;
  /** If the message is trashed. */
  is_trashed: boolean;
  /** Date and time (UTC) the entity was created. */
  created_at: string;
  /** The user that created the entity. */
  created_by: UserType;
  /** Date and time (UTC) the notification was last modified. */
  updated_at?: string;
  /** The user that modified the entity. */
  updated_by?: UserType;
};