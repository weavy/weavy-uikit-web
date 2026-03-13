export enum ActionType {
   /** Default action when an entity is clicked or similar. */
   Default = "",
   /** Action when an entity should be selected. */
   Select = "select",
   /** Action when an entity should be starred. */
   Star = "star",
   /** Action when an entity should be unstarred. */
   Unstar = "unstar",
   /** Action when an entity should be subscribed. */
   Subscribe = "subscribe",
   /** Action when an entity should be unsubscribed. */
   Unsubscribe = "unsubscribe",
   /** Action when an entity should be pinned. */
   Pin = "pin",
   /** Action when an entity should be unpinned. */
   Unpin = "unpin",
   /** Action when an entity should be followed. */
   Follow = "follow",
   /** Action when an entity should be unfollowed. */
   Unfollow = "unfollow",
   /** Action when an entity should be downloaded. */
   Download = "download",
   /** Action when an entity should be previewed. */
   Preview = "preview",
   /** Action when an entity should be opened. */
   Open = "open",
   /** Action when an entity should be edited. */
   Edit = "edit",
   /** Action when an entity should be trashed. */
   Trash = "trash",
   /** Action when an entity should be deleted forever. */
   DeleteForever = "delete-forever",
   /** Action when an entity should be restored. */
   Restore = "restore",
};