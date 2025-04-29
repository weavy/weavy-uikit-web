import { PollParentTypes } from "./polls.types";

export type PollVoteEventType = CustomEvent<{
    optionId: number;
    parentId?: number;
    parentType?: PollParentTypes
}> & { type: "vote" }