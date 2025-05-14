import { html, nothing, PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type {
  BlobType,
  FileMutationContextType,
  FileStatusType,
  FileType,
  MutateFileProps,
} from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
import { fileSizeAsString, getExtension, getIcon, getKind, getProvider } from "../utils/files";
import { ifDefined } from "lit/directives/if-defined.js";
import type { NamedEvent } from "../types/generic.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { MutationStateController } from "../controllers/mutation-state-controller";
import type { EmbedType } from "../types/embeds.types";
import { repeat } from "lit/directives/repeat.js";
import { MutationState } from "@tanstack/query-core";
import { toUpperCaseFirst } from "../utils/strings";
import { Feature } from "../types/features.types";
import { getFileMutationsTotalProgress, getFileMutationsTotalStatus } from "../data/file-create";

import allCss from "../scss/all.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./base/wy-icon";
import "./wy-file-item";
import "./base/wy-progress-linear";

/**
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 */
@customElement("wy-context-data-items")
export class WyContextDataItems extends WeavySubComponent {
  static override styles = [allCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  @property()
  itemType: "attachment" | "file" = "file";

  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
    return this.dispatchEvent(event);
  }

  #mutatingContextData = new MutationStateController<
    BlobType | FileType | EmbedType,
    Error,
    MutateFileProps,
    FileMutationContextType
  >(this);

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("contextId") ||
        changedProperties.has("componentFeatures")) &&
      this.weavy &&
      this.contextId &&
      this.componentFeatures?.allowsFeature(Feature.ContextData)
    ) {
      await this.#mutatingContextData.trackMutationState(
        {
          filters: {
            mutationKey: ["apps", this.contextId, "data"],
            exact: true,
          },
        },
        this.weavy.queryClient
      );
    }
  }

  override render() {
    const { result: contextDataMutationResults } = this.#mutatingContextData;

    const contextDataUploadMutations = contextDataMutationResults?.filter((mutation) => mutation.variables?.file) as
      | MutationState<BlobType | FileType, Error, MutateFileProps, FileMutationContextType>[]
      | undefined;

    return this.componentFeatures?.allowsFeature(Feature.ContextData) && contextDataUploadMutations
      ? repeat(
          contextDataUploadMutations,
          (mutation) => "mutation" + mutation.submittedAt,
          (mutation) => {
            if (mutation.context?.file) {
              const file = mutation.context.file;
              const fileStatus: FileStatusType = {
                ...mutation.context.status,
              };
              const fileSize = file.size && file.size > 0 ? fileSizeAsString(file.size) : null;
              const ext = getExtension(file.name);
              const { icon } = getIcon(file.name);
              const kind = getKind(file.name);
              const provider = getProvider(file.provider);

              return this.itemType === "file"
                ? html`
                    <wy-file-item
                      @click=${(e: Event) => {
                        !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(e, file);
                      }}
                      .hasHover=${false}
                      .file=${mutation.context.file}
                      .status=${fileStatus}
                      title="${toUpperCaseFirst(mutation.context.type)}: ${file.name +
                      (fileStatus.text ? `: ${fileStatus.text}` : "")}"
                    >
                      <span slot="title"
                        ><strong></strong> ${file.name}
                        ${fileStatus.text ? html`: <em>${fileStatus.text}</em>` : nothing}</span
                      >
                      <span slot="actions"></span>
                    </wy-file-item>
                  `
                : html`
                    <a
                      @click=${(e: Event) => {
                        !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(e, file);
                      }}
                      class="wy-item wy-list-item"
                      href="${ifDefined(file.download_url)}"
                      title=${file.name}
                    >
                      <wy-icon name=${icon} .overlayName=${provider} size="48" kind=${kind} ext=${ext}></wy-icon>
                      <div class="wy-item-body ">
                        <div class="wy-item-title">${file.name}</div>
                        ${fileSize ? html`<div class="wy-item-text" title="${fileSize}">${fileSize}</div>` : ``}
                      </div>
                    </a>
                  `;
            }

            return nothing;
          }
        )
      : nothing;
  }
}

@customElement("wy-context-data-progress")
export class WyContextDataProgress extends WeavySubComponent {
  static override styles = [allCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
    return this.dispatchEvent(event);
  }

  #mutatingContextData = new MutationStateController<
    BlobType | FileType | EmbedType,
    Error,
    MutateFileProps,
    FileMutationContextType
  >(this);

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("contextId") ||
        changedProperties.has("componentFeatures")) &&
      this.weavy &&
      this.contextId &&
      this.componentFeatures?.allowsFeature(Feature.ContextData)
    ) {
      await this.#mutatingContextData.trackMutationState(
        {
          filters: {
            mutationKey: ["apps", this.contextId, "data"],
            exact: true,
          },
        },
        this.weavy.queryClient
      );
    }
  }

  override render() {
    const { result: contextDataMutationResults, isMutating } = this.#mutatingContextData;

    const contextDataUploadMutations = contextDataMutationResults?.filter((mutation) => mutation.variables?.file) as
      | MutationState<BlobType | FileType, Error, MutateFileProps, FileMutationContextType>[]
      | undefined;

    const fileProgress = getFileMutationsTotalProgress(contextDataUploadMutations);
    const fileStatus = getFileMutationsTotalStatus(contextDataUploadMutations);

    return this.componentFeatures?.allowsFeature(Feature.ContextData) &&
      contextDataMutationResults &&
      contextDataMutationResults.length
      ? html`
          ${isMutating || (fileProgress.percent !== null && fileProgress.percent < 100)
            ? html`
                <wy-progress-linear
                  ?indeterminate=${!fileProgress.percent}
                  overlay
                  reveal
                  ?warning=${fileStatus === "error"}
                  value=${fileProgress.percent ?? 0}
                  max=${100}
                ></wy-progress-linear>
              `
            : nothing}
        `
      : nothing;
  }
}
