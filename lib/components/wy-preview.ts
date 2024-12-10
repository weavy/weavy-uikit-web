import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import type { FilesResultType, FileType } from "../types/files.types";
import type { AppType } from "../types/app.types";

import type { InfiniteData, InfiniteQueryObserverResult, QueryObserverResult } from "@tanstack/query-core";
import { localized, msg } from "@lit/localize";
import type { UserType } from "../types/users.types";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SwipeScrollController } from "../controllers/swipe-scroll-controller";
import { repeat } from "lit/directives/repeat.js";
import { PersistStateController } from "../controllers/persist-state-controller";
//import { HistoryController } from "../controllers/history-controller";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-button";
import "./wy-icon";
import "./wy-overlay";
import "./wy-spinner";
import "./wy-dropdown";
import "./wy-preview-item";
import "./wy-file-menu";
import "./wy-comment-list";
import "./wy-file-versions";

import allCss from "../scss/all.scss";

@customElement("wy-preview")
@localized()
export default class WyPreview extends BlockConsumerMixin(LitElement) {
  static override styles = [allCss];

  protected exportParts = new ShadowPartsController(this);

  @property()
  uid: string = "preview";

  @property({ attribute: false })
  files?: FileType[];

  @property({ attribute: false })
  queryResult?: QueryObserverResult<FileType[]>;

  @property({ attribute: false })
  infiniteQueryResult?: InfiniteQueryObserverResult<InfiniteData<FilesResultType, unknown>>;

  @property({ type: Object })
  override app: AppType | undefined;

  @property({ type: Object })
  override user: UserType | undefined;

  @property({ type: Number })
  currentId: number = NaN;

  @property({ type: Boolean })
  isAttachment: boolean = false;

  @state()
  currentFile?: FileType;

  @state()
  previousFile?: FileType;

  @state()
  nextFile?: FileType;

  @state()
  showOverlay = false;

  @state()
  commentsOpen = false;

  @state()
  versionsOpen = false;

  @state()
  versionFile?: FileType;

  @state()
  sidePanelMaximized = false;

  private persistState = new PersistStateController<this>(this);
  //private history = new HistoryController<this>(this);

  previewFileRef: Ref<Element> = createRef();

  swipeScrollRef: Ref<Element> = createRef();
  prevRef: Ref<Element> = createRef();
  nextRef: Ref<Element> = createRef();

  swipeScroller: SwipeScrollController = new SwipeScrollController(this);

  @state()
  private disableSwipeScroll = false;
  private disableSwipeScrollTimeout?: number;

  async open(fileId: number, showTab?: "comments" | "versions") {
    //console.log('open', fileId, showTab)

    await this.whenApp();
    await this.updateComplete;

    if (fileId) {
      this.currentId = fileId;
    }

    if (showTab) {
      this.toggleSidebarTab(showTab, true)
    }

    this.showOverlay = true;
  }

  close() {
    this.showOverlay = false;
  }

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

  handleVersionFile(e: CustomEvent) {
    this.versionFile = e.detail.versionFile;
  }

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

  scrollToPrev() {
    if (this.prevRef.value) {
      this.unblockSwipeScroll();
      this.prevRef.value.scrollIntoView({ behavior: this.weavy?.scrollBehavior });
    }
  }

  scrollToNext() {
    if (this.nextRef.value) {
      this.unblockSwipeScroll();
      this.nextRef.value.scrollIntoView({ behavior: this.weavy?.scrollBehavior });
    }
  }

  blockSwipeScroll(duration: number = 20) {
    window.clearTimeout(this.disableSwipeScrollTimeout);
    this.disableSwipeScroll = true;
    this.disableSwipeScrollTimeout = window.setTimeout(() => (this.disableSwipeScroll = false), duration);
  }

  unblockSwipeScroll() {
    window.clearTimeout(this.disableSwipeScrollTimeout);
    this.disableSwipeScroll = false;
  }

  setPrev() {
    if (this.previousFile) {
      this.currentId = this.previousFile.id;
      this.blockSwipeScroll();
    }
  }

  setNext() {
    if (this.nextFile) {
      this.currentId = this.nextFile.id;
      this.blockSwipeScroll();
    }
  }

  currentPreviewFileCallback(refElement: Element | undefined) {
    refElement?.scrollIntoView();
    requestAnimationFrame(() => refElement?.scrollIntoView());
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);

