export enum ProductTypes {
  Chat = "chat",
  Comments = "comments",
  Feeds = "feeds",
  Files = "files",
  Messenger = "messenger",
}

export enum ProductFeatures {
  Attachments = "attachments",
  CloudFiles = "cloud_files",
  Comments = "comments",
  Confluence = "confluence",
  Embeds = "embeds",
  GoogleMeet = "google_meet",
  Mentions = "mentions",
  MicrosoftTeams = "microsoft_teams",
  Polls = "polls",
  Previews = "previews",
  Reactions = "reactions",
  Receipts = "receipts",
  Thumbnails = "thumbnails",
  Typing = "typing",
  Versions = "versions",
  WebDAV = "web_dav",
  //Webhooks = "webhooks",
  ZoomMeetings = "zoom_meetings",
}

export type ProductFeaturesListType = ProductFeatures[];

/**
 * The `features` config is an opt-out config only.
 * The features is set by the current license model on the product.
 * You can only disable features that are available.
 * You can never enable a feature if it's not included in the license model.
 */
export type ProductFeaturesType = {
  /**
   * Whether the possibility to upload local files is enabled.
   */
  attachments?: boolean;
  /**
   * Whether the cloud file picker (Google Drive, Dropbox etc.) is enabled.
   */
  cloudFiles?: boolean;
  /**
   * Whether comments on posts/files is enabled.
   */
  comments?: boolean;
  /**
   * Whether confluence picker is enabled.
   */
  confluence?: boolean;
  /**
   * Whether creating embeds from urls in the post text is enabled.
   */
  embeds?: boolean;
  /**
   * Whether Google Meet is enabled.
   */
  googleMeet?: boolean;
  /**
   * Whether the possibility to mention other people in the directory in a file comment is enabled.
   */
  mentions?: boolean;
  /**
   * Whether Microsoft Teams is enabled.
   */
  microsoftTeams?: boolean;
  /**
   * Whether the possibility to create a poll is enabled.
   */
  polls?: boolean;
  /**
   * Whether previews of files is enabled.
   */
  previews?: boolean;
  /**
   * Whether the possibility to add emoji reactions to a message, post or comment is enabled. Setting this to `false` will enable only the thumbs up reaction.
   */
  reactions?: boolean;
  /**
   * Whether read receipts on messages is enabled.
   */
  receipts?: boolean;
  /**
   * Whether thumbnail file previews is enabled.
   */
  thumbnails?: boolean;
  /**
   * Whether the typing indicator in the chat when other people types is enabled.
   */
  typing?: boolean;
  /**
   *  Whether file versions is enabled.
   */
  versions?: boolean;
  /**
   * Whether WebDAV functionality for document files is enabled.
   */
  webDAV?: boolean;
  /**
   * Whether Zoom meetings is enabled.
   */
  zoomMeetings?: boolean;
};

/**
 * The `features` config is an opt-out config only.
 * The features is set by the current license model on the product.
 * You can only disable features that are available.
 * You can never enable a feature if it's not included in the license model.
 */
export type ProductFeatureProps = {
  /**
   * Disable the possibility to upload local files.
   */
  noAttachments?: boolean;
  /**
   * Disable he cloud file picker (Google Drive, Dropbox etc.).
   */
  noCloudFiles?: boolean;
  /**
   * Disable comments on posts/files.
   */
  noComments?: boolean;
  /**
   * Disable confluence picker.
   */
  noConfluence?: boolean;
  /**
   * Disable creating embeds from urls in the post text.
   */
  noEmbeds?: boolean;
  /**
   * Disable Google Meet.
   */
  noGoogleMeet?: boolean;
  /**
   * Disable the possibility to mention other people in the directory in a file comment.
   */
  noMentions?: boolean;
  /**
   * Disable Microsoft Teams.
   */
  noMicrosoftTeams?: boolean;
  /**
   * Disable the possibility to create a poll.
   */
  noPolls?: boolean;
  /**
   * Disable previews of files.
   */
  noPreviews?: boolean;
  /**
   * Disable the possibility to add emoji reactions to a message, post or comment. Setting this to `false` will enable only the thumbs up reaction.
   */
  noReactions?: boolean;
  /**
   * Disable read receipts on messages.
   */
  noReceipts?: boolean;
  /**
   * Disable thumbnail file previews.
   */
  noThumbnails?: boolean;
  /**
   * Disable the typing indicator in the chat when other people types.
   */
  noTyping?: boolean;
  /**
   *  Disable file versions.
   */
  noVersions?: boolean;
  /**
   * Disable webDAV functionality for document files.
   */
  noWebDAV?: boolean;
  /**
   * Disable Zoom meetings.
   */
  noZoomMeetings?: boolean;
};

export const ProductFeatureMapping: { [key: string]: keyof ProductFeaturesType } = {
  attachments: "attachments",
  cloud_files: "cloudFiles",
  comments: "comments",
  confluence: "confluence",
  embeds: "embeds",
  google_meet: "googleMeet",
  mentions: "mentions",
  microsoft_teams: "microsoftTeams",
  polls: "polls",
  previews: "previews",
  reactions: "reactions",
  receipts: "receipts",
  thumbnails: "thumbnails",
  typing: "typing",
  versions: "versions",
  web_dav: "webDAV",
  zoom_meetings: "zoomMeetings",
};

export const ProductFeaturePropMapping: { [key: string]: keyof ProductFeatureProps } = {
  attachments: "noAttachments",
  cloud_files: "noCloudFiles",
  comments: "noComments",
  confluence: "noConfluence",
  embeds: "noEmbeds",
  google_meet: "noGoogleMeet",
  mentions: "noMentions",
  microsoft_teams: "noMicrosoftTeams",
  polls: "noPolls",
  previews: "noPreviews",
  reactions: "noReactions",
  receipts: "noReceipts",
  thumbnails: "noThumbnails",
  typing: "noTyping",
  versions: "noVersions",
  web_dav: "noWebDAV",
  zoom_meetings: "noZoomMeetings",
};
