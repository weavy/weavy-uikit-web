import { html, nothing, TemplateResult } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { localized, msg } from "@lit/localize";
import { ref } from "lit/directives/ref.js";

import WyEditor from "./wy-editor";
import "./wy-dropdown";
import "./wy-icon";
import "./wy-button";

@customElement("wy-message-editor")
@localized()
export default class WyMessageEditor extends WyEditor {
  constructor() {
    super();
    this.editorType = "messages";
    this.editorClass = "wy-message-editor";
  }

  protected override renderTopSlot(): TemplateResult | typeof nothing {
    return this.renderLists();
  }

  protected override renderMiddleSlot() {
    return html` <div class="wy-message-editor-inputs">
      <!-- Add -->
      ${this.hasFeatures?.attachments ||
      this.hasFeatures?.cloudFiles ||
      this.hasFeatures?.polls ||
      this.hasFeatures?.zoomMeetings ||
      this.hasFeatures?.googleMeet ||
      this.hasFeatures?.microsoftTeams
        ? html`<wy-dropdown icon="plus" directionY="up" ?disabled=${this.disabled}>
            ${this.hasFeatures?.attachments
              ? html`
                  <wy-dropdown-item @click=${this.openFileInput} title=${msg("From device")}>
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
                  />
                `
              : nothing}
            ${this.hasFeatures?.cloudFiles
              ? html`
                  <wy-dropdown-item @click=${this.openCloudFiles} title=${msg("From cloud")}>
                    <wy-icon name="cloud"></wy-icon>
                    <span>${msg("From cloud")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.hasFeatures?.polls
              ? html`
                  <wy-dropdown-item @click=${this.openPolls} title=${msg("Poll")}>
                    <wy-icon name="poll"></wy-icon>
                    <span>${msg("Poll")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.hasFeatures?.zoomMeetings
              ? html`
                  <wy-dropdown-item @click=${() => this.handleMeetingClick("zoom")} title=${msg("Zoom meeting")}>
                    <wy-icon svg="zoom-meetings"></wy-icon>
                    <span>${msg("Zoom meeting")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.hasFeatures?.googleMeet
              ? html`
                  <wy-dropdown-item @click=${() => this.handleMeetingClick("google")} title=${msg("Google Meet")}>
                    <wy-icon svg="google-meet"></wy-icon>
                    <span>${msg("Google Meet")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.hasFeatures?.microsoftTeams
              ? html`
                  <wy-dropdown-item
                    @click=${() => this.handleMeetingClick("microsoft")}
                    title=${msg("Microsoft Teams")}
                  >
                    <wy-icon svg="microsoft-teams"></wy-icon>
                    <span>${msg("Microsoft Teams")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
          </wy-dropdown>`
        : nothing}

      <!-- Input -->
      <div class="wy-message-editor-text" ${ref(this.editorRef)}> ${this.renderEditorDummy()} </div>

      <!-- Button -->
      <wy-button
        kind="icon"
        color="primary-text"
        title=${msg("Send", { desc: "Button action to send" })}
        @click="${this.submit}"
        ?disabled=${this.disabled}
      >
        <wy-icon name="send"></wy-icon>
      </wy-button>
    </div>`;
  }

  protected override renderBottomSlot(): TemplateResult | typeof nothing {
    return nothing;
  }
}
