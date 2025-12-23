import { html, nothing, PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import type {
  BlobType,
  FileMutationContextType,
  FileType,
  MutateFileProps,
} from "../types/files.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { MutationStateController } from "../controllers/mutation-state-controller";
import type { EmbedType } from "../types/embeds.types";
import { MutationState } from "@tanstack/query-core";
import { Feature } from "../types/features.types";
import { getFileMutationsTotalProgress, getFileMutationsTotalStatus } from "../data/file-create";

import hostContentsCss from "../scss/host-contents.scss";
import "./ui/wy-progress-linear";

declare global {
  interface HTMLElementTagNameMap {
    "wy-context-data-progress": WyContextDataProgress;
  }
}

/**
 * Linear progress display for context data upload. Checks for any context data uploads in the current Weavy component.
 * 
 * **Used sub components**
 *
 * - [`<wy-progress-linear>`](./ui/wy-progress-linear.ts)
 */
@customElement("wy-context-data-progress")
export class WyContextDataProgress extends WeavySubAppComponent {
  static override styles = [hostContentsCss];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Tracks ongoing context-data mutations (file/blob/embed uploads).
   *
   * @internal
   */
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
                  ?indeterminate=${fileProgress.percent === null}
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
