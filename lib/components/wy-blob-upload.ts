import { css, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized } from "@lit/localize";
import { getSimpleUploadBlobMutationOptions } from "../data/blob-upload";
import { MutationController } from "../controllers/mutation-controller";
import { BlobType, MutateFileProps } from "../types/files.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { BlobUploadedEventType } from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

import "./base/wy-button";

/**
 * @fires {BlobUploadedEventType} blob-uploaded
 */
@customElement("wy-blob-upload")
@localized()
export default class WyBlobUpload extends WeavySubComponent {
  @property({ attribute: false })
  label?: string;

  @property({ attribute: false })
  accept?: string;

  protected uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, void>(this);

  private fileInputRef: Ref<HTMLInputElement> = createRef();

  private openFileInput = () => {
    this.fileInputRef.value?.click();
  };

  static override styles = [
    css`
      :host {
        text-align: center;
      }
      slot[name="placeholder"] {
        cursor: pointer;
      }
    `,
  ];

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
    return html` <slot
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
      <slot name="label">
        ${this.label ? html`<wy-button @click=${this.openFileInput}>${this.label}</wy-button>` : nothing}
      </slot>`;
  }
}
