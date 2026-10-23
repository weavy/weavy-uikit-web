import { html, nothing, type PropertyValues } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { AppTypeGuid } from "./types/app.types";
import type { FileOrderType, FileViewType } from "./types/files.types";
import type { DropFilesEventType } from "./types/files.events";
import { DropZoneController } from "./controllers/dropzone-controller";
import { localized, msg } from "@lit/localize";
//import { HistoryController } from './controllers/history-controller'
import { PersistStateController } from "./controllers/persist-state-controller";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyAppComponent } from "./classes/weavy-app-component";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { OrderEventType, ShowTrashedEventType, ViewEventType } from "./types/lists.events";
import { SubscribeEventType } from "./types/app.events";
import { partMap } from "./utils/directives/shadow-part-map";
import { CreateFilesController } from "./controllers/create-files-controller";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { normalizeAppearanceMode, type AppearanceModeType } from "./types/ui.types";
import { isActionEvent, WyActionEventType } from "./types/action.events";
import { ActionKindType, ActionType } from "./types/action.types";

import dropZoneCss from "./scss/components/dropzone.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostFillCss from "./scss/host-fill.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";
import colorModesCss from "./scss/color-modes.scss";

import "./components/wy-files-header";
import "./components/wy-files-list";
import "./components/wy-user-card";
import { WyFilesList } from "./components/wy-files-list";

