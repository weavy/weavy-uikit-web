import { MemberType } from "./members.types";

export type MemberSearchSubmitEventType = CustomEvent<{
    members: MemberType[];
}> & { type: "submit" }