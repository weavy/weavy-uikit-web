import { Completion } from "@codemirror/autocomplete";
import { AccessType } from "./app.types";

interface MentionsCompletion extends Completion {
  item?: {
    is_member: boolean;
    avatar_url: string;
    name: string;
    access: AccessType;
  };
}

export type { MentionsCompletion };
