import { AppTypeGuid, AppTypeString } from "./app.types";
import { ComponentFeaturePolicyConfig, Feature } from "./features.types";

/**
 * The conversation app type strings and app type guids associated with the Messenger.
 */
export const MessengerTypes = new Map(
  Object.entries({
    [AppTypeString.ChatRoom]: AppTypeGuid.ChatRoom,
    [AppTypeString.PrivateChat]: AppTypeGuid.PrivateChat,
    [AppTypeGuid.ChatRoom]: AppTypeString.ChatRoom,
    [AppTypeGuid.PrivateChat]: AppTypeString.PrivateChat,
  })
);

/**
 * The conversation app type strings and app type guids specific for agents in Messenger.
 */
export const MessengerAgentTypes = new Map(
  Object.entries({
    [AppTypeString.AgentChat]: AppTypeGuid.AgentChat,
    [AppTypeGuid.AgentChat]: AppTypeString.AgentChat,
  })
);

export const DefaultMessengerFeatures: ComponentFeaturePolicyConfig = {
  // All available features as enabled/disabled by default
  [Feature.Attachments]: true,
  [Feature.CloudFiles]: true,
  [Feature.ContextData]: true,
  [Feature.Embeds]: true,
  [Feature.GoogleMeet]: true,
  [Feature.Meetings]: true,
  [Feature.Mentions]: true,
  [Feature.MicrosoftTeams]: true,
  [Feature.Polls]: true,
  [Feature.Previews]: true,
  [Feature.Reactions]: true,
  [Feature.Receipts]: true,
  [Feature.Typing]: true,
  [Feature.ZoomMeetings]: true,
};

export const DefaultMessengerAgentFeatures: ComponentFeaturePolicyConfig = {
  // All available features as enabled/disabled by default
  [Feature.Attachments]: true,
  [Feature.ContextData]: true,
  [Feature.Embeds]: true,
  [Feature.Previews]: true,
  [Feature.Reactions]: false,
  [Feature.Receipts]: true,
  [Feature.Typing]: true,
};