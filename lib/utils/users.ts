import { WyActionEventType } from "../types/action.events";
import { ActionType } from "../types/action.types";
import { NamedEvent } from "../types/generic.types";
import { UserOrAgentType } from "../types/users.types";

export function dispatchUserAction(this: HTMLElement, user: UserOrAgentType, action: ActionType = ActionType.Preview) {
  const event: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
    detail: {
      action,
      user,
    },
    composed: true,
    bubbles: true,
    cancelable: true,
  });
  this.dispatchEvent(event);
}
