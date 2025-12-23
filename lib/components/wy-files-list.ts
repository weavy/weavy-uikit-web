import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { getInfiniteFileListOptions } from "../data/files";
import type { FileOrderType, FilesResultType, FileViewType } from "../types/files.types";
import type {
  FileDeleteForeverEventType,
  FileOpenEventType,
  FileRenameEventType,
  FileRestoreEventType,
  FileSubscribeEventType,
  FileTrashEventType,
} from "../types/files.events";
import {
  type RemoveFileMutationType,
  type DeleteForeverFileMutationType,
  getTrashFileMutation,
  getRestoreFileMutation,
  getDeleteForeverFileMutation,
} from "../data/file-remove";
import { type SubscribeFileMutationType, getSubscribeFileMutation } from "../data/file-subscribe";
import { RenameFileMutationType, getRenameFileMutation } from "../data/file-rename";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { AppType, EntityTypeString } from "../types/app.types";
import { getEntityChainMatch, hasEntityChildType } from "../utils/notifications";
import { getFlatInfiniteResultData } from "../utils/query-cache";
import type { NamedEvent } from "../types/generic.types";
import type { OrderEventType } from "../types/lists.events";
import type { WyPreview } from "./wy-preview";
import { RealtimeFileEventType } from "../types/realtime.types";

import pagerCss from "../scss/components/pager.scss";

import "./ui/wy-icon";
import "./ui/wy-progress-circular";
import "./wy-file-grid";
import "./wy-file-table";
import "./wy-preview";
import "./wy-empty";

declare global {
  interface HTMLElementTagNameMap {
    "wy-files-list": WyFilesList;
  }
}

