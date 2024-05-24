import { createContext } from "@lit/context";
import type { ServerConfigurationType } from "../types/server.types";
export type { ServerConfigurationType } from "../types/server.types";
export const serverConfigurationsContext = createContext<ServerConfigurationType | undefined>(Symbol.for("weavy-server-configuration"));
