export enum Feature {
  Attachments = "attachments",
  CloudFiles = "cloud_files",
  Comments = "comments",
  Confluence = "confluence",
  Embeds = "embeds",
  Meetings = "meetings",
  Mentions = "mentions",
  Polls = "polls",
  Previews = "previews",
  Reactions = "reactions",
  Receipts = "receipts",
  Thumbnails = "thumbnails",
  Typing = "typing",
  Versions = "versions",
  WebDAV = "web_dav",
  //Webhooks = "webhooks",
}

export type FeaturesListType = Feature[];

/**
 * The `features` config is an opt-out config only.
 * The features is set by the current license model on the product.
 * You can only disable features that are available.
 * You can never enable a feature if it's not included in the license model.
 */
export type FeaturesType = {
  /**
   * Disable the possibility to upload local files.
   */
  attachments?: boolean;
  /**
   * Disable he cloud file picker (Google Drive, Dropbox etc.).
   */
  cloudFiles?: boolean;
  /**
   * Disable comments on posts/files.
   */
  comments?: boolean;
  /**
   * Disable confluence picker.
   */
  confluence?: boolean;
  /**
   * Disable creating embeds from urls in the post text.
   */
  embeds?: boolean;
  /**
   * Disable Zoom meetings.
   */
  meetings?: boolean;
  /**
   * Disable the possibility to mention other people in the directory in a file comment.
   */
  mentions?: boolean;
  /**
   * Disable the possibility to create a poll.
   */
  polls?: boolean;
  /**
   * Disable previews of files.
   */
  previews?: boolean;
  /**
   * Disable the possibility to add emoji reactions to a message, post or comment. Setting this to `false` will enable only the thumbs up reaction.
   */
  reactions?: boolean;
  /**
   * Disable read receipts on messages.
   */
  receipts?: boolean;
  /**
   * Disable thumbnail file previews.
   */
  thumbnails?: boolean;
  /**
   * Disable the typing indicator in the chat when other people types.
   */
  typing?: boolean;
  /**
   *  Disable file versions.
   */
  versions?: boolean;
  /**
   * Disable webDAV functionality for document files.
   */
  webDAV?: boolean;
};

/**
 * The `features` config is an opt-out config only.
 * The features is set by the current license model on the product.
 * You can only disable features that are available.
 * You can never enable a feature if it's not included in the license model.
 */
export type FeatureProps = {
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
   * Disable Zoom meetings.
   */
  noMeetings?: boolean;
  /**
   * Disable the possibility to mention other people in the directory in a file comment.
   */
  noMentions?: boolean;
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
};


export enum FeaturesProductType {
  Chat = "chat",
  Comments = "comments",
  Feeds = "feeds",
  Files = "files",
  Messenger = "messenger"
}

export const FeatureMapping: { [key: string]: keyof FeaturesType} = {
  "attachments": "attachments",
  "cloud_files": "cloudFiles",
  "comments": "comments",
  "confluence": "confluence",
  "embeds": "embeds",
  "meetings": "meetings",
  "mentions": "mentions",
  "polls": "polls",
  "previews": "previews",
  "reactions": "reactions",
  "receipts": "receipts",
  "thumbnails": "thumbnails",
  "typing": "typing",
  "versions": "versions",
  "web_dav": "webDAV",
}

export const FeaturePropMapping: { [key: string]: keyof FeatureProps} = {
  "attachments": "noAttachments",
  "cloud_files": "noCloudFiles",
  "comments": "noComments",
  "confluence": "noConfluence",
  "embeds": "noEmbeds",
  "meetings": "noMeetings",
  "mentions": "noMentions",
  "polls": "noPolls",
  "previews": "noPreviews",
  "reactions": "noReactions",
  "receipts": "noReceipts",
  "thumbnails": "noThumbnails",
  "typing": "noTyping",
  "versions": "noVersions",
  "web_dav": "noWebDAV",
}