import { createContext } from "@lit/context";
import type { UserType } from "../types/users.types";
export type { UserType } from "../types/users.types";
export const UserContext = createContext<UserType | undefined>(Symbol.for("weavy-user"));
