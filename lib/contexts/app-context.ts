import { createContext } from "@lit/context";
import type { AppType } from "../types/app.types";
export type { AppType } from "../types/app.types";
export const AppContext = createContext<AppType | undefined>(Symbol.for("weavy-app"));
