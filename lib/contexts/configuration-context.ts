import { createContext } from "@lit/context";
import type { ServerConfigurationType } from "../types/server.types";
export type { ServerConfigurationType } from "../types/server.types";
export const ServerConfigurationsContext = createContext<ServerConfigurationType | undefined>(Symbol.for("weavy-server-configuration"));
