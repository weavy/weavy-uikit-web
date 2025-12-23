export enum ActionType {
   /* Default action when an entity is clicked or similar. */
   Default = "",
   /* Action when an entity should be selected. */
   Select = "select",
   /* Action when an entity should be starred. */
   Star = "star",
   /* Action when an entity should be unstarred. */
   Unstar = "unstar",
   /* Action when an entity should be subscribed. */
   Subscribe = "subscribe",
   /* Action when an entity should be unsubscribed. */
   Unsubscribe = "unsubscribe",
   /* Action when an entity should be pinned. */
   Pin = "pin",
   /* Action when an entity should be unpinned. */
   Unpin = "unpin",
   /* Action when an entity should be downloaded. */
   Download = "download",
   /* Action when an entity should be previewed. */
   Preview = "preview"
};