    if (changedProperties.has("app") && this.app) {
      this.persistState.observe(
        ["commentsOpen", "versionsOpen"],
        `${this.app.type}-${this.app.id.toString()}-${this.uid}`
      );

      if (this.commentsOpen && this.versionsOpen) {
        this.versionsOpen = false;
      }

      /*this.history.observe(
        ["showOverlay", "currentFile", "versionFile"],
        `${this.app.type}-${this.app.id.toString()}-${this.uid}}`
      );*/
    }

    if (changedProperties.has("queryResult") && this.queryResult) {
      const { data } = this.queryResult ?? {};
      this.files = data?.filter((file) => file && !file.is_trashed);
    }

    if (changedProperties.has("infiniteQueryResult") && this.infiniteQueryResult) {
      const { data } = this.infiniteQueryResult ?? {};
      this.files = data?.pages
        .flatMap((filesResult) => filesResult.data!)
        .filter((file) => file && !file.is_trashed)
        .filter((f) => f);
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
      this.versionFile = undefined;

      this.currentFile = this.files.find((file, index) => {
        if (this.files && file.id === this.currentId) {
          if (index >= 1) {
            this.previousFile = this.files[index - 1];
          }

          if (index < this.files.length - 1) {
            this.nextFile = this.files[index + 1];
          }

          if (this.infiniteQueryResult && index >= this.files.length - 2) {
            if (this.infiniteQueryResult.hasNextPage && !this.infiniteQueryResult.isFetchingNextPage) {
              this.infiniteQueryResult.fetchNextPage();
            }
          }

          if (this.infiniteQueryResult && index <= 1) {
            if (this.infiniteQueryResult.hasPreviousPage && !this.infiniteQueryResult.isFetchingPreviousPage) {
              this.infiniteQueryResult.fetchPreviousPage();
            }
          }

          return true;
        } else {
          return false;
        }
      });

      //console.log("files", this.files, this.currentFile, this.nextFile, this.previousFile)
    }

