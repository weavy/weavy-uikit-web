import { MemberIdType } from "./members.types";

export type CreateConversationEventType = CustomEvent<{
    members: MemberIdType[];
}> & { type: "create" }
