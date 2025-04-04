import { html, nothing, type PropertyValues } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";
import { AppTypeGuid, type AppType } from "./types/app.types";
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
import type {
  FileOpenEventType,
} from "./types/files.events";
import { InfiniteQueryController } from "./controllers/infinite-query-controller";
import { InfiniteScrollController } from "./controllers/infinite-scroll-controller";
import { MutationController } from "./controllers/mutation-controller";
import { getCreateFileMutationOptions } from "./data/file-create";
import {
  type MutateAppSubscribeProps,
  getAppSubscribeMutationOptions,
  type MutateAppSubscribeContextType,
} from "./data/app";
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
import { WeavyComponent } from "./classes/weavy-component";
import { getFlatInfiniteResultData } from "./utils/query-cache";
import { ComponentFeatures, Feature } from "./contexts/features-context";

import allStyles from "./scss/all.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostFontStyles from "./scss/host-font.scss";
import colorModesStyles from "./scss/color-modes.scss";
import pagerStyles from "./scss/components/pager.scss";

import "./components/wy-files-appbar";
import "./components/wy-files-list";
import "./components/wy-preview";
import "./components/base/wy-spinner";
import "./components/wy-empty";
import "./components/base/wy-icon";

export const WY_FILES_TAGNAME = "wy-files";

declare global {
  interface HTMLElementTagNameMap {
    [WY_FILES_TAGNAME]: WyFiles;
  }
}

