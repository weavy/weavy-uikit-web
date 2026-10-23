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
   * Possibility to block and unblock other users. Blocking is one-way and receive-side: it quiets the blocker's side of
   * the relationship, while the blocked user sees and sends as before and is never told.
   */
  Block = "block",
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
   * Possibility to create new comments.
   */
  Comment = "comment",
  /**
   * Creating embeds from urls in editor text.
   */
  Embeds = "embeds",
  /**
   * Possibility to create new files.
   */
  FileCreate = "file_create",
  /**
   * Possibility to edit files.
   */
  FileEdit = "file_edit",
  /**
   * Possibility to rename files.
   */
  FileRename = "file_rename",
  /**
   * Possibility to upload files.
   */
  FileUpload = "file_upload",
  /**
   * Possibility to follow or unfollow users. 
   */
  Follow = "follow",
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
   * Possibility to report a message, post, comment or user for moderation. Weavy stores the report and emits a `report_created`
   * webhook; acting on it is up to the host application, so this feature is **disabled by default** and must be
   * opted into with the `features` attribute once you have somewhere for reports to go.
   */
  Report = "report",
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