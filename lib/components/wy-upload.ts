import { css, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { getSimpleUploadBlobMutationOptions } from "../data/blob-upload";
import { MutationController } from "../controllers/mutation-controller";
import { BlobType, MutateFileProps } from "../types/files.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { BlobUploadedEventType } from "../types/files.events";
import { NamedEvent } from "../types/generic.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./ui/wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-upload": WyUpload;
  }
}

/**
 * Component for handling native file input and upload as a blob.
 * 
 * **Used sub components:**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @fires {BlobUploadedEventType} blob-uploaded
 *
 * @slot placeholder - Placeholder content.
 * @slot action - Slot for replacing the default button.
 * @csspart wy-upload - The upload component.
 * @csspart wy-upload-placeholder - Slot for placeholder content.
 * @csspart wy-upload-action - Slot for the button of the input.
 * @csspart wy-upload-button - The default upload button with label.
 */
@customElement("wy-upload")
export class WyUpload extends WeavySubComponent {
    static override styles = [
    css`
      :host {
        display: contents;
      }

      [part~="wy-upload"] {
        text-align: center;
      }

      [part~="wy-upload-placeholder"] {
        cursor: pointer;
      }
    `,
  ];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /* Label for the default button */
  @property({ attribute: false })
  label?: string;

  /** File types to allow in the native file picker. */
  @property({ attribute: false })
  accept?: string;

  /**
   * Mutation controller handling blob uploads.
   *
   * @internal
   */
  protected uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, void>(this);

  /**
   * Reference to the hidden file input element.
   *
   * @internal
   */
  private fileInputRef: Ref<HTMLInputElement> = createRef();

  /**
   * Opens the hidden file input dialog.
   *
   * @internal
   */
  private openFileInput = () => {
    this.fileInputRef.value?.click();
  };

  /**
   * Uploads the first selected file and resets the input.
   *
   * @internal
   */
  private async handleBlobChange(files: FileList | null, input: HTMLInputElement) {
    if (files && this.weavy) {
      const file = files[0];
      const fileProps = { file: file };

      await this.uploadBlobMutation.trackMutation(getSimpleUploadBlobMutationOptions(this.weavy));

      const blob = await this.uploadBlobMutation.mutate(fileProps);

      if (input) {
        input.value = "";
      }

      const event: BlobUploadedEventType = new (CustomEvent as NamedEvent)("blob-uploaded", { detail: { blob: blob } });
      this.dispatchEvent(event);
    }
  }

  override render() {
    return html`
      <div part="wy-upload">
        <slot
          part="wy-upload-placeholder"
          name="placeholder"
          @click=${this.openFileInput}
          @keydown=${clickOnEnterAndConsumeOnSpace}
          @keyup=${clickOnSpace}
        ></slot>
        <input
          accept=${ifDefined(this.accept)}
          type="file"
          ${ref(this.fileInputRef)}
          @click=${(e: Event) => e.stopPropagation()}
          @change=${(e: Event) =>
            this.handleBlobChange((e.target as HTMLInputElement).files, e.target as HTMLInputElement)}
          hidden
        />
        <slot part="wy-upload-action" name="action">
          ${this.label
            ? html`<wy-button part="wy-upload-button" @click=${this.openFileInput}>${this.label}</wy-button>`
            : nothing}
        </slot>
      </div>
    `;
  }
}
