import { MetadataType } from "./lists.types";

export type MeetingType = {
  id: number;
  provider: MeetingProviderType;
  provider_id: string;
  code: string,
  join_url: string;
  created_at: string;
  metadata?: MetadataType;
  auth_url: string;
};

export type MutateMeetingProps = {
  provider: MeetingProviderType;
};

export type MeetingProviderType = "zoom" | "microsoft" | "google";