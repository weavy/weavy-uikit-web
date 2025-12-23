import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { PermissionType } from "../types/app.types";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { localized, msg } from "@lit/localize";
import {
  getFileMutationsByConflictOrError,
  getFileMutationsTotalProgress,
  getFileMutationsTotalStatus,
  getPendingFileMutations,
  removeErroredFileMutations,
  removeSettledFileMutations,
} from "../data/file-create";
import type {
  BlobType,
  FileMutationContextType,
  FileOrderType,
  FileStatusType,
  FileType,
  CreateFileProps,
  ExternalBlobType,
  FileViewType,
} from "../types/files.types";
import { MutationStateController } from "../controllers/mutation-state-controller";
import { openUrl } from "../utils/urls";
import { MutationState } from "@tanstack/query-core";
import { toUpperCaseFirst } from "../utils/strings";
import type { WyCloudFiles } from "./wy-cloud-files";
import { removeMutation } from "../utils/mutation-cache";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { hasPermission } from "../utils/permission";
import { Feature } from "../types/features.types";
import type { CreateFilesEventType, ExternalBlobsEventType, UploadFilesEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";
import type { OrderEventType, ShowTrashedEventType, ViewEventType } from "../types/lists.events";
import type { SubscribeEventType } from "../types/app.events";
import { hasAbort } from "../controllers/mutation-controller";

import headerCss from "../scss/components/header.scss";
import toolbarCss from "../scss/components/toolbar.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-progress-circular";
import "./ui/wy-overlay";
import "./ui/wy-container";
import "./wy-file-item";
import "./wy-cloud-files";
import "./wy-context-data";
import "./wy-empty";

declare global {
  interface HTMLElementTagNameMap {
    "wy-files-header": WyFilesHeader;
  }
}

/**
 * Header toolbar for the files view — actions for uploading, sorting, view options and notifications.
 *
 * **Used sub components:**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-file-item>`](./wy-file-item.ts)
 * - [`<wy-cloud-files>`](./wy-cloud-files.ts)
 * - [`<wy-context-data-progress>`](./wy-context-data.ts)
 *
 * @slot actions - Buttons placed in the toolbar.
 *
 * @csspart wy-files-header - Root header container
 * @csspart wy-header - Header area
 * @csspart wy-header-outer - Outer styling for header area.
 * @csspart wy-files-header-toolbar - Toolbar in the header
 * @csspart wy-toolbar - Toolbar container for header actions
 * @csspart wy-toolbar-buttons - Group for toolbar buttons
 * @csspart wy-toolbar-buttons-last - Right aligned toolbar button group
 *
 * @fires {UploadFilesEventType} upload-files - Emitted when files are selected for upload.
 * @fires {ExternalBlobsEventType} external-blobs - Emitted when external cloud blobs are selected.
 * @fires {CreateFilesEventType} create-files - Emitted to create files programmatically.
 * @fires {OrderEventType<FileOrderType>} order - Emitted when the user changes sort order.
 * @fires {ViewEventType<FileViewType>} view - Emitted when the user changes the view mode (list/grid).
 * @fires {ShowTrashedEventType} show-trashed - Emitted when the show/hide trashed toggle is changed.
 * @fires {SubscribeEventType} subscribe - Emitted when the app subscribe/unsubscribe action is triggered.
 */
@customElement("wy-files-header")
@localized()
export class WyFilesHeader extends WeavySubAppComponent {
  static override styles = [headerCss, toolbarCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Active sort order for the list.
   */
  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * Active layout for rendering files.
   */
  @property()
  view: "grid" | "list" = "list";

  /**
   * Show trashed files when enabled.
   */
  @property({ type: Boolean })
  showTrashed: boolean = false;

  /**
   * Toggle for displaying the upload sheet.
   * @internal
   */
  @state()
  showUploadSheet = false;

  /**
   * Tracks active file mutations for uploads.
   * @internal
   */
  protected mutatingFiles = new MutationStateController<BlobType | FileType, Error, unknown, FileMutationContextType>(
    this
  );

  /**
   * Cached failed mutations to detect new errors.
   * @internal
   */
  protected previousFailedFileMutations: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>[] =
    [];

  /**
   * Reference to the hidden file input.
   * @internal
   */
  protected fileInputRef: Ref<HTMLInputElement> = createRef();

  /**
   * Reference to the cloud files picker element.
   * @internal
   */
  protected cloudFilesRef: Ref<WyCloudFiles> = createRef();

  /**
   * Open the native file picker.
   *
   * @internal
   */
  protected openFileInput = () => {
    this.fileInputRef.value?.click();
  };

  /**
   * Open the cloud files picker.
   *
   * @internal
   */
  protected openCloudFiles = () => {
    this.cloudFilesRef.value?.open();
  };

  // remove file attachment
  /**
   * Remove (or abort) an ongoing upload mutation.
   *
   * @internal
   * @param mutationState - Mutation state to remove.
   */
  protected async handleRemoveMutation(
    mutationState: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>
  ) {
    const weavy = await this.whenWeavy();
    const app = await this.whenApp();

    if (mutationState.status === "pending" && hasAbort(mutationState.variables)) {
      // Abort any ongoing upload
      mutationState.variables.abort?.();
    }

    // NOTE: failed uploads are persisted under a different mutation key
    const removeKey =
      (mutationState.status === "error" && !(mutationState.variables as CreateFileProps)?.blob) ||
      mutationState.status === "pending"
        ? ["apps", app.id, "blobs"]
        : ["apps", app.id, "files"];

    removeMutation(
      weavy.queryClient,
      removeKey,
      (mutation) => mutation.state.submittedAt === mutationState.submittedAt
    );
  }

  /**
   * Retry an upload by replacing the existing file.
   *
   * @internal
   * @param mutation - Failed mutation carrying the blob data.
   */
  protected handleOverwriteUpload(mutation: MutationState<BlobType, Error, CreateFileProps, FileMutationContextType>) {
    const fileBlob = mutation.variables?.blob;
    if (fileBlob) {
      this.dispatchCreateFiles([fileBlob], true);
    }
  }

  /**
   * Dispatch an `upload-files` event with the selected files.
   *
   * @param files - Files chosen from the native picker.
   * @returns Whether the event was not canceled.
   */
  protected dispatchUploadFiles(files: FileList | null) {
    if (this.weavy && this.app) {
      // clear errored mutations before uploading more files
      removeErroredFileMutations(this.weavy, this.app);

      // Check the just updated file status
      const fileStatus = getFileMutationsTotalStatus(this.mutatingFiles.result);

      // If everything seems ok, start a fresh upload session
      if (fileStatus === "ok") {
        removeSettledFileMutations(this.weavy, this.app);
      }
    }

    const uploadEvent: UploadFilesEventType = new (CustomEvent as NamedEvent)("upload-files", {
      detail: { files },
    });
    return this.dispatchEvent(uploadEvent);
  }

  /**
   * Emit an `external-blobs` event with selected cloud blobs.
   *
   * @internal
   * @param externalBlobs - Blobs returned from the cloud picker.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    const externalBlobsEvent: ExternalBlobsEventType = new (CustomEvent as NamedEvent)("external-blobs", {
      detail: { externalBlobs },
    });
    return this.dispatchEvent(externalBlobsEvent);
  }

  /**
   * Emit a `create-files` event for programmatic uploads.
   *
   * @internal
   * @param blobs - Blobs to create files from.
   * @param replace - When true, replace the existing file.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchCreateFiles(blobs: BlobType[] | null, replace: boolean = false) {
    const createEvent: CreateFilesEventType = new (CustomEvent as NamedEvent)("create-files", {
      detail: { blobs, replace },
    });
    return this.dispatchEvent(createEvent);
  }

  /**
   * Emit an `order` event reflecting the chosen sort order.
   *
   * @internal
   * @param order - Order to apply.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchOrder(order: FileOrderType) {
    const orderEvent: OrderEventType<FileOrderType> = new (CustomEvent as NamedEvent)("order", { detail: { order } });
    return this.dispatchEvent(orderEvent);
  }

  /**
   * Emit a `view` event for changing layout mode.
   *
   * @internal
   * @param view - Layout to activate.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchView(view: typeof this.view) {
    const viewEvent: ViewEventType<FileViewType> = new (CustomEvent as NamedEvent)("view", { detail: { view } });
    return this.dispatchEvent(viewEvent);
  }

  /**
   * Emit a `show-trashed` event to toggle trashed visibility.
   *
   * @internal
   * @param showTrashed - Whether to show trashed files.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchShowTrashed(showTrashed: boolean) {
    const showTrashedEvent: ShowTrashedEventType = new (CustomEvent as NamedEvent)("show-trashed", {
      detail: { showTrashed },
    });
    return this.dispatchEvent(showTrashedEvent);
  }

  /**
   * Emit a `subscribe` event to toggle app subscription.
   *
   * @internal
   * @param subscribe - Desired subscription state.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchSubscribe(subscribe: boolean) {
    const subscribeEvent: SubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", { detail: { subscribe } });
    return this.dispatchEvent(subscribeEvent);
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (changedProperties.has("app") && this.app && this.app.id !== changedProperties.get("app")?.id) {
      // clear mutations for the app when app id changes
      if (this.weavy) {
        removeSettledFileMutations(this.weavy, this.app);
      }
    }

    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy && this.app) {
      await this.mutatingFiles.trackMutationState(
        {
          filters: {
            mutationKey: ["apps", this.app.id],
            exact: false,
          },
        },
        this.weavy.queryClient
      );
    }
  }

  private renderFileMutation(mutation: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>) {
    if (mutation.context?.file) {
      const file = mutation.context.file;
      const fileStatus: FileStatusType = {
        ...mutation.context.status,
      };

      if (mutation.context.status.state === "conflict") {
        fileStatus.text = msg("Replace existing file?");
      }

      return html`
        <wy-file-item
          rounded
          .file=${mutation.context?.file}
          .status=${fileStatus}
          .actionType=${mutation.context.type}
          title="${toUpperCaseFirst(mutation.context.type)}: ${file.name}"
        >
          <span slot="title">${file.name}</span>
          ${mutation.context.status.state === "conflict" && fileStatus.text
            ? html`: <span slot="actions" title=${fileStatus.text}><em>${fileStatus.text}</em></span>`
            : nothing}
          ${fileStatus.state === "conflict" && (mutation.variables as CreateFileProps)?.blob
            ? html`
                <wy-button
                  slot="actions"
                  kind="icon"
                  @click=${() =>
                    this.handleOverwriteUpload(
                      mutation as MutationState<BlobType, Error, CreateFileProps, FileMutationContextType>
                    )}
                  title=${msg("Replace")}
                >
                  <wy-icon name="check"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${fileStatus.state === "pending"
            ? html`
                <wy-progress-circular
                  slot="actions"
                  padded
                  ?indeterminate=${Boolean(!fileStatus.progress)}
                  .max=${100}
                  .value=${fileStatus.progress || 0}
                ></wy-progress-circular>

                ${hasAbort(mutation.variables)
                  ? html`<wy-button slot="actions" kind="icon" @click=${() => this.handleRemoveMutation(mutation)}>
                      <wy-icon name="close"></wy-icon>
                    </wy-button>`
                  : nothing}
              `
            : html`<wy-button slot="actions" kind="icon" @click=${() => this.handleRemoveMutation(mutation)}>
                <wy-icon name="close"></wy-icon>
              </wy-button> `}
        </wy-file-item>
      `;
    }
    return nothing;
  }

  override render() {
    const fileMutationResults = this.mutatingFiles.result;
    const failedFileMutations = getFileMutationsByConflictOrError(fileMutationResults);
    const pendingFileMutations = getPendingFileMutations(fileMutationResults);
    const fileProgress = getFileMutationsTotalProgress(fileMutationResults);
    const fileStatus = getFileMutationsTotalStatus(fileMutationResults);

    return html`
      <header part="wy-files-header wy-header wy-header-outer">
        <nav part="wy-files-header-toolbar wy-toolbar">
          <div part="wy-toolbar-buttons">
            ${hasPermission(PermissionType.Create, this.app?.permissions)
              ? html`
                  <wy-dropdown title=${msg("Add files")}>
                    <wy-icon slot="button-content" name="plus" first></wy-icon>
                    <span slot="button-content">${msg("Add files")}</span>
                    <wy-dropdown-item @click=${this.openFileInput} title=${msg("From device")}>
                      <wy-icon name="attachment"></wy-icon>
                      <span>${msg("From device")}</span>
                    </wy-dropdown-item>
                    <input
                      type="file"
                      data-testid="uploadFile"
                      ${ref(this.fileInputRef)}
                      @click=${(e: Event) => e.stopPropagation()}
                      @change=${(e: Event) => {
                        if (this.dispatchUploadFiles((e.target as HTMLInputElement).files)) {
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                      multiple
                      hidden
                      tabindex="-1"
                    />
                    ${this.componentFeatures?.allowsFeature(Feature.CloudFiles)
                      ? html`
                          <wy-dropdown-item @click=${this.openCloudFiles} title=${msg("From cloud")}>
                            <wy-icon name="cloud"></wy-icon>
                            <span>${msg("From cloud")}</span>
                          </wy-dropdown-item>
                        `
                      : nothing}
                  </wy-dropdown>
                `
              : nothing}
            ${fileMutationResults?.length
              ? html`
                  <wy-button
                    kind="icon"
                    @click=${() => {
                      this.showUploadSheet = !this.showUploadSheet;
                    }}
                    title=${fileStatus === "conflict"
                      ? msg("File conflict")
                      : fileStatus === "error"
                      ? msg("Upload error")
                      : fileStatus === "pending"
                      ? msg("Pending")
                      : msg("All uploads finished")}
                  >
                    ${fileStatus === "conflict"
                      ? html`<wy-icon name="alert" color="yellow"></wy-icon>`
                      : fileStatus === "error"
                      ? html`<wy-icon name="alert-octagon" color="error"></wy-icon>`
                      : fileStatus === "pending"
                      ? html`<wy-progress-circular
                          ?indeterminate=${fileProgress.percent === null}
                          .value=${fileProgress.loaded}
                          .max=${fileProgress.total}
                        ></wy-progress-circular>`
                      : html`<wy-icon name="check"></wy-icon>`}
                  </wy-button>
                `
              : nothing}
          </div>
          <div part="wy-toolbar-buttons wy-toolbar-buttons-last">
            <slot name="actions"></slot>

            <wy-dropdown icon="sort" title="Sort items by" directionX="left">
              <wy-dropdown-option
                ?selected=${this.order.by === "name"}
                @click=${() => this.dispatchOrder({ ...this.order, by: "name" })}
              >
                ${msg("Name")}
              </wy-dropdown-option>
              <wy-dropdown-option
                ?selected=${this.order.by === "updated_at"}
                @click=${() => this.dispatchOrder({ ...this.order, by: "updated_at" })}
              >
                ${msg("Modified")}
              </wy-dropdown-option>
              <wy-dropdown-option
                ?selected=${this.order.by === "size"}
                @click=${() => this.dispatchOrder({ ...this.order, by: "size" })}
              >
                ${msg("Size")}
              </wy-dropdown-option>
              <wy-dropdown-divider></wy-dropdown-divider>
              <wy-dropdown-option
                ?selected=${!this.order.descending}
                @click=${() => this.dispatchOrder({ ...this.order, descending: false })}
              >
                ${msg("Ascending")}
              </wy-dropdown-option>
              <wy-dropdown-option
                ?selected=${this.order.descending}
                @click=${() => this.dispatchOrder({ ...this.order, descending: true })}
              >
                ${msg("Descending")}
              </wy-dropdown-option>
            </wy-dropdown>

            <wy-dropdown
              icon=${this.view === "grid" ? "view-module-outline" : "view-list-outline"}
              title="View options"
              directionX="left"
            >
              <wy-dropdown-option ?selected=${this.view === "list"} @click=${() => this.dispatchView("list")}>
                ${msg("List view")}
              </wy-dropdown-option>
              <wy-dropdown-option ?selected=${this.view === "grid"} @click=${() => this.dispatchView("grid")}>
                ${msg("Grid view")}
              </wy-dropdown-option>
              <wy-dropdown-divider></wy-dropdown-divider>
              <wy-dropdown-option ?selected=${!this.showTrashed} @click=${() => this.dispatchShowTrashed(false)}>
                ${msg("Hide trashed")}
              </wy-dropdown-option>
              <wy-dropdown-option ?selected=${this.showTrashed} @click=${() => this.dispatchShowTrashed(true)}>
                ${msg("Show trashed")}
              </wy-dropdown-option>
            </wy-dropdown>

            <wy-dropdown directionX="left" ?disabled=${!this.app}>
              ${this.app?.is_subscribed
                ? html`<wy-dropdown-item @click=${() => this.dispatchSubscribe(false)}>
                    <wy-icon name="bell-off"></wy-icon>
                    ${msg("Unsubscribe")}
                  </wy-dropdown-item>`
                : html`<wy-dropdown-item @click=${() => this.dispatchSubscribe(true)}>
                    <wy-icon name="bell"></wy-icon>
                    ${msg("Subscribe")}
                  </wy-dropdown-item>`}
              ${this.app?.archive_url
                ? html`<wy-dropdown-item
                    @click=${() =>
                      openUrl(
                        this.app?.archive_url,
                        "_top",
                        `${this.app?.uid ? this.app.uid : `${this.app?.type}-${this.app?.id}`}.zip`,
                        true
                      )}
                  >
                    <wy-icon name="download"></wy-icon>
                    ${msg("Download files")}
                  </wy-dropdown-item>`
                : nothing}
            </wy-dropdown>
          </div>
        </nav>

        <wy-context-data-progress></wy-context-data-progress>
      </header>

      ${this.weavy
        ? html`
            <wy-overlay
              type="sheet"
              .show=${this.showUploadSheet}
              @close=${() => {
                this.showUploadSheet = false;
              }}
            >
              <span slot="title">${msg("File actions")}</span>
              <wy-container scrollY padded>
                ${!failedFileMutations.length && !pendingFileMutations.length
                  ? html`
                      <wy-empty noNetwork><wy-container padded>${msg("No pending uploads")}</wy-container></wy-empty>
                    `
                  : nothing}
                ${failedFileMutations.length
                  ? html`
                      ${repeat(
                        failedFileMutations,
                        (mutation) => "mutation" + mutation.submittedAt,
                        (mutation) => this.renderFileMutation(mutation)
                      )}
                    `
                  : nothing}
                ${pendingFileMutations.length
                  ? html`
                      ${repeat(
                        pendingFileMutations,
                        (mutation) => "mutation" + mutation.submittedAt,
                        (mutation) => this.renderFileMutation(mutation)
                      )}
                    `
                  : nothing}
              </wy-container>
            </wy-overlay>
          `
        : nothing}

      <wy-cloud-files
        ${ref(this.cloudFilesRef)}
        @external-blobs=${(e: ExternalBlobsEventType) => this.dispatchExternalBlobs(e.detail.externalBlobs)}
      ></wy-cloud-files>
    `;
  }

  override updated(changedProperties: PropertyValueMap<this>): void {
    super.updated(changedProperties);

    const failedFileMutations = getFileMutationsByConflictOrError(this.mutatingFiles.result);
    const pendingFileMutations = getPendingFileMutations(this.mutatingFiles.result);

    // Check for new failed uploads
    const hasNewFails = failedFileMutations.some(
      (fileMutation) => !this.previousFailedFileMutations.includes(fileMutation)
    );

    if (hasNewFails) {
      this.showUploadSheet = true;
    } else if (this.showUploadSheet && !failedFileMutations.length && !pendingFileMutations.length) {
      // Close dialog after a delay
      setTimeout(() => {
        if (!failedFileMutations.length && !pendingFileMutations.length) {
          this.showUploadSheet = false;
        }
      }, 1500);
    }

    this.previousFailedFileMutations = failedFileMutations ?? [];
  }
}
