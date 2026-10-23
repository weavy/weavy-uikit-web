import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import type { FileLoadingState, FilesResultType, FileType } from "../types/files.types";
import type {
  FileCommentsEventType,
  FileEditEventType,
  FileEditNameEventType,
  FilePreviewLoadedEventType,
  FileRenameEventType,
  FileSaveEventType,
  FileSubscribeEventType,
  FileVersionSelectEventType,
  FileVersionsEventType,
  WyPreviewCloseEventType,
  WyPreviewOpenEventType,
} from "../types/files.events";
import type { InfiniteData, InfiniteQueryObserverResult, QueryObserverResult } from "@tanstack/query-core";
import { localized, msg } from "@lit/localize";
import type { UserType } from "../types/users.types";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SwipeScrollController } from "../controllers/swipe-scroll-controller";
import { repeat } from "lit/directives/repeat.js";
import { PersistStateController } from "../controllers/persist-state-controller";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { getFlatInfiniteResultData } from "../utils/query-cache";
import { NamedEvent } from "../types/generic.types";
import { Feature } from "../types/features.types";
import { isFileEditable } from "../utils/files";
import { partMap } from "../utils/directives/shadow-part-map";
import { onlyValues } from "../utils/data";
import { getRenameFileMutation, RenameFileMutationType } from "../data/file-edit";
import { getSubscribeFileMutation, SubscribeFileMutationType } from "../data/file-subscribe";
import { QueryController } from "../controllers/query-controller";
import { getDraftOptions, getFileDraftKey } from "../data/drafts";
import type { EditorDraftType } from "../types/editor.types";

import previewCss from "../scss/components/preview.scss";
import sidebarCss from "../scss/components/sidebar.scss";
import textCss from "../scss/components/text.scss";
import paneCss from "../scss/components/pane.scss";
import scrollCss from "../scss/scroll.scss";
import colorModesCss from "../scss/color-modes.scss";

import "./ui/wy-button";
import "./ui/wy-container";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./ui/wy-overlay";
import "./ui/wy-progress-circular";
import "./ui/wy-titlebar";
import "./wy-file-view";
import "./wy-file-menu";
import "./wy-comment-list";
import "./wy-file-versions";
import "./wy-user-card";
import "./wy-file-title";
import { WyFileView } from "./wy-file-view";
import { WyOverlay } from "./ui/wy-overlay";

declare global {
  interface HTMLElementTagNameMap {
    "wy-preview": WyPreview;
  }
}

/**
 * Preview component.
 * Consumes WeavyComponent contexts.
 *
 * **Used sub components:**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-titlebar>`](./ui/wy-titlebar.ts)
 * - [`<wy-file-view>`](./wy-file-view.ts)
 * - [`<wy-file-menu>`](./wy-file-menu.ts)
 * - [`<wy-comment-list>`](./wy-comment-list.ts)
 * - [`<wy-file-versions>`](./wy-file-versions.ts)
 * - [`<wy-user-card>`](./wy-user-card.ts)
 * - [`<wy-file-title>`](./wy-file-title.ts)
 * - [`<wy-file-view>`](./wy-file-view.ts)
 *
 * @csspart wy-dark - Overlay dark/root modifier.
 * @csspart wy-preview-layout - Layout wrapper for the preview.
 * @csspart wy-preview-main - Main preview content area.
 * @csspart wy-sidebar - Sidebar container for comments/versions.
 * @csspart wy-pane - Pane wrapper inside sidebars.
 * @csspart wy-preview - Preview container for content.
 * @csspart wy-preview-swiper - Swiper container for multiple preview panes.
 * @csspart wy-preview-area - Individual preview area for a single file.
 * @csspart wy-nav-prev - Previous navigation control.
 * @csspart wy-nav-next - Next navigation control.
 *
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 */
@customElement("wy-preview")
@localized()
export class WyPreview extends WeavySubAppComponent {
  static override styles = [previewCss, sidebarCss, paneCss, scrollCss, textCss, colorModesCss];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Placeholder text for the comment editor input.
   */
  @property()
  placeholder?: string;

  /**
   * Files available to render inside the preview carousel.
   */
  @property({ attribute: false })
  files?: FileType[];

  /**
   * Query result used to hydrate {@link files}.
   *
   * @internal
   */
  @property({ attribute: false })
  queryResult?: QueryObserverResult<FileType[]>;

