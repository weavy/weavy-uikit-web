import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { PermissionType } from "../types/app.types";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { repeat } from "lit/directives/repeat.js";
import { localized, msg } from "@lit/localize";
import {
  getFileMutationsByConflictOrError,
  getFileMutationsTotalProgress,
  getFileMutationsTotalStatus,
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
import type { default as WeavyCloudFiles } from "./wy-cloud-files";
import { removeMutation } from "../utils/mutation-cache";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { hasPermission } from "../utils/permission";
import { Feature } from "../types/features.types";
import type { CreateFilesEventType, ExternalBlobsEventType, UploadFilesEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";
import type { OrderEventType, ShowTrashedEventType, ViewEventType } from "../types/lists.events";
import type { SubscribeEventType } from "../types/app.events";

import filesCss from "../scss/all.scss";

import "./base/wy-button";
import "./base/wy-dropdown";
import "./base/wy-icon";
import "./base/wy-spinner";
import "./base/wy-sheet";
import "./wy-file-item";
import "./wy-cloud-files";
import "./wy-notification-button-list";
import "./wy-context-data";

/**
 * @fires {UploadFilesEventType} upload-files
 * @fires {ExternalBlobsEventType} external-blobs
 * @fires {CreateFilesEventType} create-files
 * @fires {OrderEventType} order
 * @fires {ViewEventType} view
 * @fires {ShowTrashedEventType} show-trashed
 * @fires {SubscribeEventType} subscribe
 */
@customElement("wy-files-appbar")
@localized()
export class WyFilesAppbar extends WeavySubComponent {
  static override styles = [filesCss];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  @property()
  view: "grid" | "list" = "list";

  @property({ type: Boolean })
  showTrashed: boolean = false;

  @state()
  showUploadSheet = false;

  private mutatingFiles = new MutationStateController<BlobType | FileType, Error, unknown, FileMutationContextType>(
    this
  );

  private fileInputRef: Ref<HTMLInputElement> = createRef();
  private cloudFilesRef: Ref<WeavyCloudFiles> = createRef();

  private openFileInput = () => {
    this.fileInputRef.value?.click();
  };

  private openCloudFiles = () => {
    this.cloudFilesRef.value?.open();
  };

  // remove file attachment
  private async handleRemoveMutation(
    mutationState: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>
  ) {
    const weavy = await this.whenWeavy();
    const app = await this.whenApp();

    // NOTE: failed uploads are persisted under a different mutation key
    const removeKey =
      mutationState.status === "error" && !(mutationState.variables as CreateFileProps)?.blob
        ? ["apps", app.id, "blobs", undefined]
        : ["apps", app.id, "files"];

    removeMutation(
      weavy.queryClient,
      removeKey,
      (mutation) => mutation.state.submittedAt === mutationState.submittedAt
    );
  }

  private handleOverwriteUpload(mutation: MutationState<BlobType, Error, CreateFileProps, FileMutationContextType>) {
    /*removeMutatingFileUpload(mutation);*/

    const fileBlob = mutation.variables?.blob;
    if (fileBlob) {
      this.dispatchCreateFiles([fileBlob], true);
    }
  }

  private dispatchUploadFiles(files: FileList | null) {
    const uploadEvent: UploadFilesEventType = new (CustomEvent as NamedEvent)("upload-files", {
      detail: { files },
    });
    return this.dispatchEvent(uploadEvent);
  }

  private dispatchExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    const externalBlobsEvent: ExternalBlobsEventType = new (CustomEvent as NamedEvent)("external-blobs", {
      detail: { externalBlobs },
    });
    return this.dispatchEvent(externalBlobsEvent);
  }

  private dispatchCreateFiles(blobs: BlobType[] | null, replace: boolean = false) {
    const createEvent: CreateFilesEventType = new (CustomEvent as NamedEvent)("create-files", {
      detail: { blobs, replace },
    });
    return this.dispatchEvent(createEvent);
  }

  private dispatchOrder(order: FileOrderType) {
    const orderEvent: OrderEventType<FileOrderType> = new (CustomEvent as NamedEvent)("order", { detail: { order } });
    return this.dispatchEvent(orderEvent);
  }

  private dispatchView(view: typeof this.view) {
    const viewEvent: ViewEventType<FileViewType> = new (CustomEvent as NamedEvent)("view", { detail: { view } });
    return this.dispatchEvent(viewEvent);
  }

  private dispatchShowTrashed(showTrashed: boolean) {
    const showTrashedEvent: ShowTrashedEventType = new (CustomEvent as NamedEvent)("show-trashed", {
      detail: { showTrashed },
    });
    return this.dispatchEvent(showTrashedEvent);
  }

  private dispatchSubscribe(subscribe: boolean) {
    const subscribeEvent: SubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", { detail: { subscribe } });
    return this.dispatchEvent(subscribeEvent);
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy && this.app) {
      await this.mutatingFiles.trackMutationState(
        { filters: { mutationKey: ["apps", this.app.id], exact: false } },
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
          .file=${mutation.context?.file}
          .status=${fileStatus}
          .actionType=${mutation.context.type}
          title="${toUpperCaseFirst(mutation.context.type)}: ${file.name}"
        >
          <span slot="title">${file.name}</span>
          ${fileStatus.text
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
          <wy-button
            slot="actions"
            kind="icon"
            @click=${() => this.handleRemoveMutation(mutation)}
            title=${msg("Discard", { desc: "Button action to discard" })}
          >
            <wy-icon name="close"></wy-icon>
          </wy-button>
        </wy-file-item>
      `;
    }
    return nothing;
  }

  override render() {
    const fileMutationResults = this.mutatingFiles.result;
    const failedFileMutations = getFileMutationsByConflictOrError(fileMutationResults);
    const fileMutations = fileMutationResults?.length
      ? fileMutationResults.filter((mutation) => mutation.context?.file && !failedFileMutations.includes(mutation))
      : [];
    const fileProgress = getFileMutationsTotalProgress(fileMutationResults);
    const fileStatus = getFileMutationsTotalStatus(fileMutationResults);

    return html`
      <nav class="wy-toolbar">
        <div class="wy-toolbar-buttons">
          ${hasPermission(PermissionType.Create, this.app?.permissions)
            ? html`
                <wy-dropdown title=${msg("Add files")}>
                  <span slot="button">${msg("Add files")}</span>
                  <wy-icon slot="button" name="plus" last></wy-icon>
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
        </div>
        <div class="wy-toolbar-buttons wy-toolbar-buttons-last">
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
                    ? html`<wy-icon name="alert" color="yellow" title=${msg("File conflict")}></wy-icon>`
                    : fileStatus === "error"
                    ? html`<wy-icon name="alert-octagon" color="error" title=${msg("Upload error")}></wy-icon>`
                    : fileStatus === "pending"
                    ? html`<wy-spinner
                        ?nospin=${fileProgress !== undefined && fileProgress.percent !== null}
                        progress=${ifDefined(fileProgress.percent !== null ? fileProgress.percent : undefined)}
                        title=${msg("Pending")}
                      ></wy-spinner>`
                    : html`<wy-icon name="check" title=${msg("All uploads finished")}></wy-icon>`}
                </wy-button>
              `
            : nothing}
          ${this.app ? html` <wy-notification-button-list></wy-notification-button-list> ` : nothing}

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
                  @click=${() => openUrl(this.app?.archive_url, "_top", `${ this.app?.uid ? this.app.uid : `${this.app?.type}-${this.app?.id}` }.zip`, true)}
                >
                  <wy-icon name="download"></wy-icon>
                  ${msg("Download files")}
                </wy-dropdown-item>`
              : nothing}
          </wy-dropdown>
        </div>
      </nav>

      <wy-context-data-progress></wy-context-data-progress>

      ${this.weavy
        ? html`
            <wy-sheet
              .show=${this.showUploadSheet}
              @close=${() => (this.showUploadSheet = false)}
              @release-focus=${() =>
                this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
            >
              <wy-button
                kind="icon"
                slot="appbar-buttons"
                @click=${() => {
                  fileMutationResults?.forEach((mutation) => this.handleRemoveMutation(mutation));
                }}
                title=${msg("Remove all", { desc: "Button action to remove all" })}
              >
                <wy-icon name="trashcan"></wy-icon>
              </wy-button>
              <span slot="appbar-text">${msg("File actions")}</span>
              ${failedFileMutations.length
                ? html`
                    ${repeat(
                      failedFileMutations,
                      (mutation) => "mutation" + mutation.submittedAt,
                      (mutation) => this.renderFileMutation(mutation)
                    )}
                    ${fileMutations.length ? html`<hr />` : nothing}
                  `
                : nothing}
              ${fileMutations.length
                ? html`
                    ${repeat(
                      fileMutations,
                      (mutation) => "mutation" + mutation.submittedAt,
                      (mutation) => this.renderFileMutation(mutation)
                    )}
                  `
                : nothing}
            </wy-sheet>
          `
        : nothing}

      <wy-cloud-files
        ${ref(this.cloudFilesRef)}
        @external-blobs=${(e: ExternalBlobsEventType) => this.dispatchExternalBlobs(e.detail.externalBlobs)}
      ></wy-cloud-files>
    `;
  }
}
