export enum Feature {
  Attachments = "Attachments",
  CloudFiles = "CloudFiles",
  Embeds = "Embeds",
  Meetings = "Meetings",
  Mentions = "Mentions",
  Polls = "Polls",
  Previews = "Previews",
  Reactions = "Reactions",
  Receipts = "Receipts",
  Thumbnails = "Thumbnails",
  Typing = "Typing",
  Webhooks = "Webhooks",
  Comments = "Comments",
  Versions = "Versions",
  WebDAV = "WebDAV",
}

export type FeatureType = keyof typeof Feature;
export type FeaturesListType = Feature[];

/**
 * The `features` config is an opt-out config only. 
 * The features is set by the current license model on the product. 
 * You can only disable features that are available. 
 * You can never enable a feature if it's not included in the license model.
 */
export type FeaturesConfigType = {
  /**
   * Disable the possibility to upload local files.
   */
  attachments?: boolean;
  /**
   * Disable he cloud file picker (Google Drive, Dropbox etc.).
   */
  cloudFiles?: boolean;
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
  thumbnails?: boolean;
  /**
   * Disable the typing indicator in the chat when other people types.
   */
  typing?: boolean;
  /**
   * Disable comments on posts/files.
   */
  comments?: boolean;
  /**
   *  Disable file versions.
   */
  versions?: boolean;
  /**
   * Disable webDAV functionality for document files.
   */
  webDAV?: boolean;
};
