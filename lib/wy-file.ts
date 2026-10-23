import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { AppTypeGuid } from "./types/app.types";
import type { FileType } from "./types/files.types";
import type {
  FileCommentsEventType,
  FileEditEventType,
  FileEditNameEventType,
  FileRenameEventType,
  FileSaveEventType,
  FileSubscribeEventType,
  FileVersionSelectEventType,
  FileVersionsEventType,
} from "./types/files.events";
import { localized, msg } from "@lit/localize";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyAppComponent } from "./classes/weavy-app-component";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { CreateFilesController } from "./controllers/create-files-controller";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { QueryController } from "./controllers/query-controller";
import { getApiOptions } from "./data/api";
import { WyFileView } from "./components/wy-file-view";
import { normalizeAppearanceMode, type AppearanceModeType, type OverlayAppearanceType } from "./types/ui.types";
import { getRenameFileMutation, RenameFileMutationType } from "./data/file-edit";
import { getSubscribeFileMutation, SubscribeFileMutationType } from "./data/file-subscribe";
import type { WyFilenameInput } from "./components/wy-filename-input";
import { ActionType } from "./types/action.types";
import { isFileEditable } from "./utils/files";

import hostBlockCss from "./scss/host-block.scss";
import hostFillCss from "./scss/host-fill.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";
import paneCss from "./scss/components/pane.scss";
import scrollCss from "./scss/scroll.scss";
import colorModesCss from "./scss/color-modes.scss";
import textCss from "./scss/components/text.scss";
import fileEditorCss from "./scss/components/editor-file.scss";

import "./components/ui/wy-titlebar";
import "./components/wy-file-title";
import "./components/wy-file-menu";
import "./components/ui/wy-overlay";
import "./components/ui/wy-button";
import "./components/ui/wy-icon";
import "./components/wy-comment-list";
import "./components/wy-file-versions";
import "./components/ui/wy-progress-circular";
import "./components/wy-file-view";
import "./components/wy-empty";
import "./components/wy-user-card";
import "./components/wy-filename-input";
import { getDraftOptions, getFileDraftKey } from "./data/drafts";
import type { EditorDraftType } from "./types/editor.types";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file": WyFile;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyActionEventType } from "./types/action.events"
 * @import { WyPreviewOpenEventType } from "./types/files.events"
 * @import { WyPreviewCloseEventType } from "./types/files.events"
 */

/**
 * Weavy file component to render a view or editor for a specific file.
 *
 * Supports viewing files from cloud providers such as Google Drive, Dropbox, Box and Microsoft OneDrive.
 * Files can be viewed for 100+ formats including streamed audio/video, PDF, Office and Google Drive.
 *
 * Each file can be discussed with rich comments with support for attachments, mentions, embedded links and more.
 * Files can also be accessed via versions, with possibility to preview all versions and rollback to a specific version.
 * Office documents and spreadsheets can be opened and edited directly in Office using built-in [WebDAV](https://www.weavy.com/docs/learn/integrations/webdav) integration to automatically save new version back to the app.
 *
 * Each file component requires the file identifier (`fileId`) of the file you want to view or edit. It also requires an app identifier (`uid`), which automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * The app identifier must correspond to the app of the file you want to open. It's also recommended to specify a readable `name` of the files app, to get better readable notifications from the app.
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
 * - [`<wy-titlebar>`](./components/wy-titlebar.ts)
 * - [`<wy-file-title>`](./components/wy-file-title.ts)
 * - [`<wy-file-menu>`](./components/wy-file-menu.ts)
 * - [`<wy-overlay>`](./components/ui/wy-overlay.ts)
 * - [`<wy-button>`](./components/ui/wy-button.ts)
 * - [`<wy-icon>`](./components/ui/wy-icon.ts)
 * - [`<wy-icon-display>`](./components/ui/wy-icon.ts)
 * - [`<wy-comment-list>`](./components/wy-comment-list.ts)
 * - [`<wy-file-versions>`](./components/wy-file-versions.ts)
 * - [`<wy-progress-circular>`](./components/ui/wy-progress-circular.ts)
 * - [`<wy-file-view>`](./components/wy-file-view.ts)
 * - [`<wy-empty>`](./components/wy-empty.ts)
 * - [`<wy-user-card>`](./components/wy-user-card.ts)
 * - [`<wy-filename-input>`](./components/wy-filename-input.ts)
 *
 * @tagname wy-file
 * @csspart wy-dragging - Modifier for the main layout when dragging over.
 * @csspart wy-pane - Part of the tab content area.
 * @csspart wy-scroll-y - Part of the tab content area.
 * @csspart wy-pane-body - Part of the version tab.
 * @csspart wy-meta-sm - Small metadata in the header.
 * @slot actions - Buttons placed in the toolbar.
 * @slot empty - Empty state content.
 * @slot title - Empty state title.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an embed.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 *
 * @example <caption>Standard file preview with comments</caption>
 *
 * Displays a file preview with integrated comments and versioning.
 *
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 *
 * ```html
 * <wy-file uid="test-files" fileId="12345"></wy-file>
 * ```
 *
 * @example <caption>File preview with edit mode</caption>
 *
 * Displays a file preview in edit mode.
 *
 * ```html
 * <wy-file
 *   uid="test-files"
 *   fileId="12345"
 *   edit
 * ></wy-file>
 * ```
 */
