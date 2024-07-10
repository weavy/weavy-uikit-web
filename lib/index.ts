import { 
    ConversationTypeGuid
 } from "./types/conversations.types"

import { ContextualTypeGuids} from "./types/app.types";
import { includeReversedProperties } from "./utils/objects";

export * from "./client/weavy";

// WyContext should be first for optimal loading when used as a provider.
export { WyContext, type WyContextType } from "./wy-context";

export { WyChat, type WyChatType } from "./wy-chat";
export { WyComments, type WyCommentsType } from "./wy-comments";
export { WyFiles, type WyFilesType } from "./wy-files";
export { WyMessenger, type WyMessengerType } from "./wy-messenger";
export { WyNotifications, type WyNotificationsType } from "./wy-notifications";
export { WyNotificationToasts, type WyNotificationToastsType } from "./wy-notification-toasts";
export { WyPosts, type WyPostsType } from "./wy-posts";

export * from "./components";

// Maps for working with app guids
export const ConversationTypes = new Map(Object.entries(includeReversedProperties(ConversationTypeGuid)));
export const AppTypes = new Map(Object.entries(includeReversedProperties(ContextualTypeGuids)));