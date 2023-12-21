import filesCss from "./scss/all.scss";
import colorModes from "./scss/colormodes.scss";

import "./components/wy-dropdown";
import "./components/wy-button";
import "./components/wy-overlay";
import "./components/wy-files-appbar";
import "./components/wy-files-list";
import "./components/wy-preview";
import "./components/wy-spinner";

import { LitElement, html, nothing, css, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";

import { ContextConsumer } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "./client/context-definition";

import { getApiOptions } from "./data/api";
import type { AppType } from "./types/app.types";
import type { UserType } from "./types/users.types";
import type { FeaturesListType, FeaturesConfigType } from "./types/features.types";

import { getInfiniteFileListOptions } from "./data/files";

import type {
  FileOrderType,
  FilesResultType,
  BlobType,
  CreateFileProps,
  FileType,
  MutateFileProps,
  FileMutationContextType,
  FileViewType,
} from "./types/files.types";

import { InfiniteQueryController } from "./controllers/infinite-query-controller";
import { InfiniteScrollController } from "./controllers/infinite-scroll-controller";
import { MutationController } from "./controllers/mutation-controller";
import { getCreateFileMutationOptions } from "./data/file-create";

import { type MutateAppSubscribeProps, getAppSubscribeMutationOptions, type MutateAppSubscribeContextType } from "./data/app";
import { QueryController } from "./controllers/query-controller";
import { RenameFileMutationType, getRenameFileMutation } from "./data/file-rename";
import {
  type RemoveFileMutationType,
  type DeleteForeverFileMutationType,
  getTrashFileMutation,
  getRestoreFileMutation,
  getDeleteForeverFileMutation,
} from "./data/file-remove";
import { type SubscribeFileMutationType, getSubscribeFileMutation } from "./data/file-subscribe";
import { getUploadBlobMutationOptions } from "./data/blob-upload";
import { ExternalBlobMutationType, getExternalBlobMutation } from "./data/blob-external";
import { DropZoneController } from "./controllers/dropzone-controller";
import type WeavyPreview from "./components/wy-preview";
import { localized, msg } from "@lit/localize";
//import { HistoryController } from './controllers/history-controller'
import { PersistStateController } from "./controllers/persist-state-controller";
import { ThemeController } from "./controllers/theme-controller";
import { RealtimeFileEventType } from "./types/realtime.types";
import "./components/wy-empty";
import { whenParentsDefined } from "./utils/dom";

/**
 * Files component to render a list of uploaded files and linked files from cloud providers.
 *
 * @element wy-files
 * @class WyFiles
 */
@customElement("wy-files")
@localized()
export default class WyFiles extends LitElement {
  static override styles = [
    colorModes,
    filesCss,
    css`
      :host {
        min-height: 100%;
        display: flex;
        flex-direction: column;
        width: 100%;
      }
    `,
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContext }, this>;

  // Manually consumed in performUpdate()
  @state()
  protected weavyContext?: WeavyContext;

  /**
   * Unique identifier for your app component.
   * The uid should correspond to the uid of the app created using the server-to-server Web API.
   */
  @property()
  uid!: string;

  /**
   * Config for disabling features in the component.
   * *Note: You can't enable any features that aren't available in your license.*
   */
  @property({ type: Object })
  features: FeaturesConfigType = {};

  /**
   * The view for showing the file list.
   * This value is persisted in sessionStorage.
   */
  @property()
  view: FileViewType = "list";

  /**
   * File order in the list. Order by combined with direction.
   * This value is persisted in sessionStorage.
   * Order by: "id" | "name" | "size" | "created_at" | "modified_at" | "timestamp".
   */
  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * Enable showing trashed files.
   * This value is persisted in sessionStorage.
   */
  @property({ type: Boolean })
  showTrashed: boolean = false;

  @state()
  protected app?: AppType;

  @state()
  protected user?: UserType;

  @state()
  protected availableFeatures?: FeaturesListType = [];

  /**
   * Event: New file created.
   * @event wy:file_created
   */
  protected realtimeFileCreatedEvent = (realtimeEvent: RealtimeFileEventType) =>
    new CustomEvent("wy:file_created", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: File updated.
   * @event wy:file_updated
   */
  protected realtimeFileUpdatedEvent = (realtimeEvent: RealtimeFileEventType) =>
    new CustomEvent("wy:file_updated", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: File trashed.
   * @event wy:file_trashed
   */
  protected realtimeFileTrashedEvent = (realtimeEvent: RealtimeFileEventType) =>
    new CustomEvent("wy:file_trashed", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: File restored.
   * @event wy:file_restored
   */
  protected realtimeFileRestoredEvent = (realtimeEvent: RealtimeFileEventType) =>
    new CustomEvent("wy:file_restored", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: File permanently deleted.
   * @event wy:file_deleted
   */
  protected realtimeFileDeletedEvent = (realtimeEvent: RealtimeFileEventType) =>
    new CustomEvent("wy:file_deleted", { bubbles: true, composed: false, detail: realtimeEvent });

  private appQuery = new QueryController<AppType>(this);
  private userQuery = new QueryController<UserType>(this);
  private featuresQuery = new QueryController<FeaturesListType>(this);

  private filesQuery = new InfiniteQueryController<FilesResultType>(this);

  private persistState = new PersistStateController<this>(this);
  //private history = new HistoryController<this>(this)

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<Element> = createRef();

  private previewRef: Ref<WeavyPreview> = createRef();

  private dropZone: DropZoneController = new DropZoneController(this);

  private appSubscribeMutation = new MutationController<AppType, Error, MutateAppSubscribeProps, MutateAppSubscribeContextType>(this);
  private uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>(this);
  private externalBlobMutation?: ExternalBlobMutationType;
  private createFileMutation = new MutationController<FileType, Error, CreateFileProps, FileMutationContextType>(this);

  private renameFileMutation?: RenameFileMutationType;
  private subscribeFileMutation?: SubscribeFileMutationType;

  private trashFileMutation?: RemoveFileMutationType;
  private restoreFileMutation?: RemoveFileMutationType;
  private deleteForeverFileMutation?: DeleteForeverFileMutationType;

  // upload files
  private handleBlobUpload(e: Event) {
    const eventDetail = (e as CustomEvent).detail;
    if (eventDetail.files) {
      for (let i = 0; i < eventDetail.files.length; i++) {
        const file = eventDetail.files[i];
        const fileProps = { file: file };
        this.uploadBlobMutation.mutate(fileProps).then((blob) => this.handleCreateFile(blob));
      }

      if (eventDetail.input) {
        eventDetail.input.value = "";
      }
    }
  }

  // upload files
  private handleExternalBlobs(e: CustomEvent) {    
    if (e.detail.externalBlobs) {
      for (let i = 0; i < e.detail.externalBlobs.length; i++) {
        const externalBlob = e.detail.externalBlobs[i];
        this.externalBlobMutation?.mutate({ externalBlob }).then((blob) => this.handleCreateFile(blob));
      }
    }
  }

  // add uploaded files
  private async handleCreateFile(blob: BlobType, replace?: boolean) {    
    return await this.createFileMutation.mutate({ blob, replace });
  }

  private handleSubscribe(subscribe: boolean) {
    if (this.app?.id) {
      this.appSubscribeMutation.mutate({ subscribe });
    }
  }

  protected getFilesQueryKey() {
    return ["apps", this.app!.id, "files"];
  }

  protected handleRealtimeFileCreated = (realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavyContext) {
      return;
    }

    realtimeEvent.file.created_by = realtimeEvent.actor;
    //addCacheItem(this.weavyContext.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavyContext.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey() });

    this.dispatchEvent(this.realtimeFileCreatedEvent(realtimeEvent));
  };

  protected handleRealtimeFileUpdated = (realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavyContext || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavyContext.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavyContext.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey() });

    this.dispatchEvent(this.realtimeFileUpdatedEvent(realtimeEvent));
  };

  protected handleRealtimeFileTrashed = (realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavyContext || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavyContext.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavyContext.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey() });

    this.dispatchEvent(this.realtimeFileTrashedEvent(realtimeEvent));
  };

  protected handleRealtimeFileRestored = (realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavyContext || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavyContext.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavyContext.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey() });

    this.dispatchEvent(this.realtimeFileRestoredEvent(realtimeEvent));
  };

  protected handleRealtimeFileDeleted = (realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavyContext || !this.app) {
      return;
    }

    //removeCacheItem(this.weavyContext.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavyContext.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey() });

    this.dispatchEvent(this.realtimeFileDeletedEvent(realtimeEvent));
  };

  private unsubscribeToRealtime(app: AppType) {
    if (!this.weavyContext) {
      return;
    }

    this.weavyContext.unsubscribe(`a${app.id}`, "file_created", this.handleRealtimeFileCreated);
    this.weavyContext.unsubscribe(`a${app.id}`, "file_updated", this.handleRealtimeFileUpdated);
    this.weavyContext.unsubscribe(`a${app.id}`, "file_trashed", this.handleRealtimeFileTrashed);
    this.weavyContext.unsubscribe(`a${app.id}`, "file_restored", this.handleRealtimeFileRestored);
    this.weavyContext.unsubscribe(`a${app.id}`, "file_deleted", this.handleRealtimeFileDeleted);
  }

  constructor() {
    super();
    this.addEventListener("drop-files", this.handleBlobUpload);
    new ThemeController(this, WyFiles.styles);
  }

  override async performUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.performUpdate();
  }

  protected override willUpdate(changedProperties: PropertyValues<this & { app: AppType, weavyContext: WeavyContext, user: UserType }>) {
    if (changedProperties.has("app")) {
      const lastApp = changedProperties.get("app");

      if (lastApp && lastApp !== this.app) {
        this.unsubscribeToRealtime(lastApp);
      }
    }

    //console.log("files willUpdate", Array.from(changedProperties.keys()), this.uid, this.weavyContext)
    if ((changedProperties.has("uid") || changedProperties.has("weavyContext")) && this.uid && this.weavyContext) {
      this.appQuery.trackQuery(getApiOptions<AppType>(this.weavyContext, ["apps", this.uid]));
      this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));
      this.featuresQuery.trackQuery(getApiOptions<FeaturesListType>(this.weavyContext, ["features", "files"]));

      this.persistState.observe(["view", "order", "showTrashed"], this.uid);
      //this.history.observe(['view'], this.uid)
    }

    if (!this.appQuery.result?.isPending) {
      this.app = this.appQuery.result?.data;
    }

    if (!this.userQuery.result?.isPending) {
      this.user = this.userQuery.result?.data;
    }

    if (!this.featuresQuery.result?.isPending) {
      this.availableFeatures = this.featuresQuery.result?.data;
    }

    if (
      (changedProperties.has("weavyContext") ||
        changedProperties.has("app") ||
        changedProperties.has("order") ||
        changedProperties.has("showTrashed")) &&
      this.weavyContext &&
      this.app
    ) {
      this.filesQuery.trackInfiniteQuery(
        getInfiniteFileListOptions(this.weavyContext, this.app.id, {
          order: this.order,
          trashed: this.showTrashed,
        })
      );
    }

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("app") || changedProperties.has("user")) &&
      this.weavyContext &&
      this.app &&
      this.user
    ) {
      this.appSubscribeMutation.trackMutation(getAppSubscribeMutationOptions(this.weavyContext, this.app));

      this.uploadBlobMutation.trackMutation(getUploadBlobMutationOptions(this.weavyContext, this.user, this.app));
      this.createFileMutation.trackMutation(getCreateFileMutationOptions(this.weavyContext, this.user, this.app));
      this.externalBlobMutation = getExternalBlobMutation(this.weavyContext, this.user, this.app);

      this.renameFileMutation = getRenameFileMutation(this.weavyContext, this.app);
      this.subscribeFileMutation = getSubscribeFileMutation(this.weavyContext, this.app);

      this.trashFileMutation = getTrashFileMutation(this.weavyContext, this.app);
      this.restoreFileMutation = getRestoreFileMutation(this.weavyContext, this.app);
      this.deleteForeverFileMutation = getDeleteForeverFileMutation(this.weavyContext, this.app);

      // realtime
      this.weavyContext.subscribe(`a${this.app.id}`, "file_created", this.handleRealtimeFileCreated);
      this.weavyContext.subscribe(`a${this.app.id}`, "file_updated", this.handleRealtimeFileUpdated);
      this.weavyContext.subscribe(`a${this.app.id}`, "file_trashed", this.handleRealtimeFileTrashed);
      this.weavyContext.subscribe(`a${this.app.id}`, "file_restored", this.handleRealtimeFileRestored);
      this.weavyContext.subscribe(`a${this.app.id}`, "file_deleted", this.handleRealtimeFileDeleted);
    }
  }

  protected override updated() {
    this.infiniteScroll.observe(this.filesQuery.result, this.pagerRef.value);
  }

  protected override render() {
    const { isPending: networkIsPending } = this.weavyContext?.network ?? { isPending: true };
    const { data, isPending, dataUpdatedAt } = this.filesQuery.result ?? { isPending: networkIsPending };
    const isDragActive = this.dropZone.isDragActive;

    const files: FileType[] = (data?.pages.flatMap((filesResult) => filesResult.data!) || []).filter((f) => f);

    return html`
      <wy-files-appbar
        .app=${this.app}
        .user=${this.user}
        .availableFeatures=${this.availableFeatures}
        .features=${this.features}
        .order=${this.order}
        .showTrashed=${this.showTrashed}
        .view=${this.view}
        @upload-files=${this.handleBlobUpload}
        @external-blobs=${this.handleExternalBlobs}
        @create-files=${(e: CustomEvent) =>
          (e.detail.blobs as BlobType[]).forEach((blob) => this.handleCreateFile(blob, e.detail.replace))}
        @order=${(e: CustomEvent) => {
          this.order = e.detail.order;
        }}
        @show-trashed=${(e: CustomEvent) => {
          this.showTrashed = e.detail.showTrashed;
        }}
        @view=${(e: CustomEvent) => {
          this.view = e.detail.view;
        }}
        @subscribe=${(e: CustomEvent) => this.handleSubscribe(e.detail.subscribe)}
      >
      </wy-files-appbar>

      <div
        class="wy-files ${classMap({ "wy-dragging": isDragActive })}"
        data-drag-title=${msg("Drop files here to upload.")}
        title=${msg("Drop files here to upload.")}
      >
        ${!isPending
          ? files.length
            ? html`
                <wy-files-list
                  .view=${this.view}
                  .files=${files}
                  .dataUpdatedAt=${dataUpdatedAt}
                  .order=${this.order}
                  .availableFeatures=${this.availableFeatures}
                  .features=${this.features}
                  @file-open=${(e: CustomEvent) => {
                    this.previewRef.value?.open(e.detail.file);
                  }}
                  @order=${(e: CustomEvent) => {
                    this.order = e.detail.order;
                  }}
                  @rename=${(e: CustomEvent) => {
                    this.renameFileMutation?.mutate({ file: e.detail.file, name: e.detail.name });
                  }}
                  @subscribe=${(e: CustomEvent) => {
                    this.subscribeFileMutation?.mutate({
                      file: e.detail.file,
                      subscribe: e.detail.subscribe,
                    });
                  }}
                  @trash=${(e: CustomEvent) => {
                    this.trashFileMutation?.mutate({ file: e.detail.file });
                  }}
                  @restore=${(e: CustomEvent) => {
                    this.restoreFileMutation?.mutate({ file: e.detail.file });
                  }}
                  @delete-forever=${(e: CustomEvent) => {
                    this.deleteForeverFileMutation?.mutate({ file: e.detail.file });
                  }}
                >
                </wy-files-list>
              `
            : html`
                <wy-empty>
                  <div class="wy-content-icon">
                    <div class="wy-content-icon">
                      <wy-icon name="file-upload"></wy-icon>
                    </div>
                    <div class="wy-content-name">
                      <span>${msg("Add some files to get started!")}</span>
                    </div>
                  </div>
                </wy-empty>
              `
          : html`<wy-empty><wy-spinner overlay></wy-spinner></wy-empty>`}
        <div ${ref(this.pagerRef)} class="wy-pager"></div>
      </div>
      ${!isPending
        ? html`
            <wy-preview
              ${ref(this.previewRef)}
              .app=${this.app}
              .user=${this.user}
              .infiniteQueryResult=${this.filesQuery.result}
              .availableFeatures=${this.availableFeatures}
              .features=${this.features}
            ></wy-preview>
          `
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext && this.app) {
      // realtime
      this.unsubscribeToRealtime(this.app);
    }
    super.disconnectedCallback();
  }
}
