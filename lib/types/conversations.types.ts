import { AppType } from "./app.types";
import { MessageType } from "./messages.types";
import { InfiniteQueryResultType } from "./query.types";

export enum ConversationTypeGuid {
  ChatRoom = "edb400ac-839b-45a7-b2a8-6a01820d1c44",
  //ContextualChat = "d65dd4bc-418e-403c-9f56-f9cf4da931ed",
  PrivateChat = "7e14f418-8f15-46f4-b182-f619b671e470",
  BotChat = "2352a1c6-abc6-420e-8b85-ca7d5aed8779",
}

export enum ConversationTypeString {
  ChatRoom = "chat_room",
  PrivateChat = "private_chat",
  BotChat = "bot_chat",
}

export type ConversationType = AppType & {
  type: ConversationTypeGuid,
  last_message: MessageType;
  is_unread: boolean;
  is_pinned: boolean;
};

export type ConversationsResultType = InfiniteQueryResultType<ConversationType>;

export type ConversationMutationContextType = object;