    if (changedProperties.has("currentFile") && this.currentFile && !this.files) {
      this.files = [this.currentFile];
    }
  }

  renderHeader(activeFile?: FileType) {
    const headerTextClasses = {
      "wy-appbar-text-trashed": Boolean(activeFile?.is_trashed),
    };

    return html` <header class="wy-appbars">
      <nav class="wy-appbar">
        <wy-button kind="icon" @click=${() => this.close()}><wy-icon name="close"></wy-icon></wy-button>
        <div class="wy-appbar-text ${classMap(headerTextClasses)}">
          ${activeFile ? html` <span>${activeFile.name}</span> ` : nothing}
        </div>
        <div class="wy-appbar-buttons wy-appbar-buttons-last">
          ${activeFile
            ? html`
                ${activeFile.id >= 1 && !this.isAttachment && this.hasFeatures?.comments
                  ? html`
                      <wy-button
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
                <wy-file-menu .file=${activeFile}>
                  ${activeFile.id >= 1 && !this.isAttachment && this.hasFeatures?.versions
                    ? html`
                        <wy-dropdown-item
                          ?active=${this.versionsOpen}
                          @click=${() => this.toggleSidebarTab("versions")}
                        >
                          <wy-icon name="backup-restore"></wy-icon>
                          ${msg("Versions")}
                        </wy-dropdown-item>
                      `
                    : nothing}
                </wy-file-menu>
              `
            : nothing}
        </div>
      </nav>
    </header>`;
  }

  override render() {
    let isPending = this.files === undefined;

    if (this.queryResult) {
      isPending = this.queryResult.isPending;
    } else if (this.infiniteQueryResult) {
      isPending = this.infiniteQueryResult.isPending;
    }

    const currentPreviewFile = this.versionFile || this.currentFile;

    // Make a short list so we can use repeat
    const previewFiles = [this.previousFile, currentPreviewFile, this.nextFile].filter((x) => x);

    if (this.commentsOpen && this.versionsOpen) {
      // both can't be open
      this.versionsOpen = false;
    }

    const previewSwiperClasses = {
      "wy-preview-swiper-disabled": this.disableSwipeScroll,
    };

    if (!this.weavy) {
      return nothing;
    }

    return html`
      <wy-overlay
        class="wy-dark"
        maximized
        .show=${this.showOverlay}
        @close=${() => {this.showOverlay = false}}
        @release-focus=${() => this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
      >
        ${this.showOverlay
          ? html`<div class="wy-preview-layout">
              ${this.renderHeader(this.currentFile)}

              <div class="wy-main">
                <aside
                  id="tab-comments"
                  class="wy-sidebar ${classMap({
                    "wy-active": this.commentsOpen,
                    "wy-maximized": this.sidePanelMaximized,
                  })}"
                  ?hidden=${!this.commentsOpen}
                >
                  <nav class="wy-item">
                    <div class="wy-item-body">
                      <div class="wy-item-title">${msg("Comments")}</div>
                    </div>
                    <wy-button kind="icon" @click=${() => this.toggleSidebarTab("comments", false)}>
                      <wy-icon name="close"></wy-icon>
                    </wy-button>
                    <button
                      @click=${() => (this.sidePanelMaximized = !this.sidePanelMaximized)}
                      class="wy-sidebar-handle"
                      title=${this.sidePanelMaximized ? msg("Restore side panel") : msg("Maximize side panel")}
                    ></button>
                  </nav>
                  <div class="wy-pane wy-scroll-y">
                    ${this.commentsOpen && this.currentFile && this.currentFile.id >= 1 && this.app && this.user
                      ? html`
                          <wy-comment-list .parentId=${this.currentFile.id} .location=${"files"}></wy-comment-list>
                        `
                      : nothing}
                  </div>
                </aside>
                <aside
                  id="tab-versions"
                  class="wy-sidebar ${classMap({
                    "wy-active": this.versionsOpen,
                    "wy-maximized": this.sidePanelMaximized,
                  })}"
                  ?hidden=${!this.versionsOpen}
                >
                  <nav class="wy-item">
                    <div class="wy-item-body">
                      <div class="wy-item-title">${msg("Versions")}</div>
                    </div>
                    <wy-button kind="icon" @click=${() => this.toggleSidebarTab("versions", false)}>
                      <wy-icon name="close"></wy-icon>
                    </wy-button>
                    <button
                      @click=${() => (this.sidePanelMaximized = !this.sidePanelMaximized)}
                      class="wy-sidebar-handle"
                      title=${this.sidePanelMaximized ? msg("Restore side panel") : msg("Maximize side panel")}
                    ></button>
                  </nav>
                  <div class="wy-pane wy-scroll-y">
                    <div class="wy-pane-body">
                      ${this.versionsOpen && this.currentFile && this.app
                        ? html`
                            <wy-file-versions
                              .file=${this.currentFile}
                              .activeVersion=${this.versionFile || this.currentFile}
                              @file-version-select=${(e: CustomEvent) => this.handleVersionFile(e)}
                            ></wy-file-versions>
                          `
                        : nothing}
                    </div>
                  </div>
                </aside>

                <div class="wy-preview">
                  <div ${ref(this.swipeScrollRef)} class="wy-preview-swiper ${classMap(previewSwiperClasses)}">
                    ${repeat(
                      previewFiles,
                      (previewFile) => "preview-area-" + previewFile?.id,
                      (previewFile) => {
                        const previewFileRef =
                          previewFile === currentPreviewFile
                            ? this.currentPreviewFileCallback
                            : previewFile === this.nextFile
                            ? this.nextRef
                            : previewFile === this.previousFile
                            ? this.prevRef
                            : undefined;

                        return previewFile
                          ? html`
                              <div
                                id="preview-${previewFile.id}"
                                ${ref(previewFileRef)}
                                class="wy-preview-area wy-scroll-y wy-scroll-x"
                              >
                                ${!isPending
                                  ? html` <wy-preview-item .file=${previewFile}></wy-preview-item> `
                                  : html` <wy-spinner overlay></wy-spinner> `}
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
                              <nav class="wy-nav-prev">
                                <wy-button kind="icon" @click=${() => this.scrollToPrev()}>
                                  <wy-icon name="previous"></wy-icon>
                                </wy-button>
                              </nav>
                            `
                          : nothing}
                        ${this.nextFile
                          ? html`
                              <nav class="wy-nav-next">
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
              </div>
            `
          : nothing}
      </wy-overlay>
    `;
  }

  override updated() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (this.swipeScrollRef.value) {
          //console.log('swipe updated')
          this.swipeScroller.whenPrev ??= async () => this.setPrev();
          this.swipeScroller.whenNext ??= async () => this.setNext();
          this.swipeScroller.createObserver(this.swipeScrollRef.value);
          this.swipeScroller.observe(this.prevRef.value, this.nextRef.value);
        } else {
          this.swipeScroller.clearObserver();
        }
      })
    );
  }
}
