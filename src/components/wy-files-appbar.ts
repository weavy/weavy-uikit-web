import { LitElement, html, nothing, type PropertyValues } from "lit";
import { type FeaturesListType, Feature, type FeaturesConfigType } from "../types/features.types";
import { hasFeature } from "../utils/features";
import { type AppType } from "../types/app.types";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { repeat } from "lit/directives/repeat.js";
import { localized, msg } from "@lit/localize";

import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";

import filesCss from "../scss/all.scss";

import "./wy-button";
import "./wy-dropdown";
import "./wy-icon";
import "./wy-spinner";
import "./wy-sheet";

import "./wy-file-item";

import { type UserType } from "../types/users.types";
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
} from "../types/files.types";
import { MutationStateController } from "../controllers/mutation-state-controller";
import { openUrl } from "../utils/urls";
import { portal } from "lit-modal-portal";
import { MutationState } from "@tanstack/query-core";
import { toUpperCaseFirst } from "../utils/strings";

import "./wy-cloud-files";
import type { default as WeavyCloudFiles } from "./wy-cloud-files";
import { removeMutation } from "../utils/mutation-cache";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-files-appbar")
@localized()
export class WyFilesAppbar extends LitElement {
  static override styles = [filesCss];

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ type: Object })
  app?: AppType;

  @property({ type: Object })
  user?: UserType;

  @property({ type: Array })
  availableFeatures?: FeaturesListType = [];

  @property({ type: Object })
  features: FeaturesConfigType = {};

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
  private handleRemoveMutation(
    mutationState: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>
  ) {
    if (!this.weavyContext) {
      return;
    }

    removeMutation(
      this.weavyContext.queryClient,
      ["apps", this.app!.id, "files"],
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

  private dispatchUploadFiles(files: FileList | null, input: HTMLInputElement) {
    const uploadEvent = new CustomEvent("upload-files", { detail: { files, input } });
    return this.dispatchEvent(uploadEvent);
  }

  private dispatchExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    const externalBlobsEvent = new CustomEvent("external-blobs", { detail: { externalBlobs } });
    return this.dispatchEvent(externalBlobsEvent);
  }

  private dispatchCreateFiles(blobs: BlobType[] | null, replace: boolean = false) {
    const createEvent = new CustomEvent("create-files", { detail: { blobs, replace } });
    return this.dispatchEvent(createEvent);
  }

  private dispatchOrder(order: FileOrderType) {
    const orderEvent = new CustomEvent("order", { detail: { order } });
    return this.dispatchEvent(orderEvent);
  }

  private dispatchView(view: typeof this.view) {
    const viewEvent = new CustomEvent("view", { detail: { view } });
    return this.dispatchEvent(viewEvent);
  }

  private dispatchShowTrashed(showTrashed: boolean) {
    const showTrashedEvent = new CustomEvent("show-trashed", { detail: { showTrashed } });
    return this.dispatchEvent(showTrashedEvent);
  }

  private dispatchSubscribe(subscribe: boolean) {
    const subscribeEvent = new CustomEvent("subscribe", { detail: { subscribe } });
    return this.dispatchEvent(subscribeEvent);
  }

  override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if ((changedProperties.has("weavyContext") || changedProperties.has("app")) && this.weavyContext && this.app) {
      this.mutatingFiles.trackMutationState(
        { filters: { mutationKey: ["apps", this.app.id], exact: false } },
        this.weavyContext.queryClient
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

      //console.log('fileStatus', fileStatus)

      return html`
        <wy-file-item
          .availableFeatures=${this.availableFeatures}
          .features=${this.features}
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
          <wy-dropdown title=${msg("Add files")}>
            <span slot="button">${msg("Add files")}</span>
            <wy-icon slot="button" name="plus" last></wy-icon>
            <wy-dropdown-item @click=${this.openFileInput}>
              <wy-icon name="attachment"></wy-icon>
              <span>${msg("From device")}</span>
            </wy-dropdown-item>
            <input
              type="file"
              ${ref(this.fileInputRef)}
              @click=${(e: Event) => e.stopPropagation()}
              @change=${(e: Event) =>
                this.dispatchUploadFiles((e.target as HTMLInputElement).files, e.target as HTMLInputElement)}
              multiple
              hidden
              tabindex="-1"
            />
            ${hasFeature(this.availableFeatures, Feature.CloudFiles, this.features?.cloudFiles)
              ? html`
                  <wy-dropdown-item @click=${this.openCloudFiles}>
                    <wy-icon name="cloud"></wy-icon>
                    <span>${msg("From cloud")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
          </wy-dropdown>
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
                        ?nospin=${fileProgress !== undefined}
                        progress=${ifDefined(fileProgress.percent !== null ? fileProgress.percent : undefined)}
                        title=${msg("Pending")}
                      ></wy-spinner>`
                    : html`<wy-icon name="check" title=${msg("All uploads finished")}></wy-icon>`}
                </wy-button>
              `
            : nothing}

          <wy-dropdown icon="sort" title="Sort items by" directionX="left">
            <wy-dropdown-option
              ?selected=${this.order.by === "name"}
              @click=${() => this.dispatchOrder({ ...this.order, by: "name" })}
            >
              ${msg("Name")}
            </wy-dropdown-option>
            <wy-dropdown-option
              ?selected=${this.order.by === "modified_at"}
              @click=${() => this.dispatchOrder({ ...this.order, by: "modified_at" })}
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
                  @click=${() => openUrl(this.app?.archive_url, "_top", `${this.app?.uid}.zip`, true)}
                >
                  <wy-icon name="download"></wy-icon>
                  ${msg("Download files")}
                </wy-dropdown-item>`
              : nothing}
          </wy-dropdown>
        </div>
      </nav>

      ${portal(
        this.showUploadSheet && Boolean(fileMutationResults?.length),
        html`
          <wy-sheet
            .show=${this.showUploadSheet}
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
        `,
        () => (this.showUploadSheet = false)
      )}

      <wy-cloud-files
        ${ref(this.cloudFilesRef)}
        @external-blobs=${(e: CustomEvent) => this.dispatchExternalBlobs(e.detail.externalBlobs)}
      ></wy-cloud-files>
    `;
  }
}
