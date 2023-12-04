export type ServerErrorResponseType = {
  status: number;
  title: string;
  detail?: string;
};

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
export type NetworkState = "online" | "offline";

export type NetworkStatus = {
  isPending: boolean;
  state: "online" | "unreachable" | "offline";
}