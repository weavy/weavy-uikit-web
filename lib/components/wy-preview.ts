import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import type { FileLoadingState, FilesResultType, FileType } from "../types/files.types";
import type {
  FilePreviewLoadedEventType,
  FileVersionSelectEventType,
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
import { partMap } from "../utils/directives/shadow-part-map";

import previewCss from "../scss/components/preview.scss";
import sidebarCss from "../scss/components/sidebar.scss";
import textCss from "../scss/components/text.scss";
import paneCss from "../scss/components/pane.scss";
import scrollCss from "../scss/scroll.scss";
import colorModesCss from "../scss/color-modes.scss";

import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./ui/wy-overlay";
import "./ui/wy-progress-circular";
import "./ui/wy-titlebar";
import "./wy-preview-item";
import "./wy-file-menu";
import "./wy-comment-list";
import "./wy-file-versions";

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
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-titlebar>`](./ui/wy-titlebar.ts)
 * - [`<wy-preview-item>`](./wy-preview-item.ts)
 * - [`<wy-file-menu>`](./wy-file-menu.ts)
 * - [`<wy-comment-list>`](./wy-comment-list.ts)
 * - [`<wy-file-versions>`](./wy-file-versions.ts)
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
   * Reference to the current preview element.
   *
   * @internal
   */
  protected previewFileRef: Ref<Element> = createRef();

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
  async open(fileId: number, showTab?: "comments" | "versions") {
    await this.whenApp();
    await this.updateComplete;

    if (fileId) {
      this.currentId = fileId;
    }

    if (showTab) {
      this.toggleSidebarTab(showTab, true);
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
    if (this.prevRef.value) {
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
    if (this.nextRef.value) {
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
    if (this.previousFile) {
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
    if (this.nextFile) {
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
    if (this.swipeScrollElement) {
      this.swipeScroller.whenPrev ??= () => this.setPrev();
      this.swipeScroller.whenNext ??= () => this.setNext();
      this.swipeScroller.createObserver(this.swipeScrollElement);
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
        `u${this.user.id}`
      );

      if (this.commentsOpen && this.versionsOpen) {
        this.versionsOpen = false;
      }
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

    if (
      (changedProperties.has("files") || changedProperties.has("currentId") || changedProperties.has("showOverlay")) &&
      this.files &&
      this.showOverlay
    ) {
      this.currentFile = undefined;
      this.previousFile = undefined;
      this.nextFile = undefined;
      this.currentVersionFile = undefined;

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
        <wy-button slot="icon" kind="icon" @click=${() => this.close()}><wy-icon name="close"></wy-icon></wy-button>
        ${activeFile ? html` <span slot="title">${activeFile.name}</span> ` : nothing}
        ${activeFile
          ? html`
              ${this.componentFeatures?.allowsFeature(Feature.Comments) && activeFile.id >= 1 && !this.isAttachment
                ? html`
                    <wy-button
                      slot="actions"
                      kind="icon"
                      ?active=${this.commentsOpen}
                      @click=${() => this.toggleSidebarTab("comments")}
                      title=${msg("Comments")}
                    >
                      <wy-icon-stack>
                        ${activeFile.comments?.count && activeFile.comments?.count > 0
                          ? html`<wy-icon name="comment" state ?active=${!this.commentsOpen}></wy-icon>
                              <wy-icon name="comment" layer state ?active=${this.commentsOpen}></wy-icon>`
                          : html`<wy-icon name="comment-outline" state ?active=${!this.commentsOpen}></wy-icon>
                              <wy-icon name="comment" layer state ?active=${this.commentsOpen}></wy-icon>`}
                      </wy-icon-stack>
                    </wy-button>
                  `
                : nothing}
              <wy-file-menu slot="actions" .file=${activeFile}>
                ${this.componentFeatures?.allowsFeature(Feature.Versions) && activeFile.id >= 1 && !this.isAttachment
                  ? html`
                      <wy-dropdown-item ?active=${this.versionsOpen} @click=${() => this.toggleSidebarTab("versions")}>
                        <wy-icon name="backup-restore"></wy-icon>
                        ${msg("Versions")}
                      </wy-dropdown-item>
                    `
                  : nothing}
              </wy-file-menu>
            `
          : nothing}
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

    // Make a short list so we can use repeat
    const previewFiles = [this.previousFile, this.currentVersionFile, this.nextFile].filter((x) => x);

    if (this.commentsOpen && this.versionsOpen) {
      // both can't be open
      this.versionsOpen = false;
    }

    const previewSwiperParts = {
      "wy-preview-swiper-disabled": this.disableSwipeScroll,
    };

    if (!this.weavy) {
      return nothing;
    }

    return html`
      <wy-overlay
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
                ${this.isAttachment
                  ? nothing
                  : html` <aside
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
                            title=${this.sidePanelMaximized ? msg("Restore side panel") : msg("Maximize side panel")}
                          ></button>
                        </nav>
                        <div part="wy-pane wy-scroll-y">
                          ${this.commentsOpen && this.currentFile && this.currentFile.id >= 1 && this.app && this.user
                            ? html`
                                <wy-comment-list
                                  reveal
                                  .parentId=${this.currentFile.id}
                                  .location=${"files"}
                                ></wy-comment-list>
                              `
                            : nothing}
                        </div>
                      </aside>
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
                            title=${this.sidePanelMaximized ? msg("Restore side panel") : msg("Maximize side panel")}
                          ></button>
                        </nav>
                        <div part="wy-pane wy-scroll-y">
                          <div part="wy-pane-body">
                            ${this.versionsOpen && this.currentFile && this.app
                              ? html`
                                  <wy-file-versions
                                    .file=${this.currentFile}
                                    .activeVersion=${this.currentVersionFile}
                                    @file-version-select=${(e: FileVersionSelectEventType) => this.handleVersionFile(e)}
                                  ></wy-file-versions>
                                `
                              : nothing}
                          </div>
                        </div>
                      </aside>`}

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
                        const currentPreviewFileCallback = (refElement: Element | undefined) => {
                          refElement?.scrollIntoView();
                          requestAnimationFrame(() => refElement?.scrollIntoView());
                        };

                        const previewFileRef =
                          previewFile === this.currentVersionFile
                            ? currentPreviewFileCallback
                            : previewFile === this.nextFile
                            ? this.nextRef
                            : previewFile === this.previousFile
                            ? this.prevRef
                            : undefined;

                        const fileLoadingState = this.loadingQueue.find((fls) => fls.file === previewFile);

                        return previewFile
                          ? html`
                              <div
                                id="preview-${previewFile.id}"
                                ${ref(previewFileRef)}
                                part="wy-preview-area wy-scroll-x-y"
                              >
                                ${!isPending && (fileLoadingState?.loading || fileLoadingState?.loaded)
                                  ? html`
                                      <wy-preview-item
                                        .file=${previewFile}
                                        ?current=${previewFile === this.currentVersionFile}
                                        @file-preview-loaded=${(e: FilePreviewLoadedEventType) =>
                                          this.updateLoadingState(e.detail.file, { loaded: true })}
                                      ></wy-preview-item>
                                    `
                                  : html` <wy-progress-circular indeterminate overlay></wy-progress-circular> `}
                              </div>
                            `
                          : nothing;
                      }
                    )}
                  </div>
                  ${this.currentFile
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

    if (!this.disableSwipeScroll && this.swipeScroller.swipeElement === this.swipeScrollElement) {
      this.swipeScroller.observe(this.prevRef.value, this.nextRef.value);
    } else {
      this.swipeScroller.clearObserver();
    }
  }
}