/**
 * Container that renders files either in a grid or a table (list) view and proxies file events.
 *
 * **Used sub components:**
 *
 * - [`<wy-file-grid>`](./wy-file-grid.ts)
 * - [`<wy-file-table>`](./wy-file-table.ts)
 * - [`<wy-preview>`](./wy-preview.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @csspart wy-files-list - Root wrapper (applies host styles from hostContentsCss).
 * @csspart wy-pager - Pager anchor for infinite scrolling detection.
 * @csspart wy-pager-bottom - Modifier for pager placed in the bottom.
 *
 * @fires {FileOpenEventType} file-open - Emitted when a file should be opened in preview.
 * @fires {OrderEventType<FileOrderType>} order - Emitted when the user changes sort order.
 * @fires {FileEditNameEventType} edit-name - Emitted when rename mode is activated.
 * @fires {FileRenameEventType} rename - Emitted when a file is renamed.
 * @fires {FileTrashEventType} trash - Emitted when a file is trashed.
 * @fires {FileRestoreEventType} restore - Emitted when a file is restored.
 * @fires {FileDeleteForeverEventType} delete-forever - Emitted when a file is permanently deleted.
 * @fires {FileSubscribeEventType} subscribe - Emitted when subscribe state is toggled.
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-files-list")
@localized()
export class WyFilesList extends WeavySubAppComponent {
  static override styles = [pagerCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * File order in the list. Order by combined with direction.
   */
  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * The view for showing the file list.
   */
  @property()
  view: FileViewType = "list";

  /**
   * Enable showing trashed files.
   */
  @property({ type: Boolean })
  showTrashed: boolean = false;

  /**
   * File id that should be highlighted and scrolled into view.
   *
   * @internal
   */
  @state()
  highlightId?: number = NaN;

  /**
   * Whether the highlighted entity targets a comment thread.
   *
   * @internal
   */
  @state()
  highlightComment: boolean = false;

  /**
   * Query controller tracking the paged file list.
   * @internal
   */
  private filesQuery = new InfiniteQueryController<FilesResultType>(this);

  /**
   * Mutation handling rename requests.
   * @internal
   */
  private renameFileMutation?: RenameFileMutationType;

  /**
   * Mutation handling subscribe/unsubscribe actions.
   * @internal
   */
  private subscribeFileMutation?: SubscribeFileMutationType;

  /**
   * Mutation handling file trashing.
   * @internal
   */
  private trashFileMutation?: RemoveFileMutationType;

  /**
   * Mutation handling file restoration.
   * @internal
   */
  private restoreFileMutation?: RemoveFileMutationType;

  /**
   * Mutation handling permanent deletion.
   * @internal
   */
  private deleteForeverFileMutation?: DeleteForeverFileMutationType;

  /**
   * Reference to the preview overlay component.
   * @internal
   */
  private previewRef: Ref<WyPreview> = createRef();

  /**
   * Infinite scroll controller for lazy loading.
   * @internal
   */
  private infiniteScroll = new InfiniteScrollController(this);

  /**
   * Intersection target for infinite scrolling.
   * @internal
   */
  private pagerRef: Ref<HTMLElement> = createRef();

  /**
   * Resolve the query key used for the app file listing.
   *
   * @internal
   * @param app - App owning the files.
   */
  protected getFilesQueryKey(app: AppType) {
    return ["apps", app.id, "files"];
  }

  /** Handler for realtime file creation events */
  protected handleRealtimeFileCreated = (realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    realtimeEvent.file.created_by = realtimeEvent.actor;
    //addCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    void this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  /**
   * Refresh data after realtime file updates.
   * @internal
   */
  protected handleRealtimeFileUpdated = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    void this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  /**
   * Refresh data after files are trashed.
   * @internal
   */
  protected handleRealtimeFileTrashed = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    void this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  /**
   * Refresh data after files are restored.
   * @internal
   */
  protected handleRealtimeFileRestored = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    void this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  /**
   * Refresh data after files are deleted.
   * @internal
   */
  protected handleRealtimeFileDeleted = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //removeCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    void this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  /**
   * Refresh data when a comment is added to a file.
   * @internal
   */
  protected handleRealtimeCommentCreated = () => {
    if (!this.weavy || !this.app) {
      return;
    }

    void this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  /**
   * Emit a `file-open` event requesting preview for the supplied file.
   *
   * @param fileId - Identifier of the file to open.
   * @param tab - Optional preview tab to activate.
   * @returns {boolean} True if the event was not canceled.
   */
  dispatchFileOpen(fileId: number, tab?: "comments" | "versions") {
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId, tab } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit an `order` event with the provided sort order.
   *
   * @param order - Order to apply.
   * @returns {boolean} True if the event was not canceled.
   */
  dispatchOrder(order: FileOrderType) {
    const event: OrderEventType<FileOrderType> = new (CustomEvent as NamedEvent)("order", { detail: { order } });
    return this.dispatchEvent(event);
  }

  /**
   * Active realtime unsubscribe callback, if any.
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (changedProperties.has("link")) {
      this.highlightId = this.link && getEntityChainMatch(this.link, EntityTypeString.File)?.id;
      this.highlightComment =
        this.link && this.highlightId
          ? hasEntityChildType(this.link, EntityTypeString.File, { id: this.highlightId }, EntityTypeString.Comment)
          : false;
    }

    if (changedProperties.has("highlightComment") && this.highlightComment && this.highlightId) {
      this.dispatchFileOpen(this.highlightId, "comments");
    }

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("order") ||
        changedProperties.has("showTrashed")) &&
      this.weavy &&
      this.app
    ) {
      await this.filesQuery.trackInfiniteQuery(
        getInfiniteFileListOptions(this.weavy, this.app.id, {
          order: this.order,
          trashed: this.showTrashed,
        })
      );
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("user")) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      this.renameFileMutation = getRenameFileMutation(this.weavy, this.app);
      this.subscribeFileMutation = getSubscribeFileMutation(this.weavy, this.app);

      this.trashFileMutation = getTrashFileMutation(this.weavy, this.app);
      this.restoreFileMutation = getRestoreFileMutation(this.weavy, this.app);
      this.deleteForeverFileMutation = getDeleteForeverFileMutation(this.weavy, this.app);

      this.#unsubscribeToRealtime?.();

      // realtime
      const subscribeGroup = `a${this.app.id}`;

      void this.weavy.subscribe(subscribeGroup, "file_created", this.handleRealtimeFileCreated);
      void this.weavy.subscribe(subscribeGroup, "file_updated", this.handleRealtimeFileUpdated);
      void this.weavy.subscribe(subscribeGroup, "file_trashed", this.handleRealtimeFileTrashed);
      void this.weavy.subscribe(subscribeGroup, "file_restored", this.handleRealtimeFileRestored);
      void this.weavy.subscribe(subscribeGroup, "file_deleted", this.handleRealtimeFileDeleted);
      void this.weavy.subscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);

      this.#unsubscribeToRealtime = () => {
        void this.weavy?.unsubscribe(subscribeGroup, "file_created", this.handleRealtimeFileCreated);
        void this.weavy?.unsubscribe(subscribeGroup, "file_updated", this.handleRealtimeFileUpdated);
        void this.weavy?.unsubscribe(subscribeGroup, "file_trashed", this.handleRealtimeFileTrashed);
        void this.weavy?.unsubscribe(subscribeGroup, "file_restored", this.handleRealtimeFileRestored);
        void this.weavy?.unsubscribe(subscribeGroup, "file_deleted", this.handleRealtimeFileDeleted);
        void this.weavy?.unsubscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  override render() {
    const { data, hasNextPage, isPending } = this.filesQuery.result;
    const files = getFlatInfiniteResultData(data);

    if (files && files.length) {
      return html`
        ${this.view === "grid"
          ? html`
              <wy-file-grid
                .files=${files}
                .highlightId=${this.highlightId}
                @file-open=${(e: FileOpenEventType) => {
                  void this.previewRef.value?.open(e.detail.fileId, e.detail.tab);
                }}
                @order=${(e: OrderEventType<FileOrderType>) => this.dispatchOrder(e.detail.order)}
                @rename=${(e: FileRenameEventType) => {
                  void this.renameFileMutation?.mutate({ file: e.detail.file, name: e.detail.name });
                }}
                @subscribe=${(e: FileSubscribeEventType) => {
                  void this.subscribeFileMutation?.mutate({
                    file: e.detail.file,
                    subscribe: e.detail.subscribe,
                  });
                }}
                @trash=${(e: FileTrashEventType) => {
                  void this.trashFileMutation?.mutate({ file: e.detail.file });
                }}
                @restore=${(e: FileRestoreEventType) => {
                  void this.restoreFileMutation?.mutate({ file: e.detail.file });
                }}
                @delete-forever=${(e: FileDeleteForeverEventType) => {
                  void this.deleteForeverFileMutation?.mutate({ file: e.detail.file });
                }}
              ></wy-file-grid>
            `
          : html`
              <wy-file-table
                .files=${files}
                .order=${this.order}
                .highlightId=${this.highlightId}
                @file-open=${(e: FileOpenEventType) => {
                  void this.previewRef.value?.open(e.detail.fileId, e.detail.tab);
                }}
                @order=${(e: OrderEventType<FileOrderType>) => this.dispatchOrder(e.detail.order)}
                @rename=${(e: FileRenameEventType) => {
                  void this.renameFileMutation?.mutate({ file: e.detail.file, name: e.detail.name });
                }}
                @subscribe=${(e: FileSubscribeEventType) => {
                  void this.subscribeFileMutation?.mutate({
                    file: e.detail.file,
                    subscribe: e.detail.subscribe,
                  });
                }}
                @trash=${(e: FileTrashEventType) => {
                  void this.trashFileMutation?.mutate({ file: e.detail.file });
                }}
                @restore=${(e: FileRestoreEventType) => {
                  void this.restoreFileMutation?.mutate({ file: e.detail.file });
                }}
                @delete-forever=${(e: FileDeleteForeverEventType) => {
                  void this.deleteForeverFileMutation?.mutate({ file: e.detail.file });
                }}
              ></wy-file-table>
            `}
        ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
        ${data
          ? html` <wy-preview ${ref(this.previewRef)} .infiniteQueryResult=${this.filesQuery.result}></wy-preview> `
          : nothing}
      `;
    } else {
      return html`
        <wy-empty>
          ${isPending
            ? html`<wy-progress-circular indeterminate padded reveal></wy-progress-circular>`
            : html` <wy-icon-display>
                <wy-icon name="file-upload"></wy-icon>
                <span slot="text">${msg("Add some files to get started!")}</span>
              </wy-icon-display>`}
        </wy-empty>
      `;
    }
  }

  protected override updated() {
    this.infiniteScroll.observe(this.filesQuery.result, this.pagerRef.value);
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
