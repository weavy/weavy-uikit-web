import { createContext } from "@lit/context";
import type { AgentType } from "../types/users.types";
export type { AgentType } from "../types/users.types";
export const AgentContext = createContext<AgentType | undefined>(Symbol.for("weavy-agent-user"));
