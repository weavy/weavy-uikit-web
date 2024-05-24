import { html, nothing, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";
import { ref } from "lit/directives/ref.js";

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
      ${this.hasFeatures?.attachments || this.hasFeatures?.cloudFiles || this.hasFeatures?.meetings
        ? html`<wy-dropdown icon="plus" directionY="up">
            ${this.hasFeatures?.attachments
              ? html`<wy-dropdown-item @click=${this.openFileInput} title=${msg("From device")}>
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
            ${this.hasFeatures?.cloudFiles
              ? html`<wy-dropdown-item @click=${this.openCloudFiles} title=${msg("From cloud")}>
                  <wy-icon name="cloud"></wy-icon>
                  <span>${msg("From cloud")}</span>
                </wy-dropdown-item>`
              : nothing}
            ${this.hasFeatures?.confluence && this.weavyContext?.confluenceAuthenticationUrl
              ? html`<wy-confluence
                  dropdown
                  @external-blobs=${(e: CustomEvent) => this.handleExternalBlobs(e.detail.externalBlobs)}
                ></wy-confluence>`
              : nothing}
            ${this.hasFeatures?.meetings && this.configuration?.zoom_authentication_url
              ? html`<wy-dropdown-item @click=${this.handleZoomClick} title=${msg("Zoom meeting")}>
                  <wy-icon name="zoom"></wy-icon>
                  <span>${msg("Zoom meeting")}</span>
                </wy-dropdown-item>`
              : nothing}
            ${this.hasFeatures?.polls
              ? html`<wy-dropdown-item @click=${this.openPolls} title=${msg("Poll")}>
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