  /**
   * Infinite query result backing the preview list.
   *
   * @internal
   */
  @property({ attribute: false })
  infiniteQueryResult?: InfiniteQueryObserverResult<InfiniteData<FilesResultType, unknown>>;

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
   * Authenticated user context used for sidebar content.
   *
   * @internal
   */
  @property({ type: Object })
  override user: UserType | undefined;

  /**
   * Identifier of the file currently displayed in the overlay.
   *
   * @attr
   */
  @property({ type: Number })
  currentId: number = NaN;

  /**
   * Treat provided files as attachments, disabling contextual sidebars.
   *
   * @attr
   */
  @property({ type: Boolean })
  isAttachment: boolean = false;

  /**
   * Forces the overlay to use the full-screen layout.
   *
   * @attr
   */
  @property({ type: Boolean })
  filled: boolean = false;

  /**
   * Puts the current file in edit mode if available.
   *
   * @attr
   */
  @property({ type: Boolean })
  edit: boolean = false;

  /**
   * Puts the current file in edit filename mode if available.
   *
   * @attr
   */
  @property({ type: Boolean })
  editName: boolean = false;

  /**
   * File currently selected in the carousel.
   *
   * @internal
   */
  @state()
  currentFile?: FileType;

  /**
   * Selected file version rendered in the main area.
   *
   * @internal
   */
  @state()
  currentVersionFile?: FileType;

  /**
   * Previous file candidate for navigation.
   *
   * @internal
   */
  @state()
  previousFile?: FileType;

  /**
   * Next file candidate for navigation.
   *
   * @internal
   */
  @state()
  nextFile?: FileType;

  /**
   * Overlay visibility flag.
   *
   * @internal
   */
  @state()
  showOverlay = false;

  /**
   * Comments sidebar visibility flag.
   *
   * @internal
   */
  @state()
  commentsOpen = false;

  /**
   * Versions sidebar visibility flag.
   *
   * @internal
   */
  @state()
  versionsOpen = false;

  /**
   * Whether the main area shows the unsaved draft of the current file instead of a stored version.
   *
   * @internal
   */
  @state()
  showDraft = false;

  /**
   * Draft key of the current file, used to detect when the draft query must be retargeted.
   * @internal
   */
  private draftKey?: string;

  /**
   * Query for the unsaved draft of the current file. A file that has a draft opens on the draft, so Edit and Discard
   * are available right away, and falls back to the current version when the draft is published or discarded.
   * @internal
   */
  private draftQuery = new QueryController<EditorDraftType>(this);

  /**
   * Whether the user explicitly picked a version or the draft for the current file. A draft that appears after that
   * (e.g. from another tab) must not replace what the user chose to view.
   * @internal
   */
  private versionSelected = false;

  /**
   * Whether the active sidebar occupies extra width.
   *
   * @internal
   */
  @state()
  protected sidePanelMaximized = false;

  /**
   * Persists sidebar state per app/user combination.
   *
   * @internal
   */
  private persistState = new PersistStateController(this);

  /**
   * Handles swipe navigation between preview panes.
   *
   * @internal
   */
  private swipeScroller: SwipeScrollController = new SwipeScrollController(this);

  /**
   * Reference to the current view element.
   *
   * @internal
   */
  protected currentViewRef: Ref<WyFileView> = createRef();

  /**
   * Reference to the next preview element.
   *
   * @internal
   */
  protected nextRef: Ref<Element> = createRef();

  /**
   * Reference to the previous preview element.
   *
   * @internal
   */
  protected prevRef: Ref<Element> = createRef();

  /**
   * Reference to the overlay.
   *
   * @internal
   */
  protected overlayRef: Ref<WyOverlay> = createRef();

  /**
   * Element monitored for swipe intersection changes.
   *
   * @internal
   */
  @state()
  swipeScrollElement?: Element;

  /**
   * Loading states and queue order for preview items. Make sure to update it with immutable states.
   * @internal
   */
  @state()
  loadingQueue: FileLoadingState[] = [];

  /**
   * Prevents swipe navigation while programmatic scrolling is in progress.
   *
   * @internal
   */
  @state()
  protected disableSwipeScroll = false;

  /**
   * Timeout id used to re-enable swipe scrolling.
   *
   * @internal
   */
  private disableSwipeScrollTimeout?: number;

