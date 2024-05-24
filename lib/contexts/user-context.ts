import { createContext } from "@lit/context";
import type { UserType } from "../types/users.types";
export type { UserType } from "../types/users.types";
export const userContext = createContext<UserType | undefined>(Symbol.for("weavy-user"));
