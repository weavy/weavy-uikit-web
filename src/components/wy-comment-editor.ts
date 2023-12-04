import { html, nothing, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";
import { ref } from "lit/directives/ref.js";
import { hasFeature } from "../utils/features";
import { Feature } from "../types/features.types";

import WyEditor from "./wy-editor";

import "./wy-dropdown";
import "./wy-icon";
import "./wy-button";

@customElement("wy-comment-editor")
@localized()
export default class WyCommentEditor extends WyEditor {
  constructor() {
    super();
    this.editorType = "comments";
    this.editorClass = "wy-comment-editor";
  }

  protected override renderTopSlot(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected override renderMiddleSlot() {
    return html`<div class="wy-comment-editor-inputs">
      <!-- Add -->
      ${hasFeature(this.availableFeatures, Feature.Attachments, this.features?.attachments) ||
      hasFeature(this.availableFeatures, Feature.CloudFiles, this.features?.cloudFiles) ||
      hasFeature(this.availableFeatures, Feature.Meetings, this.features?.meetings)
        ? html`<wy-dropdown icon="plus" directionY="up">
            ${hasFeature(this.availableFeatures, Feature.Attachments, this.features?.attachments)
              ? html`<wy-dropdown-item @click=${this.openFileInput}>
                    <wy-icon name="attachment"></wy-icon>
                    <span>${msg("From device")}</span>
                  </wy-dropdown-item>
                  <input
                    type="file"
                    ${ref(this.fileInputRef)}
                    @click=${(e: Event) => e.stopPropagation()}
                    @change=${(e: Event) =>
                      this.handleUploadFiles(
                        Array.from((e.target as HTMLInputElement).files || []),
                        e.target as HTMLInputElement
                      )}
                    multiple
                    hidden
                    tabindex="-1"
                  />`
              : nothing}
            ${hasFeature(this.availableFeatures, Feature.CloudFiles, this.features?.cloudFiles)
              ? html`<wy-dropdown-item @click=${this.openCloudFiles}>
                  <wy-icon name="cloud"></wy-icon>
                  <span>${msg("From cloud")}</span>
                </wy-dropdown-item>`
              : nothing}
            ${hasFeature(this.availableFeatures, Feature.Meetings, this.features?.meetings) &&
            this.weavyContext?.zoomAuthenticationUrl
              ? html`<wy-dropdown-item @click=${this.handleZoomClick}>
                  <wy-icon name="zoom"></wy-icon>
                  <span>${msg("Zoom meeting")}</span>
                </wy-dropdown-item>`
              : nothing}
            ${hasFeature(this.availableFeatures, Feature.Polls, this.features?.polls)
              ? html`<wy-dropdown-item @click=${this.openPolls}>
                  <wy-icon name="poll"></wy-icon>
                  <span>${msg("Poll")}</span>
                </wy-dropdown-item>`
              : nothing}
          </wy-dropdown>`
        : nothing}

      <!-- Input -->
      <div
        class=${classMap({ "wy-comment-editor-text": true, "wy-is-invalid": this.editorError })}
        ${ref(this.editorRef)}
      ></div>

      <!-- Button -->
      <wy-button kind="icon" @click="${this.submit}" title=${this.buttonText}>
        <wy-icon name="send"></wy-icon>
      </wy-button>
    </div>`;
  }

  protected override renderBottomSlot() {
    return this.renderLists();
  }
}