/**
 * Weavy component to render a list of uploaded files and linked files from cloud providers.
 *
 * @element wy-files
 * @class WyFiles
 * @extends {WeavyComponent}
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement(WY_FILES_TAGNAME)
@localized()
export class WyFiles extends WeavyComponent {
  static override styles = [colorModesStyles, allStyles, hostBlockStyles, hostFontStyles, pagerStyles];

  override componentType = AppTypeGuid.Files;

  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.CloudFiles]: true,
    [Feature.Comments]: true,
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

  protected theme = new ThemeController(this, WyFiles.styles);
  
  /**
   * The view for showing the file list.
   * This value is persisted in sessionStorage.
   */
  @property()
  view: FileViewType = "list";

  /**
   * File order in the list. Order by combined with direction.
   * This value is persisted in sessionStorage.
   * Order by: "name" | "updated_at" | "size".
   */
  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * Enable showing trashed files.
   * This value is persisted in sessionStorage.
   */
  @property({ type: Boolean })
  showTrashed: boolean = false;

  private filesQuery = new InfiniteQueryController<FilesResultType>(this);

  private persistState = new PersistStateController(this);
  //private history = new HistoryController<this>(this)

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();

  private previewRef: Ref<WeavyPreview> = createRef();

  private dropZone: DropZoneController = new DropZoneController(this);

  private appSubscribeMutation = new MutationController<
    void,
    Error,
    MutateAppSubscribeProps,
    MutateAppSubscribeContextType
  >(this);
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

  protected getFilesQueryKey(app: AppType) {
    return ["apps", app.id, "files"];
  }

  protected handleRealtimeFileCreated = (realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    realtimeEvent.file.created_by = realtimeEvent.actor;
    //addCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  protected handleRealtimeFileUpdated = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  protected handleRealtimeFileTrashed = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  protected handleRealtimeFileRestored = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //updatedCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  protected handleRealtimeFileDeleted = (_realtimeEvent: RealtimeFileEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    //removeCacheItem(this.weavy.queryClient, this.getFilesQueryKey(), realtimeEvent.file, undefined, this.order); // TODO: order must be saved somewhere in query instead?
    this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  protected handleRealtimeCommentCreated = () => {
    if (!this.weavy || !this.app) {
      return;
    }

    this.weavy.queryClient.invalidateQueries({ queryKey: this.getFilesQueryKey(this.app) });
  };

  #unsubscribeToRealtime?: () => void;

  constructor() {
    super();
    this.addEventListener("drop-files", this.handleBlobUpload);
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);

    //console.log("files willUpdate", Array.from(changedProperties.keys()), this.uid, this.weavy)
    if (
      (changedProperties.has("uid") || changedProperties.has("weavy") || changedProperties.has("user")) &&
      this.uid &&
      this.weavy &&
      this.user
    ) {
      this.persistState.observe(["view", "order", "showTrashed"], this.uid, `u${this.user.id}`);
      //this.history.observe(['view'], this.uid)
    }

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("order") ||
        changedProperties.has("showTrashed")) &&
      this.weavy &&
      this.app
    ) {
      this.filesQuery.trackInfiniteQuery(
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
      this.appSubscribeMutation.trackMutation(getAppSubscribeMutationOptions(this.weavy, this.app));

      this.uploadBlobMutation.trackMutation(getUploadBlobMutationOptions(this.weavy, this.user, this.app.id));
      this.createFileMutation.trackMutation(getCreateFileMutationOptions(this.weavy, this.user, this.app));
      this.externalBlobMutation = getExternalBlobMutation(this.weavy, this.user, this.app.id);

      this.renameFileMutation = getRenameFileMutation(this.weavy, this.app);
      this.subscribeFileMutation = getSubscribeFileMutation(this.weavy, this.app);

      this.trashFileMutation = getTrashFileMutation(this.weavy, this.app);
      this.restoreFileMutation = getRestoreFileMutation(this.weavy, this.app);
      this.deleteForeverFileMutation = getDeleteForeverFileMutation(this.weavy, this.app);

      this.#unsubscribeToRealtime?.();

      // realtime
      const subscribeGroup = `a${this.app.id}`;

      this.weavy.subscribe(subscribeGroup, "file_created", this.handleRealtimeFileCreated);
      this.weavy.subscribe(subscribeGroup, "file_updated", this.handleRealtimeFileUpdated);
      this.weavy.subscribe(subscribeGroup, "file_trashed", this.handleRealtimeFileTrashed);
      this.weavy.subscribe(subscribeGroup, "file_restored", this.handleRealtimeFileRestored);
      this.weavy.subscribe(subscribeGroup, "file_deleted", this.handleRealtimeFileDeleted);
      this.weavy.subscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);

      this.#unsubscribeToRealtime = () => {
        this.weavy?.unsubscribe(subscribeGroup, "file_created", this.handleRealtimeFileCreated);
        this.weavy?.unsubscribe(subscribeGroup, "file_updated", this.handleRealtimeFileUpdated);
        this.weavy?.unsubscribe(subscribeGroup, "file_trashed", this.handleRealtimeFileTrashed);
        this.weavy?.unsubscribe(subscribeGroup, "file_restored", this.handleRealtimeFileRestored);
        this.weavy?.unsubscribe(subscribeGroup, "file_deleted", this.handleRealtimeFileDeleted);
        this.weavy?.unsubscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override updated() {
    this.infiniteScroll.observe(this.filesQuery.result, this.pagerRef.value);
  }

  protected override render() {
    const { data, dataUpdatedAt, hasNextPage, isPending } = this.filesQuery.result;
    const isDragActive = this.dropZone.isDragActive;

    const files = getFlatInfiniteResultData(data);

    return [
      html`
        <wy-files-appbar
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
      `,
      this.app
        ? html`
            <div
              class="wy-files ${classMap({ "wy-dragging": isDragActive })}"
              data-drag-title=${msg("Drop files here to upload.")}
            >
              ${files.length
                ? html`
                    <wy-files-list
                      .view=${this.view}
                      .files=${files}
                      .dataUpdatedAt=${dataUpdatedAt}
                      .order=${this.order}
                      @file-open=${(e: FileOpenEventType) => {
                        this.previewRef.value?.open(e.detail.fileId, e.detail.tab);
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
                      ${hasNextPage ? html`<div slot="end" ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
                    </wy-files-list>
                  `
                : html`
                    <wy-empty>
                      ${isPending
                        ? html`<wy-spinner padded reveal></wy-spinner>`
                        : html` <wy-icon-display>
                            <wy-icon name="file-upload"></wy-icon>
                            <span slot="text">${msg("Add some files to get started!")}</span>
                          </wy-icon-display>`}
                    </wy-empty>
                  `}
            </div>
            ${data
              ? html` <wy-preview ${ref(this.previewRef)} .infiniteQueryResult=${this.filesQuery.result}></wy-preview> `
              : nothing}
          `
        : html`<wy-empty><wy-spinner padded reveal></wy-spinner></wy-empty>`,
    ];
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
