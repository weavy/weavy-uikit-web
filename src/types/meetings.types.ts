export type MeetingType = {
  id: number;
  provider: string;
  provider_id: string;
  uuid: string;
  join_url: string;
  recording_url: string;
  ended_at: string;
};

export type MutateMeetingProps = {
  provider: string;
};
