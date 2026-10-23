import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { state } from "lit/decorators.js";
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
  FileStatusType,
  FileType,
  CreateFileProps,
  ExternalBlobType,
} from "../types/files.types";
import { MutationStateController } from "../controllers/mutation-state-controller";
import { MutationState } from "@tanstack/query-core";
import { toUpperCaseFirst } from "../utils/strings";
import type { WyCloudFiles } from "./wy-cloud-files";
import { removeMutation } from "../utils/mutation-cache";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { hasAnyPermission } from "../utils/permission";
import { Feature } from "../types/features.types";
import { isFileEditable } from "../utils/files";
import type { ExternalBlobsEventType } from "../types/files.events";
import { hasAbort } from "../controllers/mutation-controller";
import { CreateFilesController } from "../controllers/create-files-controller";
import type { WyFilenameInput } from "./wy-filename-input";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-progress-circular";
import "./ui/wy-overlay";
import "./ui/wy-container";
import "./wy-file-item";
import "./wy-cloud-files";
import "./wy-empty";
import "./wy-filename-input";
import { ActionType } from "../types/action.types";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-create": WyFileCreate;
  }
}

/**
 * Button menu for creating or uploading files.
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
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-filename-input>`](./wy-filename-input.ts)
 *
 * @slot actions - Buttons placed in the toolbar.
 *
 * @csspart wy-files-create-buttons - Button group
 *
 * @fires {WyActionEventType} wy-action - Emitted when a file is created. Editable files use the `edit` action and should be opened in edit mode, other files use `select`.
 */
