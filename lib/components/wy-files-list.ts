import { type PropertyValueMap, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { getBidirectionalInfiniteFileListOptions } from "../data/files";
import type { FileOrderType, FilesResultType, FileViewType } from "../types/files.types";
import {
  type RemoveFileMutationType,
  type DeleteForeverFileMutationType,
  getTrashFileMutation,
  getRestoreFileMutation,
  getDeleteForeverFileMutation,
} from "../data/file-remove";
import { type SubscribeFileMutationType, getSubscribeFileMutation } from "../data/file-subscribe";
import { RenameFileMutationType, getRenameFileMutation } from "../data/file-edit";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { AppType, EntityTypeString, PermissionType } from "../types/app.types";
import { getEntityChainMatch, hasEntityChildType } from "../utils/notifications";
import type { NamedEvent } from "../types/generic.types";
import type { OrderEventType } from "../types/lists.events";
import type { WyPreview } from "./wy-preview";
import { RealtimeFileEventType } from "../types/realtime.types";
import { ActionKindType, ActionType } from "../types/action.types";

import pagerCss from "../scss/components/pager.scss";

import "./ui/wy-icon";
import "./ui/wy-progress-circular";
import "./wy-files-grid";
import "./wy-files-table";
import "./wy-preview";
import "./wy-empty";
import { isActionEvent, WyActionEventType } from "../types/action.events";
import { Feature } from "../types/features.types";
import { hasAnyPermission } from "../utils/permission";

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
 * - [`<wy-files-grid>`](./wy-files-grid.ts)
 * - [`<wy-files-table>`](./wy-files-table.ts)
 * - [`<wy-preview>`](./wy-preview.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @csspart wy-files-list - Root wrapper (applies host styles from hostContentsCss).
 *
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an entity.
 * @fires {OrderEventType<FileOrderType>} order - Emitted when the user changes sort order.
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
   * Placeholder text for the comment editor input.
   */
  @property()
  placeholder?: string;

  /**
   * File id that is selected.
   *
   */
  @property({ type: Number })
  selectedId?: number = NaN;

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
   * Open a file in preview/edit
   * @param fileId - The id of the file to open
   * @param options.edit - Optional edit mode
   * @param options.tab - Optional tab to open in preview
   */
  preview(fileId: number, options: { edit?: boolean; tab?: "comments" | "versions" }) {
    this.highlightId = fileId;
    void this.previewRef.value?.open(fileId, options);
  }

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
   * Infinite reverse scroll controller for lazy loading.
   * @internal
   */
  private infiniteReverseScroll = new InfiniteScrollController(this, true);

  /**
   * Reference to the pager element for loading previous items.
   */
  @state()
  previousPager?: Element;

  /**
   * Reference to the pager element for loading next items.
   */
  @state()
  nextPager?: Element;

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
   * Emit an `order` event with the provided sort order.
   *
   * @param order - Order to apply.
   * @returns {boolean} True if the event was not canceled.
   */
  dispatchOrder(order: FileOrderType) {
    const event: OrderEventType<FileOrderType> = new (CustomEvent as NamedEvent)("order", { detail: { order } });
    return this.dispatchEvent(event);
  }

  protected handleActionEvent(e: WyActionEventType) {
    if (isActionEvent(e, ActionKindType.File) && e.detail.file) {
      const action = e.detail.action;
      const file = e.detail.file;

      if (e.defaultPrevented) {
        return
      }

      const hasModifyPermission = hasAnyPermission([PermissionType.Create, PermissionType.Admin], this.app?.permissions);

      if (
        (action === ActionType.Default ||
          action === ActionType.Select ||
          action === ActionType.Preview ||
          action === ActionType.Edit ||
          action === ActionType.Comment ||
          action === ActionType.History) &&
        this.componentFeatures?.allowsFeature(Feature.Previews)
      ) {
        void this.previewRef.value?.open(file.id, {
          tab:
            action === ActionType.Comment && this.componentFeatures?.allowsFeature(Feature.Comments)
              ? "comments"
              : action === ActionType.History && this.componentFeatures?.allowsFeature(Feature.Versions)
                ? "versions"
                : undefined,
          edit: action === ActionType.Edit && hasModifyPermission && this.componentFeatures?.allowsFeature(Feature.FileEdit),
        });
      } else if (action === ActionType.Rename && hasModifyPermission && this.componentFeatures?.allowsFeature(Feature.FileRename)) {
        void this.renameFileMutation?.mutate({ file: e.detail.file, name: e.detail.file.name });
      } else if (action === ActionType.Subscribe || action === ActionType.Unsubscribe) {
        void this.subscribeFileMutation?.mutate({
          file: e.detail.file,
          subscribe: action === ActionType.Subscribe,
        });
      } else if (action === ActionType.Trash && hasModifyPermission) {
        void this.trashFileMutation?.mutate({ file: e.detail.file });
      } else if (action === ActionType.Restore && hasModifyPermission) {
        void this.restoreFileMutation?.mutate({ file: e.detail.file });
      } else if (action === ActionType.DeleteForever && hasModifyPermission) {
        void this.deleteForeverFileMutation?.mutate({ file: e.detail.file });
      }
    }
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
      this.preview(this.highlightId, { tab: "comments" });
    }

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("order") ||
        changedProperties.has("showTrashed") ||
        changedProperties.has("highlightId")) &&
      this.weavy &&
      this.app
    ) {
      await this.filesQuery.trackInfiniteQuery(
        getBidirectionalInfiniteFileListOptions(this.weavy, this.app.id, {
          around: this.highlightId || undefined,
          order: this.order,
          trashed: this.showTrashed,
        }),
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
    const { data, isPending } = this.filesQuery.result;
    const hasFilesData = Boolean(data?.pages?.[0] && data.pages[0].data?.length);

    return [
      hasFilesData
        ? this.view === "grid"
          ? html`
              <wy-files-grid
                .infiniteQueryResult=${this.filesQuery.result}
                .selectedId=${this.selectedId}
                .highlightId=${this.highlightId}
                .previousPagerRef=${(el?: Element) => {
                  if (!this.previousPager?.isConnected) {
                    this.previousPager = el;
                  }
                }}
                .nextPagerRef=${(el?: Element) => {
                  if (!this.nextPager?.isConnected) this.nextPager = el;
                }}
                @wy-action=${(e: WyActionEventType) => this.handleActionEvent(e)}
                @order=${(e: OrderEventType<FileOrderType>) => this.dispatchOrder(e.detail.order)}
              ></wy-files-grid>
            `
          : html`
              <wy-files-table
                .infiniteQueryResult=${this.filesQuery.result}
                .order=${this.order}
                .selectedId=${this.selectedId}
                .highlightId=${this.highlightId}
                .previousPagerRef=${(el?: Element) => {
                  if (!this.previousPager?.isConnected) {
                    this.previousPager = el;
                  }
                }}
                .nextPagerRef=${(el?: Element) => {
                  if (!this.nextPager?.isConnected) this.nextPager = el;
                }}
                @wy-action=${(e: WyActionEventType) => this.handleActionEvent(e)}
                @order=${(e: OrderEventType<FileOrderType>) => this.dispatchOrder(e.detail.order)}
              ></wy-files-table>
            `
        : html`
            <wy-empty>
              ${isPending
                ? html`<wy-progress-circular indeterminate padded reveal></wy-progress-circular>`
                : html` <wy-icon-display>
                    <wy-icon name="file-upload"></wy-icon>
                    <span slot="text">${msg("Add some files to get started!")}</span>
                  </wy-icon-display>`}
            </wy-empty>
          `,
      html`
        <wy-preview
          ${ref(this.previewRef)}
          .placeholder=${this.placeholder}
          .infiniteQueryResult=${this.filesQuery.result}
          @wy-preview-close=${() => {
            this.dispatchAction({ action: ActionType.Select, file: null })}}
        ></wy-preview>
      `,
    ];
  }

  protected override updated() {
    this.infiniteReverseScroll.observe(this.filesQuery.result, this.previousPager as HTMLElement);
    this.infiniteScroll.observe(this.filesQuery.result, this.nextPager as HTMLElement);
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