  /**
   * Disable swipe scroll while resizing.
   * Needed by Safari.
   * @internal
   */
  resizeObserver: ResizeObserver = new ResizeObserver(() => {
    this.blockSwipeScroll();
  });

  /**
   * Moves a file to the front of the loading queue.
   *
   * @internal
   * @param file - File to prioritize.
   * @param state - Optional state override.
   */
  moveFirstInQueue(file: FileType, state?: Omit<FileLoadingState, "file">) {
    let fileLoadingState = { file };
    const excludedLoadingQueue = this.loadingQueue.filter((fls) => {
      if (fls.file === file) {
        fileLoadingState = fls;
        return false;
      } else {
        return true;
      }
    });

    this.loadingQueue = [{ ...fileLoadingState, ...state }, ...excludedLoadingQueue];
  }

  /**
   * Updates loading metadata for the supplied file.
   *
   * @internal
   * @param file - File whose state should change.
   * @param state - State patch to merge.
   */
  updateLoadingState(file?: FileType, state?: Omit<FileLoadingState, "file">) {
    if (file) {
      this.loadingQueue = this.loadingQueue.map((fls) => {
        if (file === fls.file) {
          return { ...fls, ...state };
        }

        return fls;
      });
    }
  }

  /**
   * Marks the next unloaded item as loading.
   *
   * @internal
   */
  loadNextInQueue() {
    const firstUnloaded = this.loadingQueue.find((fls) => !fls.loaded);
    if (firstUnloaded && !firstUnloaded?.loading) {
      this.updateLoadingState(firstUnloaded.file, { loading: true });
    }
  }

  /**
   * Emits `wy-preview-open` with the current preview context.
   *
   * @internal
   */
  async dispatchOpen() {
    const app = await this.whenApp();
    const componentFeatures = await this.whenComponentFeatures();
    const fileId = this.currentId;
    const tab = this.commentsOpen ? "comments" : this.versionsOpen ? "versions" : undefined;
    const files = this.currentFile ? [this.currentFile] : [];
    const isAttachment = this.isAttachment;
    const contextDataBlobs = this.contextDataBlobs;

    const event: WyPreviewOpenEventType = new (CustomEvent as NamedEvent)("wy-preview-open", {
      detail: {
        fileId,
        tab,
        files,
        app,
        features: componentFeatures.allowedFeatures().join(" "),
        isAttachment,
        contextDataBlobs,
      },
      cancelable: true,
      bubbles: false,
      composed: true,
    });

    if (!this.dispatchEvent(event)) {
      // Close and reset preview UI if default is prevented in the event
      this.showOverlay = false;
      this.commentsOpen = false;
      this.versionsOpen = false;
    }
  }

