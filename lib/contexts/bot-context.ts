import { createContext } from "@lit/context";
import type { BotType } from "../types/users.types";
export type { BotType } from "../types/users.types";
export const BotContext = createContext<BotType | undefined>(Symbol.for("weavy-bot-user"));
