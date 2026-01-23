import { html, type PropertyValues } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { AppTypeGuid } from "./types/app.types";
import type {
  FileOrderType,
  BlobType,
  CreateFileProps,
  FileType,
  MutateFileProps,
  FileMutationContextType,
  FileViewType,
} from "./types/files.types";
import type {
  CreateFilesEventType,
  DropFilesEventType,
  ExternalBlobsEventType,
  FilesEventType,
  UploadFilesEventType,
} from "./types/files.events";
import { MutationController } from "./controllers/mutation-controller";
import { getCreateFileMutationOptions } from "./data/file-create";
import { getUploadBlobMutationOptions } from "./data/blob-upload";
import { ExternalBlobMutationType, getExternalBlobMutation } from "./data/blob-external";
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

import dropZoneCss from "./scss/components/dropzone.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";
import colorModesCss from "./scss/color-modes.scss";

import "./components/wy-files-header";
import "./components/wy-files-list";

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
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an embed.
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
 */
@customElement("wy-files")
@localized()
export class WyFiles extends WeavyAppComponent {
  static override styles = [
    dropZoneCss,
    colorModesCss,
    hostBlockCss,
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
    [Feature.ContextData]: true,
    [Feature.Embeds]: true,
    [Feature.GoogleMeet]: false,
    [Feature.Meetings]: false,
    [Feature.Mentions]: true,
    [Feature.MicrosoftTeams]: false,
    [Feature.Polls]: true,
    [Feature.Previews]: true,
    [Feature.Reactions]: true,
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
   * File order in the list. Persisted in sessionStorage.
   */
  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * Enables showing trashed files. Persisted in sessionStorage.
   */
  @property({ type: Boolean })
  showTrashed: boolean = false;

  /** @internal */
  private persistState = new PersistStateController(this);
  
  /** @internal */
  private dropZone: DropZoneController = new DropZoneController(this);

  /** @internal */
  private uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>(this);

  /** @internal */
  private externalBlobMutation?: ExternalBlobMutationType;

  /** @internal */
  private createFileMutation = new MutationController<FileType, Error, CreateFileProps, FileMutationContextType>(this);

  /** @internal */
  private handleBlobUpload(e: FilesEventType) {
    const eventDetail = e.detail;
    if (eventDetail.files) {
      for (let i = 0; i < eventDetail.files.length; i++) {
        const file = eventDetail.files[i];
        const fileProps = { file: file };
        void this.uploadBlobMutation.mutate(fileProps).then((blob) => this.handleCreateFile(blob));
      }
    }
  }

  /** @internal */
  private handleExternalBlobs(e: ExternalBlobsEventType) {
    if (e.detail.externalBlobs) {
      for (let i = 0; i < e.detail.externalBlobs.length; i++) {
        const externalBlob = e.detail.externalBlobs[i];
        void this.externalBlobMutation?.mutate({ externalBlob }).then((blob) => this.handleCreateFile(blob));
      }
    }
  }

  /** @internal */
  private async handleCreateFile(blob: BlobType, replace?: boolean) {
    return await this.createFileMutation.mutate({ blob, replace });
  }

  constructor() {
    super();
    this.addEventListener("drop-files", (e) => this.handleBlobUpload(e as DropFilesEventType));
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
        `u${this.user.id}`
      );
      //this.history.observe(['view'], this.uid.toString())
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("user")) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      await this.uploadBlobMutation.trackMutation(getUploadBlobMutationOptions(this.weavy, this.user, this.app.id));
      await this.createFileMutation.trackMutation(getCreateFileMutationOptions(this.weavy, this.user, this.app));
      this.externalBlobMutation = getExternalBlobMutation(this.weavy, this.user, this.app.id);
    }
  }

  protected override render() {
    const isDragActive = this.dropZone.isDragActive;

    return html`
      <div
        part="wy-files ${partMap({ "wy-dragging": isDragActive })}"
        data-drag-title=${msg("Drop files here")}
      >
        <wy-files-header
          .order=${this.order}
          .showTrashed=${this.showTrashed}
          .view=${this.view}
          @upload-files=${(e: UploadFilesEventType) => this.handleBlobUpload(e)}
          @external-blobs=${(e: ExternalBlobsEventType) => this.handleExternalBlobs(e)}
          @create-files=${(e: CreateFilesEventType) =>
            (e.detail.blobs as BlobType[]).forEach((blob) => this.handleCreateFile(blob, e.detail.replace))}
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

        <wy-files-list
          .view=${this.view}
          .order=${this.order}
          .showTrashed=${this.showTrashed}
          @order=${(e: OrderEventType<FileOrderType>) => {
            this.order = e.detail.order;
          }}
        ></wy-files-list>
      </div>
    `;
  }
}