  /**
   * Emits the `wy-preview-close` event.
   *
   * @internal
   */
  dispatchClose() {
    const event: WyPreviewCloseEventType = new (CustomEvent as NamedEvent)("wy-preview-close", {
      cancelable: false,
      bubbles: false,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  /**
   * Opens the overlay for the provided file identifier.
   *
   * @param fileId - File to display.
   * @param showTab - Optional sidebar tab to activate.
   */
  async open(fileId: number, options: { edit?: boolean; tab?: "comments" | "versions" } = {}) {
    await this.whenApp();
    await this.updateComplete;

    if (fileId) {
      this.currentId = fileId;
    }

    this.edit = Boolean(options.edit);

    if (options.tab) {
      this.toggleSidebarTab(options.tab, true);
    }

    this.showOverlay = true;
  }

  /**
   * Closes the preview overlay.
   */
  close() {
    this.showOverlay = false;
  }

  /**
   * Saves the current document and returns to preview after a successful save.
   */
  async save() {
    await this.currentViewRef.value?.save();
    this.edit = false;
  }

  setFocus() {
      if (this.edit) {
        this.currentViewRef.value?.setFocus();
      } else {
        this.overlayRef.value?.setFocus();
      }
  }

  /**
   * Toggles sidebar visibility for comments or versions.
   *
   * @internal
   * @param tab - Sidebar to affect.
   * @param state - Forced open state; toggles when omitted.
   */
  toggleSidebarTab(tab?: "comments" | "versions", state?: boolean) {
    if (tab === "comments") {
      this.versionsOpen = false;
      this.commentsOpen = state !== undefined ? state : !this.commentsOpen;
    } else if (tab === "versions") {
      this.commentsOpen = false;
      this.versionsOpen = state !== undefined ? state : !this.versionsOpen;
    } else {
      this.commentsOpen = false;
      this.versionsOpen = false;
    }
  }

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

  /**
   * Keyboard navigation handler for the overlay.
   *
   * @internal
   */
  handleKeys = (e: KeyboardEvent) => {
    if (this.showOverlay) {
      if (e.key === "ArrowLeft") {
        e.stopPropagation();
        this.setPrev();
      } else if (e.key === "ArrowRight") {
        e.stopPropagation();
        this.setNext();
      }
    }
  };

  /**
   * Scrolls to the previous preview area.
   *
   * @internal
   */
  scrollToPrev() {
    if (!this.edit && this.prevRef.value) {
      this.unblockSwipeScroll();
      this.prevRef.value.scrollIntoView({ behavior: this.weavy?.scrollBehavior });
    }
  }

  /**
   * Scrolls to the next preview area.
   *
   * @internal
   */
  scrollToNext() {
    if (!this.edit && this.nextRef.value) {
      this.unblockSwipeScroll();
      this.nextRef.value.scrollIntoView({ behavior: this.weavy?.scrollBehavior });
    }
  }

  /**
   * Disables swipe scrolling for a short duration.
   *
   * @internal
   * @param duration - Milliseconds before re-enabling.
   */
  blockSwipeScroll(duration: number = 20) {
    window.clearTimeout(this.disableSwipeScrollTimeout);
    this.disableSwipeScroll = true;
    this.disableSwipeScrollTimeout = window.setTimeout(() => (this.disableSwipeScroll = false), duration);
  }

  /**
   * Re-enables swipe scrolling immediately.
   *
   * @internal
   */
  unblockSwipeScroll() {
    window.clearTimeout(this.disableSwipeScrollTimeout);
    this.disableSwipeScroll = false;
  }

  /**
   * Selects the previous file when available.
   *
   * @internal
   */
  setPrev() {
    if (!this.edit && this.previousFile) {
      this.currentId = this.previousFile.id;
      this.blockSwipeScroll();
    }
  }

  /**
   * Selects the next file when available.
   *
   * @internal
   */
  setNext() {
    if (!this.edit && this.nextFile) {
      this.currentId = this.nextFile.id;
      this.blockSwipeScroll();
    }
  }

  /**
   * Registers swipe observers on the active scroll element.
   *
   * @internal
   */
  registerSwipeScroller() {
    this.resizeObserver.disconnect();

    if (this.swipeScrollElement) {
      this.swipeScroller.whenPrev ??= () => this.setPrev();
      this.swipeScroller.whenNext ??= () => this.setNext();
      this.swipeScroller.createObserver(this.swipeScrollElement);
      this.resizeObserver.observe(this.swipeScrollElement);
    }
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("app") || changedProperties.has("user")) &&
      this.app &&
      this.user &&
      !this.isAttachment
    ) {
      this.persistState.observe(
        [
          { name: "commentsOpen", override: true },
          { name: "versionsOpen", override: true },
        ],
        `a${this.app.id}-preview`,
        `u${this.user.id}`,
      );

      if (this.commentsOpen && this.versionsOpen) {
        this.versionsOpen = false;
      }
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

    if (changedProperties.has("queryResult") && this.queryResult) {
      const { data } = this.queryResult ?? {};
      this.files = data?.filter((file) => file && !file.is_trashed);
    }

    if (changedProperties.has("infiniteQueryResult") && this.infiniteQueryResult) {
      const { data } = this.infiniteQueryResult ?? {};
      this.files = getFlatInfiniteResultData(data).filter((file) => file && !file.is_trashed);
    }

    if (changedProperties.has("currentFile") && this.currentFile) {
      if (this.currentFile.id !== this.currentId) {
        this.currentId = this.currentFile.id;
      }
    }

    if (changedProperties.has("edit") && this.edit) {
      // The editor loads the draft itself, so the draft view is only for preview mode
      this.currentVersionFile = this.currentFile;
      this.showDraft = false;
      this.versionSelected = false;
      this.commentsOpen = false;
      this.versionsOpen = false;
    }


    if (
      (changedProperties.has("files") || changedProperties.has("currentId") || changedProperties.has("showOverlay")) &&
      this.files &&
      this.showOverlay
    ) {
      this.currentFile = undefined;
      this.previousFile = undefined;
      this.nextFile = undefined;
      this.currentVersionFile = undefined;
      this.showDraft = false;
      this.versionSelected = false;

      this.currentVersionFile = this.currentFile = this.files.find((file, index) => {
        if (this.files && file.id === this.currentId) {
          if (index >= 1) {
            this.previousFile = this.files[index - 1];
          }

          if (index < this.files.length - 1) {
            this.nextFile = this.files[index + 1];
          }

          if (this.infiniteQueryResult && index >= this.files.length - 2) {
            if (this.infiniteQueryResult.hasNextPage && !this.infiniteQueryResult.isFetchingNextPage) {
              void this.infiniteQueryResult.fetchNextPage();
            }
          }

          if (this.infiniteQueryResult && index <= 1) {
            if (this.infiniteQueryResult.hasPreviousPage && !this.infiniteQueryResult.isFetchingPreviousPage) {
              void this.infiniteQueryResult.fetchPreviousPage();
            }
          }

          return true;
        } else {
          return false;
        }
      });
    }

    if (changedProperties.has("currentFile") && this.currentFile && !this.files) {
      this.files = [this.currentFile];
    }

    // Update loading queue (in reverse order)

    if (changedProperties.has("previousFile") && this.previousFile) {
      this.moveFirstInQueue(this.previousFile);
    }

    if (changedProperties.has("nextFile") && this.nextFile) {
      this.moveFirstInQueue(this.nextFile);
    }

    if (changedProperties.has("currentVersionFile") && this.currentVersionFile) {
      this.moveFirstInQueue(this.currentVersionFile, { loading: true });
    }

    if (changedProperties.has("loadingQueue")) {
      this.loadNextInQueue();
    }

    // Follow the draft of the current file. The key only depends on the file id, so navigating between files
    // retargets the query while version changes of the same file keep it.
    const draftKey = this.currentFile && this.weavy ? getFileDraftKey(this.currentFile) : undefined;
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
      isFileEditable(this.currentFile, this.app, this.componentFeatures);
    if (!hasDraft && this.showDraft) {
      this.showDraft = false;
    } else if (hasDraft && !this.edit && !this.versionSelected && !this.showDraft) {
      this.showDraft = true;
    }

    if (changedProperties.has("showOverlay")) {
      if (this.showOverlay) {
        await this.dispatchOpen();
      } else if (changedProperties.get("showOverlay")) {
        this.dispatchClose();
      }
    }
  }

  /**
   * Renders the preview header for the active file.
   *
   * @internal
   * @param activeFile - File displayed in the main pane.
   */
  renderHeader(activeFile?: FileType) {
    return html`
      <wy-titlebar header ?trashed=${Boolean(activeFile?.is_trashed)}>
        ${this.edit
          ? html`
              <wy-button
                slot="icon"
                kind="icon"
                title=${msg("Back to preview")}
                @click=${() => {
                  // Leaves the editor only; any draft is kept and shown in the preview.
                  this.edit = false;
                }}
                ><wy-icon name="back"></wy-icon
              ></wy-button>
            `
          : html`
              <wy-button slot="icon" kind="icon" @click=${() => this.close()}><wy-icon name="close"></wy-icon></wy-button>
            `}
        ${activeFile
          ? html`
              <wy-file-title
                slot="title-section"
                .file=${activeFile}
                .draft=${this.showDraft || this.edit}
                .hasEditName=${!this.isAttachment}
                .editName=${this.editName}
                @edit-name=${(e: FileEditNameEventType) => {
                  this.editName = e.detail.editName;
                }}
                @rename=${(e: FileRenameEventType) => {
                  void this.renameFileMutation?.mutate({ file: e.detail.file, name: e.detail.name });
                  this.editName = false;
                }}
              ></wy-file-title>
            `
          : nothing}
        <wy-file-menu
          slot="actions"
          .file=${activeFile}
          .hasEdit=${true}
          .hasComments=${!this.isAttachment}
          .hasVersions=${!this.isAttachment}
          .hasSubscribe=${!this.isAttachment}
          .hasRename=${!this.isAttachment}
          .editActive=${this.edit}
          .draftActive=${this.showDraft}
          .oldVersionActive=${Boolean(
            this.currentVersionFile && this.currentFile && this.currentVersionFile.rev !== this.currentFile.rev,
          )}
          .editNameActive=${this.editName}
          .commentsActive=${this.commentsOpen}
          .versionsActive=${this.versionsOpen}
          @save=${(_e: FileSaveEventType) => void this.save()}
          @comments=${(e: FileCommentsEventType) => {
            this.toggleSidebarTab(e.detail.show ? "comments" : undefined);
          }}
          @versions=${(e: FileVersionsEventType) => {
            this.toggleSidebarTab(e.detail.show ? "versions" : undefined);
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
        ></wy-file-menu>
      </wy-titlebar>
    `;
  }

  override render() {
    let isPending = this.files === undefined;

    if (this.queryResult) {
      isPending = this.queryResult.isPending;
    } else if (this.infiniteQueryResult) {
      isPending = this.infiniteQueryResult.isPending;
    }

    // Is the current file editable?
    const editCurrent = this.edit && isFileEditable(this.currentFile, this.app, this.componentFeatures);

    // Make a short list so we can use repeat
    const previewFiles = [this.previousFile, this.currentVersionFile, this.nextFile].filter(onlyValues);

    if (this.commentsOpen && this.versionsOpen) {
      // both can't be open
      this.versionsOpen = false;
    }

    const previewSwiperParts = {
      "wy-preview-swiper-disabled": this.disableSwipeScroll || this.edit,
    };

    if (!this.weavy) {
      return nothing;
    }

    return html`
      <wy-overlay
        ${ref(this.overlayRef)}
        part="wy-dark"
        maximized
        noHeader
        type=${this.filled ? "full" : "modal"}
        .show=${this.showOverlay}
        @keyup=${this.handleKeys}
        @close=${() => {
          this.showOverlay = false;
        }}
      >
        ${this.showOverlay
          ? html`<div part="wy-preview-layout">
              ${this.renderHeader(this.currentFile)}

              <div part="wy-preview-main">
                ${this.edit || this.isAttachment
                  ? nothing
                  : html`
                      ${this.componentFeatures?.allowsFeature(Feature.Comments)
                        ? html`
                            <aside
                              id="tab-comments"
                              part="wy-sidebar ${partMap({
                                "wy-active": this.commentsOpen,
                                "wy-maximized": this.sidePanelMaximized,
                              })}"
                              ?hidden=${!this.commentsOpen}
                            >
                              <nav>
                                <wy-item size="md">
                                  <span slot="title" part="wy-title">${msg("Comments")}</span>
                                  <wy-button
                                    slot="actions"
                                    kind="icon"
                                    @click=${() => this.toggleSidebarTab("comments", false)}
                                  >
                                    <wy-icon name="close"></wy-icon>
                                  </wy-button>
                                </wy-item>
                                <button
                                  @click=${() => (this.sidePanelMaximized = !this.sidePanelMaximized)}
                                  part="wy-sidebar-handle"
                                  title=${this.sidePanelMaximized
                                    ? msg("Restore side panel")
                                    : msg("Maximize side panel")}
                                ></button>
                              </nav>
                              <div part="wy-pane wy-scroll-y">
                                <div part="wy-pane-group">
                                ${this.commentsOpen &&
                                this.currentFile &&
                                this.currentFile.id >= 1 &&
                                this.app &&
                                this.user
                                  ? html`
                                      <wy-comment-list
                                        reveal
                                        .previousPaging=${"infinite"}
                                        .nextPaging=${"infinite"}
                                        .placeholder=${this.placeholder}
                                        .parentId=${this.currentFile.id}
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
                            <aside
                              id="tab-versions"
                              part="wy-sidebar ${partMap({
                                "wy-active": this.versionsOpen,
                                "wy-maximized": this.sidePanelMaximized,
                              })}"
                              ?hidden=${!this.versionsOpen}
                            >
                              <nav>
                                <wy-item size="md">
                                  <span slot="title" part="wy-title">${msg("Versions")}</span>
                                  <wy-button
                                    slot="actions"
                                    kind="icon"
                                    @click=${() => this.toggleSidebarTab("versions", false)}
                                  >
                                    <wy-icon name="close"></wy-icon>
                                  </wy-button>
                                </wy-item>
                                <button
                                  @click=${() => (this.sidePanelMaximized = !this.sidePanelMaximized)}
                                  part="wy-sidebar-handle"
                                  title=${this.sidePanelMaximized
                                    ? msg("Restore side panel")
                                    : msg("Maximize side panel")}
                                ></button>
                              </nav>
                              <div part="wy-pane wy-scroll-y">
                                <div part="wy-pane-body">
                                  ${this.versionsOpen && this.currentFile && this.app
                                    ? html`
                                        <wy-file-versions
                                          .file=${this.currentFile}
                                          .activeVersion=${this.currentVersionFile}
                                          .activeDraft=${this.showDraft}
                                          @file-version-select=${(e: FileVersionSelectEventType) => {
                                            this.handleVersionFile(e);
                                          }}
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

                <div part="wy-preview">
                  <div
                    ${ref((refElement: Element | undefined) => {
                      if (refElement) {
                        this.swipeScrollElement = refElement;
                      }
                    })}
                    part="wy-preview-swiper ${partMap(previewSwiperParts)}"
                  >
                    ${repeat(
                      previewFiles,
                      (previewFile) => "preview-area-" + previewFile?.id,
                      (previewFile) => {
                        const isCurrent = previewFile === this.currentVersionFile;

                        const currentPreviewFileCallback = (refElement: Element | undefined) => {
                          refElement?.scrollIntoView();
                          requestAnimationFrame(() => refElement?.scrollIntoView());
                        };

                        const previewFileRef = isCurrent
                          ? currentPreviewFileCallback
                          : previewFile === this.nextFile
                            ? this.nextRef
                            : previewFile === this.previousFile
                              ? this.prevRef
                              : undefined;

                        const fileLoadingState = this.loadingQueue.find((fls) => fls.file === previewFile);

                        return previewFile
                          ? html`
                              <div id="preview-${previewFile.id}" ${ref(previewFileRef)} part="wy-preview-area">
                                ${!isPending &&
                                (fileLoadingState?.loading || fileLoadingState?.loaded || (isCurrent && editCurrent))
                                  ? html`
                                      <wy-container fill scrollY>
                                        <wy-file-view
                                          ${isCurrent ? ref(this.currentViewRef) : nothing}
                                          .edit=${isCurrent && editCurrent}
                                          .draft=${isCurrent && this.showDraft}
                                          .file=${previewFile}
                                          .current=${isCurrent}
                                          @file-preview-loaded=${(e: FilePreviewLoadedEventType) =>
                                            this.updateLoadingState(e.detail.file, { loaded: true })}
                                        ></wy-file-view>
                                      </wy-container>
                                    `
                                  : html` <wy-progress-circular indeterminate overlay></wy-progress-circular> `}
                              </div>
                            `
                          : nothing;
                      },
                    )}
                  </div>
                  ${this.currentFile && !this.edit
                    ? html`
                        ${this.previousFile
                          ? html`
                              <nav part="wy-nav-prev">
                                <wy-button kind="icon" @click=${() => this.scrollToPrev()}>
                                  <wy-icon name="previous"></wy-icon>
                                </wy-button>
                              </nav>
                            `
                          : nothing}
                        ${this.nextFile
                          ? html`
                              <nav part="wy-nav-next">
                                <wy-button kind="icon" @click=${() => this.scrollToNext()}>
                                  <wy-icon name="next"></wy-icon>
                                </wy-button>
                              </nav>
                            `
                          : nothing}
                      `
                    : nothing}
                </div>
              </div>
            </div> `
          : nothing}
        <wy-user-card .listenTo=${this}></wy-user-card>
      </wy-overlay>
    `;
  }

  override updated(changedProperties: PropertyValueMap<this>) {
    if (
      changedProperties.has("swipeScrollElement") &&
      changedProperties.get("swipeScrollElement") !== this.swipeScrollElement
    ) {
      this.registerSwipeScroller();
    }

    if (!this.edit && !this.disableSwipeScroll && this.swipeScroller.swipeElement === this.swipeScrollElement) {
      this.swipeScroller.observe(this.prevRef.value, this.nextRef.value);
    } else {
      this.swipeScroller.clearObserver();
    }

    if (changedProperties.has("editName") && !this.editName) {
      this.setFocus();
    }
  }
}
