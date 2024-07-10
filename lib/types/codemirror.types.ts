import { Completion } from "@codemirror/autocomplete";
import { AccessTypes } from "./app.types";

interface MentionsCompletion extends Completion {
  item?: {
    is_member: boolean;
    avatar_url: string;
    display_name: string;
    access: AccessTypes
  };
}

export type { MentionsCompletion };