@customElement("wy-file")
@localized()
export class WyFile extends WeavyAppComponent {
  static override styles = [
    colorModesCss,
    paneCss,
    scrollCss,
    textCss,
    hostBlockCss,
    hostFillCss,
    hostPaddedCss,
    hostFontCss,
    hostScrollYCss,
    fileEditorCss,
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
    [Feature.FileEdit]: true,
    [Feature.FileRename]: true,
    [Feature.Follow]: true,
    [Feature.GoogleMeet]: false,
    [Feature.Meetings]: false,
    [Feature.Mentions]: true,
    [Feature.MicrosoftTeams]: false,
    [Feature.Polls]: true,
    [Feature.Previews]: true,
    [Feature.Reactions]: true,
    // opt-in like in wy-files: a report goes nowhere until the host handles the report_created webhook
    [Feature.Report]: false,
    [Feature.Typing]: false, // Has no effect currently
    [Feature.Versions]: true,
    [Feature.WebDAV]: true,
    [Feature.ZoomMeetings]: false,
  });

  /** @internal */
  protected theme = new ThemeController(this, WyFile.styles);

  protected createFilesController = new CreateFilesController(this);

  /**
   * Query controller tracking the file.
   * @internal
   */
  fileQuery: QueryController<FileType> = new QueryController(this);

  /**
   * Mutation handling rename requests.
   * @internal
   */
  protected renameFileMutation?: RenameFileMutationType;

  /**
   * Mutation handling subscribe/unsubscribe actions.
   * @internal
   */
  protected subscribeFileMutation?: SubscribeFileMutationType;

  /**
   * Placeholder text for the comment editor input.
   */
  @property()
  placeholder?: string;

  /**
   * The ID of the file to be displayed.
   */
  @property({ type: Number })
  fileId?: number | null;

  /**
   * Whether the component is in edit mode. Sidebars are hidden while editing.
   */
  @property({ type: Boolean })
  edit: boolean = false;

  /**
   * Whether the name of the file is being edited.
   */
  @property({ type: Boolean })
  editName: boolean = false;

  /**
   * The currently selected tab.
   */
  @property()
  tab?: "comments" | "versions";

  /**
   * Appearance of the file list header.
   *
   * @type {"interactive" | "empty" | "none"}
   * @default "interactive"
   */
  @property()
  header: AppearanceModeType = "interactive";

  /**
   * Whether the component is maximized.
   * @internal
   */
  @state()
  maximized = false;

  /**
   * Overlay appearance used for the conversation list.
   *
   * @type {"modal" | "sheet" | "drawer" | "full" | "none"}
   * @default "drawer"
   */
  @property({ type: String })
  overlay: OverlayAppearanceType = "drawer";

  /**
   * Selected file version rendered in the main area.
   *
   * @internal
   */
  @state()
  currentVersionFile?: FileType;

  /**
   * Whether the unsaved draft of the file is shown instead of a stored version.
   *
   * @internal
   */
  @state()
  showDraft = false;

  /**
   * The file data last seen from the file query, used to detect when the file (re)loads.
   * @internal
   */
  private loadedFile?: FileType;

  /**
   * Draft key of the loaded file, used to detect when the draft query must be retargeted.
   * @internal
   */
  private draftKey?: string;

  /**
   * Query for the unsaved draft of the file. A file that has a draft opens on the draft, so Edit and Discard are
   * available right away, and falls back to the current version when the draft is published or discarded.
   * @internal
   */
  private draftQuery = new QueryController<EditorDraftType>(this);

  /**
   * Whether the user explicitly picked a version or the draft. A draft that appears after that (e.g. from another
   * tab) must not replace what the user chose to view.
   * @internal
   */
  private versionSelected = false;

  /**
   * Open a file in preview/edit.
   *
   * @param fileId - The id of the file to open.
   * @param edit - Whether to open in edit mode.
   */
  open(fileId: number, edit?: boolean) {
    this.fileId = fileId;
    this.edit = edit ?? false;
  }

  /**
   * Saves the current file view and returns to preview after a successful save.
   */
  async save() {
    await this.fileViewRef.value?.save();
    this.edit = false;
  }

  /**
   * Prompt for a filename, create a new file and open it. The prompt stays open with an inline error when the name
   * is already taken in the app, so the user can choose a different name.
   *
   * @param ext - Suggested initial extension; the submitted filename is used unchanged.
   * @returns Data for the created file, or undefined if the prompt is cancelled.
   */
  async createFile(ext?: string) {
    await this.updateComplete;
    const editable = (createdFile: FileType) => isFileEditable(createdFile, this.app, this.componentFeatures);
    let createdFile: FileType | undefined;
    await this.filenameInputRef.value?.open(ext, async (filename) => {
      createdFile = await this.createFilesController.createEmptyFile(filename, (createdFile) =>
        editable(createdFile) ? ActionType.Edit : ActionType.Select,
      );
      return createdFile ? undefined : msg("A file with this name already exists. Choose a different name.");
    });

    if (createdFile) {
      this.fileId = createdFile.id;
      this.edit = editable(createdFile);
    }
    return createdFile;
  }

  /**
   * Upload a file and open it.
   *
   * @param files - Files to upload.
   * @returns An array of data for the created files.
   */
  async uploadFile(file: File) {
    if (file) {
      const uploadedFile = await this.createFilesController.uploadFile(file);
      this.fileId = uploadedFile?.id;
      return uploadedFile;
    } else {
      console.warn("No file provided for upload");
      return undefined;
    }
  }

  /**
   * Whether the component is acting as an attachment.
   */
  get isAttachment(): boolean {
    return this.app?.type !== AppTypeGuid.Files;
  }

  /**
   * Reference to the current view element.
   *
   * @internal
   */
  protected fileViewRef: Ref<WyFileView> = createRef();

  private filenameInputRef = createRef<WyFilenameInput>();

  /**
   * Handles file version selection events.
   *
   * @internal
   * @param e - Version selection event.
   */
  handleVersionFile(e: FileVersionSelectEventType) {
    this.currentVersionFile = e.detail.versionFile;
    this.showDraft = Boolean(e.detail.draft);
    this.versionSelected = true;
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (changedProperties.has("edit") && this.edit) {
      // The editor loads the draft itself, so the draft view is only for preview mode
      this.currentVersionFile = undefined;
      this.showDraft = false;
      this.versionSelected = false;
      this.tab = undefined;
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("fileId") || changedProperties.has("app")) &&
      this.weavy &&
      this.app
    ) {
      this.currentVersionFile = undefined;
      if (this.fileId) {
        await this.fileQuery.trackQuery(
          getApiOptions(this.weavy, ["app", this.app.id, "file", this.fileId], `/api/files/${this.fileId}`),
        );
      } else {
        this.fileQuery.untrackQuery();
      }
    }

    
    // Show the loaded file when nothing is selected yet, and follow it when it changes (e.g. a new version was
    // published) while the current version is shown. An older version picked from the versions list is kept, so the
    // query data must not simply replace the selection on every update.
    const file = this.fileId ? this.fileQuery.result.data : undefined;
    if (file && !this.currentVersionFile) {
      this.currentVersionFile = file;
    } else if (file && file !== this.loadedFile && this.currentVersionFile?.rev === this.loadedFile?.rev) {
      this.currentVersionFile = file;
    }
    this.loadedFile = file;

    // Follow the draft of the loaded file. The key only depends on the file id, so version changes keep the query.
    const draftKey = file && this.weavy ? getFileDraftKey(file) : undefined;
    if (draftKey !== this.draftKey) {
      this.draftKey = draftKey;
      this.versionSelected = false;
      if (draftKey && this.weavy) {
        await this.draftQuery.trackQuery(getDraftOptions(this.weavy, draftKey));
      } else {
        this.draftQuery.untrackQuery();
      }
    }

    // A file with a draft is viewed as the draft, so Edit and Discard are at hand, until the user picks a stored
    // version or the draft in the versions list. Derived on every update so that reopening the file or leaving the
    // editor also lands on the draft, and so that the draft view is left when the draft is published or discarded.
    // A cached draft the user can no longer act on (revoked permission, editing turned off) is ignored.
    const hasDraft =
      Boolean(this.draftKey && this.draftQuery.result?.data) &&
      isFileEditable(this.loadedFile, this.app, this.componentFeatures);
    if (!hasDraft && this.showDraft) {
      this.showDraft = false;
    } else if (hasDraft && !this.edit && !this.versionSelected && !this.showDraft) {
      this.showDraft = true;
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("user")) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      this.renameFileMutation = getRenameFileMutation(this.weavy, this.app);
      this.subscribeFileMutation = getSubscribeFileMutation(this.weavy, this.app);
    }
  }

  /**
   * Renders the preview header for the active file.
   *
   * @internal
   * @param activeFile - File displayed in the main pane.
   */
  renderHeader(activeFile?: FileType) {
    const interactive = normalizeAppearanceMode(this.header) === "interactive";
    return html`
      <wy-titlebar header outer ?trashed=${Boolean(activeFile?.is_trashed)}>
        ${activeFile
          ? html`
              <wy-file-title
                slot="title-section"
                .file=${activeFile}
                .draft=${this.showDraft || this.edit}
                .hasEditName=${interactive}
                .editName=${this.editName}
                @edit-name=${(e: FileEditNameEventType) => {
                  this.editName = e.detail.editName;
                }}
                @rename=${(e: FileRenameEventType) => {
                  if (this.componentFeatures?.allowsFeature(Feature.FileRename)) {
                    void this.renameFileMutation?.mutate({ file: e.detail.file, name: e.detail.name });
                  }
                  this.editName = false;
                }}
              >
                <slot slot="actions" name="actions"></slot>
              </wy-file-title>
            `
          : nothing}
        ${interactive ? html`
          <wy-file-menu
          slot="actions"
          .file=${activeFile}
          .hasEdit=${true}
          .hasComments=${!this.isAttachment}
          .hasVersions=${!this.isAttachment}
          .editActive=${this.edit}
          .draftActive=${this.showDraft}
          .oldVersionActive=${Boolean(
            activeFile && this.fileQuery.result.data && activeFile.rev !== this.fileQuery.result.data.rev,
          )}
          .editNameActive=${this.editName}
          .commentsActive=${this.tab === "comments"}
          .versionsActive=${this.tab === "versions"}
          @save=${(_e: FileSaveEventType) => void this.save()}
          @comments=${(e: FileCommentsEventType) => {
            this.tab = e.detail.show ? "comments" : undefined;
          }}
          @versions=${(e: FileVersionsEventType) => {
            this.tab = e.detail.show ? "versions" : undefined;
          }}
          @edit=${(e: FileEditEventType) => {
            this.edit = e.detail.edit;
          }}
          @edit-name=${(e: FileEditNameEventType) => {
            this.editName = e.detail.editName;
          }}
          @subscribe=${(e: FileSubscribeEventType) => {
            void this.subscribeFileMutation?.mutate({
              file: e.detail.file,
              subscribe: e.detail.subscribe,
            });
          }}
        >
        </wy-file-menu>
        `: nothing }
      </wy-titlebar>
    `;
  }

  /**
   * Renders the sidebar panels.
   * 
   * @internal
   * @param file - The file to render tabs for
   * @returns 
   */
  renderTabs(file?: FileType) {
    const commentsOpen = this.tab === "comments" && this.componentFeatures?.allowsFeature(Feature.Comments);
    const versionsOpen = this.tab === "versions" && this.componentFeatures?.allowsFeature(Feature.Versions);

    return !this.edit && this.overlay !== "none"
      ? html`<wy-overlay
          type=${this.overlay}
          .show=${commentsOpen || versionsOpen}
          .maximized=${this.maximized}
          @close=${() => (this.tab = undefined)}
          noHeader
        >
          ${this.isAttachment
            ? nothing
            : html`
                ${this.componentFeatures?.allowsFeature(Feature.Comments)
                  ? html`
                      <aside id="tab-comments" ?hidden=${!commentsOpen}>
                        <wy-titlebar floating header outer>
                          <wy-button kind="icon" slot="icon" @click=${() => (this.tab = undefined)}
                            ><wy-icon name="close"></wy-icon
                          ></wy-button>
                          <span slot="title">${msg("Comments")}</span>
                          <wy-button kind="icon" slot="actions" @click=${() => (this.maximized = !this.maximized)}
                            ><wy-icon name=${this.maximized ? "arrow-collapse" : "arrow-expand"}></wy-icon
                          ></wy-button>
                        </wy-titlebar>

                        <div part="wy-pane wy-scroll-y">
                          <div part="wy-pane-group">
                            ${commentsOpen && file && file.id >= 1 && this.app && this.user
                              ? html`
                                  <wy-comment-list
                                    reveal
                                    .previousPaging=${"infinite"}
                                    .nextPaging=${"infinite"}
                                    .placeholder=${this.placeholder}
                                    .parentId=${file.id}
                                    .location=${"files"}
                                  ></wy-comment-list>
                                `
                              : nothing}
                          </div>
                        </div>
                      </aside>
                    `
                  : nothing}
                ${this.componentFeatures?.allowsFeature(Feature.Versions)
                  ? html`
                      <aside id="tab-versions" ?hidden=${!versionsOpen}>
                        <wy-titlebar floating header outer>
                          <wy-button kind="icon" slot="icon" @click=${() => (this.tab = undefined)}
                            ><wy-icon name="close"></wy-icon
                          ></wy-button>
                          <span slot="title">${msg("Versions")}</span>
                          <wy-button kind="icon" slot="actions" @click=${() => (this.maximized = !this.maximized)}
                            ><wy-icon name=${this.maximized ? "arrow-collapse" : "arrow-expand"}></wy-icon
                          ></wy-button>
                        </wy-titlebar>
                        <div part="wy-pane wy-scroll-y">
                          <div part="wy-pane-body">
                            ${versionsOpen && file && this.app
                              ? html`
                                  <wy-file-versions
                                    .file=${file}
                                    .activeVersion=${this.currentVersionFile}
                                    .activeDraft=${this.showDraft}
                                    @file-version-select=${(e: FileVersionSelectEventType) => this.handleVersionFile(e)}
                                    @edit=${(e: FileEditEventType) => {
                                      this.edit = e.detail.edit;
                                    }}
                                  ></wy-file-versions>
                                `
                              : nothing}
                          </div>
                        </div>
                      </aside>
                    `
                  : nothing}
              `}
        </wy-overlay> `
      : nothing;
  }

  protected override render() {
    const { isPending } = this.fileQuery.result;
    const file = this.currentVersionFile;
    const header = normalizeAppearanceMode(this.header);

    return html`
      <wy-filename-input ${ref(this.filenameInputRef)}></wy-filename-input>
      ${this.fileId
        ? html`
            ${header !== "none" ? this.renderHeader(file) : nothing}
            ${isPending
              ? html` <wy-progress-circular indeterminate overlay reveal></wy-progress-circular> `
              : html`
                  <wy-file-view
                    ${ref(this.fileViewRef)}
                    .edit=${this.edit}
                    .draft=${this.showDraft}
                    .file=${file}
                    .current=${true}
                    part="wy-editor-toolbar-offset"
                  ></wy-file-view>
                `}
            ${this.renderTabs(file)}

            <wy-user-card .listenTo=${this.shadowRoot}></wy-user-card>
          `
        : html`
            <wy-empty>
              <slot name="empty">
                <wy-icon-display>
                  <wy-icon name="file"></wy-icon>
                  <slot slot="text" name="title"></slot>
                </wy-icon-display>
              </slot>
            </wy-empty>
          `}
    `;
  }

  protected override updated(changedProperties: PropertyValueMap<this>): void {
    if (changedProperties.has("editName") && !this.editName) {
      this.fileViewRef.value?.setFocus();
    }
  }
}
