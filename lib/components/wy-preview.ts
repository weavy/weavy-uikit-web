import allCss from "../scss/all.scss";

import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { type FeaturesListType, type FeaturesConfigType, Feature } from "../types/features.types";
import type { FilesResultType, FileType } from "../types/files.types";
import type { AppType } from "../types/app.types";

import type { InfiniteData, InfiniteQueryObserverResult, QueryObserverResult } from "@tanstack/query-core";
import { portal } from "lit-modal-portal";
import { hasFeature } from "../utils/features";
import { localized, msg } from "@lit/localize";
import type { UserType } from "../types/users.types";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SwipeScrollController } from "../controllers/swipe-scroll-controller";
import { repeat } from "lit/directives/repeat.js";
import { PersistStateController } from "../controllers/persist-state-controller";
import { HistoryController } from "../controllers/history-controller";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";

import "./wy-button";
import "./wy-icon";
import "./wy-overlay";
import "./wy-spinner";
import "./wy-dropdown";
import "./wy-preview-item";
import "./wy-file-menu";
import "./wy-comments";
import "./wy-file-versions";

@customElement("wy-preview")
@localized()
export default class WyPreview extends LitElement {
  static override styles = [allCss];

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property()
  uid: string = "preview";

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  @state()
  availableFeatures?: FeaturesListType = [];

  @property({ attribute: false })
  files?: FileType[];

  @property({ attribute: false })
  queryResult?: QueryObserverResult<FileType[]>;

  @property({ attribute: false })
  infiniteQueryResult?: InfiniteQueryObserverResult<InfiniteData<FilesResultType, unknown>>;

  @property({ type: Object })
  app?: AppType;

  @property({ type: Object })
  user?: UserType;

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
  private history = new HistoryController<this>(this);

  previewFileRef: Ref<Element> = createRef();

  swipeScrollRef: Ref<Element> = createRef();
  prevRef: Ref<Element> = createRef();
  nextRef: Ref<Element> = createRef();

  swipeScroller: SwipeScrollController = new SwipeScrollController(this);

  @state()
  private disableSwipeScroll = false;
  private disableSwipeScrollTimeout?: number;

  open(file?: FileType, fileList?: FileType[], uid?: string) {
    //console.log('open', file, fileList)

    if (fileList) {
      // Note: this is not updated on change
      this.files = fileList;
    }

    if (file) {
      this.currentId = file.id;
    }

    if (uid) {
      this.uid = uid;
    }

    this.showOverlay = true;
  }

  close() {
    //console.log('close')
    if (this.history.hasBackNavigation) {
      this.history.backAll();
    } else {
      this.showOverlay = false;
    }
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
      this.prevRef.value.scrollIntoView({ behavior: this.weavyContext?.scrollBehavior });
    }
  }

  scrollToNext() {
    if (this.nextRef.value) {
      this.unblockSwipeScroll();
      this.nextRef.value.scrollIntoView({ behavior: this.weavyContext?.scrollBehavior });
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
    this.currentId = this.previousFile!.id;
    this.blockSwipeScroll();
  }

  setNext() {
    this.currentId = this.nextFile!.id;
    this.blockSwipeScroll();
  }

  currentPreviewFileCallback(refElement: Element | undefined) {
    refElement?.scrollIntoView();
    requestAnimationFrame(() => refElement?.scrollIntoView());
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("app") && this.app) {
      this.persistState.observe(
        ["commentsOpen", "versionsOpen"],
        `${this.app.type}-${this.app.id.toString()}-${this.uid}`
      );
      this.history.observe(
        ["showOverlay", "currentFile", "versionFile"],
        `${this.app.type}-${this.app.id.toString()}-${this.uid}}`
      );
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
        <div class="wy-appbar-buttons">
          ${activeFile
            ? html`
                ${activeFile.id >= 1 &&
                !this.isAttachment &&
                hasFeature(this.availableFeatures, Feature.Comments, this.features?.comments)
                  ? html`
                      <wy-button
                        kind="icon"
                        ?active=${this.commentsOpen}
                        @click=${() => this.toggleSidebarTab("comments")}
                        title=${msg("Comments")}
                      >
                        <div class="wy-icon-active-stack">
                          <span class="wy-icon-stack-item"><wy-icon name="comment-outline"></wy-icon></span>
                          <span class="wy-icon-stack-item"><wy-icon name="comment"></wy-icon></span>
                        </div>
                      </wy-button>
                    `
                  : nothing}
                <wy-file-menu
                  .file=${activeFile}
                  .availableFeatures=${this.availableFeatures}
                  .features=${this.features}
                >
                  ${activeFile.id >= 1 &&
                  !this.isAttachment &&
                  hasFeature(this.availableFeatures, Feature.Versions, this.features?.versions)
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

    const previewSwiperClasses = {
      "wy-preview-swiper-disabled": this.disableSwipeScroll,
    };

    return portal(
      this.showOverlay,
      html`
        <wy-overlay
          class="wy-dark"
          maximized
          @keyup=${this.handleKeys}
          @release-focus=${() =>
            this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
        >
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
                      <wy-comments
                        .app=${this.app}
                        .user=${this.user}
                        .parentId=${this.currentFile.id}
                        .location=${"files"}
                        .availableFeatures=${this.availableFeatures}
                        .features=${this.features}
                      ></wy-comments>
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
                          .app=${this.app}
                          .file=${this.currentFile}
                          .activeVersion=${this.versionFile || this.currentFile}
                          .availableFeatures=${this.availableFeatures}
                          .features=${this.features}
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
        </wy-overlay>
      `,
      () => this.close()
    );
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