@customElement("wy-file-create")
@localized()
export class WyFileCreate extends WeavySubAppComponent {
  static override styles = [hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Toggle for displaying the upload sheet.
   * @internal
   */
  @state()
  showUploadSheet = false;

  private filenameInputRef = createRef<WyFilenameInput>();

  /**
   * Name currently being created from the filename prompt. A conflict for this name is reported inline in the prompt
   * instead of opening the upload sheet, and is removed from the mutation cache by the controller.
   */
  private promptedFilename?: string;

  protected whenFileUploadInput?: Promise<(FileType | undefined)[] | undefined>;
  protected resolveFileUploadInput?: (
    value: (FileType | undefined)[] | undefined | PromiseLike<(FileType | undefined)[] | undefined>,
  ) => void;

  protected whenCloudFileInput?: Promise<(FileType | undefined)[] | undefined>;
  protected resolveCloudFileInput?: (
    value: (FileType | undefined)[] | undefined | PromiseLike<(FileType | undefined)[] | undefined>,
  ) => void;

  /**
   * Handles file uploads, blobs and file creation.
   * @internal
   */
  protected createFilesController = new CreateFilesController(this);

  /**
   * Tracks active file mutations for uploads.
   * @internal
   */
  protected mutatingFiles = new MutationStateController<BlobType | FileType, Error, unknown, FileMutationContextType>(
    this,
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
   */
  async getFileInput() {
    this.whenFileUploadInput = new Promise((r) => (this.resolveFileUploadInput = r));
    this.fileInputRef.value?.click();
    return await this.whenFileUploadInput;
  }

  /**
   * Open the cloud files picker.
   *
   */
  async getCloudFiles() {
    this.whenCloudFileInput = new Promise((r) => (this.resolveCloudFileInput = r));
    this.cloudFilesRef.value?.open();
    return await this.whenCloudFileInput;
  }

  // remove file attachment
  /**
   * Remove (or abort) an ongoing upload mutation.
   *
   * @internal
   * @param mutationState - Mutation state to remove.
   */
  protected async handleRemoveMutation(
    mutationState: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>,
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
      (mutation) => mutation.state.submittedAt === mutationState.submittedAt,
    );
  }

  /**
   * Retry an upload by replacing the existing file.
   *
   * @internal
   * @param mutation - Failed mutation carrying the blob data.
   */
  protected async handleOverwriteUpload(
    mutation: MutationState<BlobType, Error, CreateFileProps, FileMutationContextType>,
  ) {
    const fileBlob = mutation.variables?.blob;
    if (fileBlob) {
      await this.createFilesController.createFileFromBlob(fileBlob, true);
    }
  }

  /**
   * Handle uploading of files.
   *
   * @param files - Files chosen from the native picker.
   */
  protected async handleUploadFiles(files: File[] | FileList | null) {
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

    if (files) {
      return await this.createFilesController.uploadFiles(files);
    } else {
      return [];
    }
  }

  /**
   * Handle adding blobs from the cloud picker.
   *
   * @param blobs - Blobs chosen from the cloud picker.
   */
  protected async handleExternalBlobs(blobs: ExternalBlobType[] | null) {
    if (blobs) {
      return await this.createFilesController.addExternalBlobs(blobs);
    } else {
      return [];
    }
  }

  /**
   * Prompt for a filename and create a file. The prompt stays open with an inline error when the name is already
   * taken in the app, so the user can choose a different name.
   * Emits `wy-action` with `edit` for editable text and code files, otherwise `select`.
   * @param ext - Suggested initial extension; the submitted filename is used unchanged.
   * @returns The created file, or undefined if the prompt is cancelled.
   */
  async createFile(ext?: string) {
    await this.updateComplete;
    let createdFile: FileType | undefined;
    await this.filenameInputRef.value?.open(ext, async (filename) => {
      this.promptedFilename = filename;
      try {
        // Only files with an editor are opened in edit mode, other files are selected instead.
        createdFile = await this.createFilesController.createEmptyFile(filename, (createdFile) =>
          isFileEditable(createdFile, this.app, this.componentFeatures) ? ActionType.Edit : ActionType.Select,
        );
      } finally {
        this.promptedFilename = undefined;
      }
      return createdFile ? undefined : msg("A file with this name already exists. Choose a different name.");
    });
    return createdFile;
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
        this.weavy.queryClient,
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
                      mutation as MutationState<BlobType, Error, CreateFileProps, FileMutationContextType>,
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
      <wy-buttons>
        ${hasAnyPermission([PermissionType.Create, PermissionType.Admin], this.app?.permissions) &&
        this.componentFeatures?.allowsAnyFeature(Feature.FileCreate, Feature.FileUpload, Feature.CloudFiles)
          ? html`
              <wy-dropdown title=${msg("Add files")}>
                <wy-icon slot="button-content" name="plus" first></wy-icon>
                <span slot="button-content">${msg("Add files")}</span>

                <slot name="actions"></slot>

                ${this.componentFeatures?.allowsFeature(Feature.FileCreate)
                  ? html`
                      <wy-dropdown-item
                        @click=${() => {
                          void this.createFile("md");
                        }}
                      >
                        <wy-icon name="file"></wy-icon>
                        <span>${msg("New file")}</span>
                      </wy-dropdown-item>
                    `
                  : nothing}
                ${this.componentFeatures?.allowsFeature(Feature.FileUpload)
                  ? html`
                      <wy-dropdown-item
                        @click=${() => {
                          void this.getFileInput();
                        }}
                        title=${msg("From device")}
                      >
                        <wy-icon name="attachment"></wy-icon>
                        <span>${msg("From device")}</span>
                      </wy-dropdown-item>
                      <input
                        type="file"
                        data-testid="uploadFile"
                        ${ref(this.fileInputRef)}
                        @click=${(e: Event) => e.stopPropagation()}
                        @change=${(e: Event) => {
                          void this.handleUploadFiles((e.target as HTMLInputElement).files).then((files) => {
                            this.resolveFileUploadInput?.(files);
                          });
                          (e.target as HTMLInputElement).value = "";
                        }}
                        multiple
                        hidden
                        tabindex="-1"
                      />
                    `
                  : nothing}
                ${this.componentFeatures?.allowsFeature(Feature.CloudFiles)
                  ? html`
                      <wy-dropdown-item
                        @click=${() => {
                          void this.getCloudFiles();
                        }}
                        title=${msg("From cloud")}
                      >
                        <wy-icon name="cloud"></wy-icon>
                        <span>${msg("From cloud")}</span>
                      </wy-dropdown-item>
                    `
                  : nothing}
              </wy-dropdown>
            `
          : nothing}
        ${failedFileMutations.length || pendingFileMutations.length
          ? html`
              <wy-button
                kind="icon"
                @click=${() => {
                  this.showUploadSheet = !this.showUploadSheet;
                }}
                ?active=${this.showUploadSheet}
                title=${fileStatus === "conflict"
                  ? msg("File conflict")
                  : fileStatus === "error"
                    ? msg("Upload error")
                    : msg("Pending")}
              >
                ${fileStatus === "conflict"
                  ? html`<wy-icon name="alert" color="yellow"></wy-icon>`
                  : fileStatus === "error"
                    ? html`<wy-icon name="alert-octagon" color="error"></wy-icon>`
                    : html`<wy-progress-circular
                        ?indeterminate=${fileProgress.percent === null}
                        .value=${fileProgress.loaded}
                        .max=${fileProgress.total}
                      ></wy-progress-circular>`}
              </wy-button>
            `
          : nothing}
        <slot name="actions"></slot>
      </wy-buttons>

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
                        (mutation) => this.renderFileMutation(mutation),
                      )}
                    `
                  : nothing}
                ${pendingFileMutations.length
                  ? html`
                      ${repeat(
                        pendingFileMutations,
                        (mutation) => "mutation" + mutation.submittedAt,
                        (mutation) => this.renderFileMutation(mutation),
                      )}
                    `
                  : nothing}
              </wy-container>
            </wy-overlay>
          `
        : nothing}
      <wy-filename-input ${ref(this.filenameInputRef)}></wy-filename-input>

      <wy-cloud-files
        ${ref(this.cloudFilesRef)}
        @external-blobs=${(e: ExternalBlobsEventType) => {
          void this.handleExternalBlobs(e.detail.externalBlobs).then((files) => {
            this.resolveCloudFileInput?.(files);
          });
        }}
      ></wy-cloud-files>
    `;
  }

  override updated(changedProperties: PropertyValueMap<this>): void {
    super.updated(changedProperties);

    const failedFileMutations = getFileMutationsByConflictOrError(this.mutatingFiles.result);
    const pendingFileMutations = getPendingFileMutations(this.mutatingFiles.result);

    // Check for new failed uploads. A name conflict from the open filename prompt is shown in the prompt instead,
    // so it must not open the sheet; the controller removes that mutation again right after the failure.
    const hasNewFails = failedFileMutations.some(
      (fileMutation) =>
        !this.previousFailedFileMutations.includes(fileMutation) &&
        (fileMutation.variables as CreateFileProps | undefined)?.blob?.name !== this.promptedFilename,
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
