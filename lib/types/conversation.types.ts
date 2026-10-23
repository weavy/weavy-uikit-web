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

export const DefaultMessengerFeatures: ComponentFeaturePolicyConfig = {
  // All available features as enabled/disabled by default
  [Feature.Attachments]: true,
  [Feature.Block]: false,
  [Feature.CloudFiles]: true,
  [Feature.ContextData]: true,
  [Feature.Embeds]: true,
  [Feature.Follow]: true,
  [Feature.GoogleMeet]: true,
  [Feature.Meetings]: true,
  [Feature.Mentions]: true,
  [Feature.MicrosoftTeams]: true,
  [Feature.Polls]: true,
  [Feature.Previews]: true,
  [Feature.Reactions]: true,
  [Feature.Receipts]: true,
  // opt-in because a report goes nowhere until the host handles the report_created webhook. Turn it on with the
  // `features` attribute once something is listening.
  [Feature.Report]: false,
  [Feature.Typing]: true,
  [Feature.ZoomMeetings]: true,
};