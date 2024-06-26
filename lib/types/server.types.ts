export type ServerErrorResponseType = {
  status: number;
  title: string;
  detail?: string;
};

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
export type ServerState = "ok" | "unauthorized" | "unreachable";
export type NetworkState = "online" | "offline";

export type NetworkStatus = {
  isPending: boolean;
  state: "online" | "unreachable" | "offline";
}

export type ServerConfigurationType = {
  zoom_authentication_url?: string;
}