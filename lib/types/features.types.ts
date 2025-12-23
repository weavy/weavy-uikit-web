export interface ComponentFeaturePolicy {
  /** List of all enabled features, a subset of all supported features. */
  allowedFeatures(): FeatureListType;
  /** Is the provided feature enabled? */
  allowsFeature(...features: Feature[]): boolean;
  /** Is any of the provided features enabled? */
  allowsAnyFeature(...features: Feature[]): boolean;
  /** List of all supported features */
  features(): FeatureListType;
  /** Is the provided feature supported? */
  supportedFeature(...features: Feature[]): boolean;
  /** Set which features that are enabled */
  setAllowedFeatures(allowedFeatures?: string | null): FeatureListType;
}

export enum Feature {
  /**
   * Possibility to upload local files.
   */
  Attachments = "attachments",
  /**
   * Cloud file picker (Google Drive, Dropbox etc.).
   */
  CloudFiles = "cloud_files",
  /**
   * Possibility to upload context data.
   */
  ContextData = "context_data",
  /**
   * Commentary feed on entities.
   */
  Comments = "comments",
  /**
   * Creating embeds from urls in editor text.
   */
  Embeds = "embeds",
  /**
   * Google Meet video meetings.
   */
  GoogleMeet = "google_meet",
  /**
   * General availability for meetings. This can be ignored if using all individual meeting feature flags, i.e. `google_meet`, `microsoft_teams` and `zoom_meetings`.
   */
  Meetings = "meetings",
  /**
   * Possibility to mention other people from the current directory in the editor.
   */
  Mentions = "mentions",
  /**
   * Microsoft Teams video meetings.
   */
  MicrosoftTeams = "microsoft_teams",
  /**
   * Possibility to create polls in editor.
   */
  Polls = "polls",
  /**
   * Previews of files and attachments.
   */
  Previews = "previews",
  /**
   * Possibility to add emoji reactions to a message, post or comment. Disabling this feature will enable only the thumbs up reaction.
   */
  Reactions = "reactions",
  /**
   * Read receipts on messages.
   */
  Receipts = "receipts",
  /**
   * Thumbnails for file previews.
   */
  Thumbnails = "thumbnails",
  /**
   * Typing indicators in the chat when other people types.
   */
  Typing = "typing",
  /**
   *  Show file versions.
   */
  Versions = "versions",
  /**
   * Links to WebDAV functionality for document files.
   */
  WebDAV = "web_dav",
  /**
   * Zoom video meetings.
   */
  ZoomMeetings = "zoom_meetings",
}

export type FeatureListType = Feature[];


export type ComponentFeaturePolicyConfig = Partial<{
  [key in Feature]: boolean
}>