declare global {
  interface HTMLElementTagNameMap {
    "wy-files": WyFiles;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyActionEventType } from "./types/action.events"
 * @import { WyPreviewOpenEventType } from "./types/files.events"
 * @import { WyPreviewCloseEventType } from "./types/files.events"
 */

/**
 * Weavy files component to render a list of uploaded files and linked files from cloud providers such as Google Drive, Dropbox, Box and Microsoft OneDrive.
 *
 * Supports upload of multiple large files at once, upload using drag'n'drop and pasting files to upload.
 * File upload progress can be monitored and aborted.
 * The files can be downloaded individually or as a compressed archive.
 *
 * Includes file picker to link files from Cloud providers such as Google Drive, Dropbox, Box and Microsoft OneDrive, which are pre configured when using default weavy.io hosting for the Weavy environment.
 *
 * Images, audio, video, documents, code, and cloud files can be previewed with the built-in previewer for 100+ formats including streamed audio/video, PDF, Office and Google Drive.
 * Files can also be listed with miniature thumbnails for visual overview.
 *
 * The list can be displayed as a table or as a grid with sorting capabilities.
 * Files can renamed directly in the list.
 *
 * Each file can be discussed with rich comments with support for attachments, mentions, embedded links and more.
 *
 * File uploads are automatically versioned with possibility to preview all versions and rollback to a specific version.
 *
 * Office documents and spreadsheets can be opened and edited directly in Office using built-in [WebDAV](https://www.weavy.com/docs/learn/integrations/webdav) integration to automatically save new version back to the app.
 *
 * Each files component requires an app identifier (`uid`), which automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's also recommended to specify a readable `name` of the files app, to get better readable notifications from the app.
 *
 * > It's often useful to base the `uid` on something that identifies the location where the component is rendered.
 * > Typically you would use something like a product id, page id or path.
 *
 * **Component Layout**
 *
 * The component is [block-level](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content) with pre-defined CSS styling to adapt to flex- and grid-layouts as well as traditional flow-layouts.
 * It's usually recommended to use a proper flex-layout for the container you are placing the component in for a smooth layout integration.
 *
 * The height grows with the content per default. Content is automatically loaded during scrolling when the last content becomes visible (aka infinite scrolling).
 * If placed in a flex- or grid-layout or if an explicit height is set, the component becomes scrollable.
 *
 * The content within the components is per default aligned to the edges of it's own _box_ and designed to not be placed next to a edge or border.
 * It's recommended to adjust the layout with your default padding. Setting the `--wy-padding-outer` to your default padding will allow the component to still fill the are where it's placed,
 * but with proper padding within the scrollable area of the component.
 * If you want to make the component go all the way to the edges without padding or any outermost roundness instead,
 * set `--wy-padding-outer: 0;` and `--wy-border-radius-outer: 0;` to make the component fit nicely with the edge.
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
 *
 * **Used sub components:**
 *
 * - [`<wy-files-header>`](./components/wy-files-header.ts)
 * - [`<wy-files-list>`](./components/wy-files-list.ts)
 *
 * @tagname wy-files
 * @csspart wy-files - Main layout wrapper.
 * @csspart wy-dragging - Modifier for the main layout when dragging over.
 * @slot actions - Buttons placed in the toolbar.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an entity.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 *
 * @example <caption>Standard files list with upload</caption>
 *
 * Displays a table files list with integrated uploading, cloud picker, previews, comments and versioning.
 *
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's recommended to specify a readable `name` of the files app, to get better readable notifications from the app.
 *
 * ```html
 * <wy-files uid="test-files" name="Test files"></wy-files>
 * ```
 *
 * @example <caption>Files list with grid display sorted by date</caption>
 *
 * Displays a `grid` view with miniature thumbnails for each file. Files ar sorted by `updated_at` in reverse order.
 *
 * ```html
 * <wy-files
 *   uid="test-files"
 *   name="Test files"
 *   view="grid"
 *   order="{ by: 'updated_at', descending: true }"
 * ></wy-files>
 * ```
 * 
 * @example <caption>Files list without header connected to a `<wy-file>` view</caption>
 * 
 * Displays a table files list without the header bar (`header="none"` attribute). Instead of opening the preview, all files are opened in a separate [file view](xref:uikit-file).
 * 
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](xref:concepts#app) on your Weavy environment when the component is first initialized. It's recommended to specify a readable `name` of the posts app, to get better readable notifications from the app.
 * 
 * ```html
 * <wy-files id="files-list" uid="test-files" header="none"></wy-files>
 * <wy-file id="file-view" uid="test-files"></wy-file>
 * <script>
 *   const filesList = document.getElementById("files-list");
 *   const fileView = document.getElementById("file-view");
 *   filesList.addEventListener("wy-action", (e) => {
 *       if (
 *         // Check for `file`
 *         e.detail.file &&
 *         // Check for file specific actions
 *         /select|preview|edit|comment|history/.test(e.detail.action)
 *       ) {
 *         // Prevent default to stop the preview overlay from showing
 *         // Note: This _must_ be done in the `capture` phase of the event
 *         e.preventDefault();
 * 
 *         // Set the file id to show
 *         fileView.fileId = e.detail.file.id;
 * 
 *         // Set edit mode to enable opening directly into edit
 *         fileView.edit = e.detail.action === "edit";
 * 
 *         // Optionally set tab to "comments" or "versions" to open these panels directly.
 *         fileView.tab =
 *           e.detail.action === "comment"
 *             ? "comments"
 *             : e.detail.action === "history"
 *               ? "versions"
 *               : undefined;
 *       }
 *     },
 *     // It's important to use the `capture` phase to be able to prevent the default event action.
 *     { capture: true },
 *   );
 * </script>
 * ```
 */
@customElement("wy-files")
@localized()
export class WyFiles extends WeavyAppComponent {
  static override styles = [
    dropZoneCss,
    colorModesCss,
    hostBlockCss,
    hostFillCss,
    hostPaddedCss,
    hostFontCss,
    hostScrollYCss,
  ];

  /** @internal */
  override appType = AppTypeGuid.Files;

  /** @internal */
  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.CloudFiles]: true,
    [Feature.Comments]: true,
    [Feature.Comment]: true,
    [Feature.ContextData]: true,
    [Feature.Embeds]: true,
    [Feature.FileCreate]: true,
    [Feature.FileEdit]: true,
    [Feature.FileRename]: true,
    [Feature.FileUpload]: true,
    [Feature.Follow]: true,
    [Feature.GoogleMeet]: false,
    [Feature.Meetings]: false,
    [Feature.Mentions]: true,
    [Feature.MicrosoftTeams]: false,
    [Feature.Polls]: true,
    [Feature.Previews]: true,
    [Feature.Reactions]: true,
    [Feature.Report]: false,
    [Feature.Typing]: false, // Has no effect currently
    [Feature.Versions]: true,
    [Feature.WebDAV]: true,
    [Feature.ZoomMeetings]: false,
  });

  /** @internal */
  protected theme = new ThemeController(this, WyFiles.styles);

  /**
   * The view for showing the file list. Persisted in sessionStorage.
   *
   * @type {"grid" | "list"}
   * @default "list"
   */
  @property()
  view: FileViewType = "list";

  /**
   * Appearance of the file list header.
   * @type {"interactive" | "empty" | "none"}
   * @default "interactive"
   */
  @property()
  header: AppearanceModeType = "interactive";

  /**
   * File order in the list. Persisted in sessionStorage.
   */
  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * Enables showing trashed files. Persisted in sessionStorage.
   */
  @property({ type: Boolean })
  showTrashed: boolean = false;

  /**
   * Placeholder text for the comment editor input.
   */
  @property()
  placeholder?: string;

  /**
   * File id that is selected.
   */
  @property({ type: Number })
  selectedId?: number = NaN;

  /**
   * File id to load, scroll into view and highlight.
   */
  @property({ type: Number })
  highlightId?: number = NaN;

  /** @internal */
  private persistState = new PersistStateController(this);

  /** @internal */
  private dropZone: DropZoneController = new DropZoneController(this);

  private createFilesController = new CreateFilesController(this);

  /**
   * Reference to the files list component.
   * @internal
   */
  private filesListRef: Ref<WyFilesList> = createRef();

  /**
   * Open a file in preview/edit. Optionally opens "comment" tab or "versions" tab.
   *
   * @param fileId - The id of the file to open
   * @param options.edit - Optional edit mode
   * @param options.tab - Optional tab to open in preview
   */
  preview(fileId: number, options: { edit?: boolean; tab?: "comments" | "versions" }) {
    void this.filesListRef.value?.preview(fileId, options);
  }

  constructor() {
    super();
    this.addEventListener("drop-files", (e) => {
      if (this.componentFeatures?.allowsFeature(Feature.FileUpload)) {
        void this.createFilesController.uploadFiles((e as DropFilesEventType).detail.files).then((files) => {
          // Select the last uploaded file. Nothing is shown as selected if it is outside the loaded pages.
          const lastFile = files?.findLast((file) => file);
          if (lastFile) {
            this.selectedId = lastFile.id;
          }
        });
      }
    });
  }

  protected override async willUpdate(changedProperties: PropertyValues<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    //console.log("files willUpdate", Array.from(changedProperties.keys()), this.uid, this.weavy)
    if (
      (changedProperties.has("uid") || changedProperties.has("weavy") || changedProperties.has("user")) &&
      this.uid &&
      this.weavy &&
      this.user
    ) {
      this.persistState.observe(
        [
          { name: "view", override: true },
          { name: "order", override: true },
          { name: "showTrashed", override: true },
        ],
        this.uid.toString(),
        `u${this.user.id}`,
      );
      //this.history.observe(['view'], this.uid.toString())
    }
  }

  protected override render() {
    const isDragActive = this.componentFeatures?.allowsFeature(Feature.FileUpload) && this.dropZone.isDragActive;
    const header = normalizeAppearanceMode(this.header);

    return html`
      <div part="wy-files ${partMap({ "wy-dragging": isDragActive })}" data-drag-title=${msg("Drop files here")}>
        ${header !== "none"
          ? html`
              <wy-files-header
                .header=${header}
                .order=${this.order}
                .showTrashed=${this.showTrashed}
                .view=${this.view}
                @wy-action=${(e: WyActionEventType) => {
                  if (e.detail.file && e.detail.action === ActionType.Edit) {
                    this.preview(e.detail.file.id, { edit: true });
                  } else if (isActionEvent(e, ActionKindType.File) && e.detail.file && e.detail.action === ActionType.Select) {
                    // Only selects the created file. It is not highlighted, because loading the list around a
                    // file outside the loaded pages makes the infinite pagers load pages repeatedly.
                    this.selectedId = e.detail.file.id;
                  }
                }}
                @order=${(e: OrderEventType<FileOrderType>) => {
                  this.order = e.detail.order;
                }}
                @show-trashed=${(e: ShowTrashedEventType) => {
                  this.showTrashed = e.detail.showTrashed;
                }}
                @view=${(e: ViewEventType<FileViewType>) => {
                  this.view = e.detail.view;
                }}
                @subscribe=${(e: SubscribeEventType) => this.subscribe(e.detail.subscribe)}
              >
                <slot name="actions" slot="actions"></slot>
              </wy-files-header>
            `
          : nothing}

        <wy-files-list
          ${ref(this.filesListRef)}
          .view=${this.view}
          .order=${this.order}
          .showTrashed=${this.showTrashed}
          .placeholder=${this.placeholder}
          .selectedId=${this.selectedId}
          .highlightId=${this.highlightId}
          @order=${(e: OrderEventType<FileOrderType>) => {
            this.order = e.detail.order;
          }}
          @wy-action=${(e: WyActionEventType) => {
            if (isActionEvent(e, ActionKindType.File) && e.detail.action === ActionType.Select) {
              this.selectedId = e.detail.file?.id;
            }
          }}
        ></wy-files-list>
      </div>

      <wy-user-card .listenTo=${this.shadowRoot}></wy-user-card>
    `;
  }
}
