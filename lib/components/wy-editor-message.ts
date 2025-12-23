import { html, nothing, TemplateResult } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { localized, msg } from "@lit/localize";
import { ref } from "lit/directives/ref.js";
import { Feature } from "../types/features.types";

import messageEditorCss from "../scss/components/editor-message.scss";

import { WyEditor } from "./wy-editor";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-message-editor": WyMessageEditor;
  }
}

/**
 * Message editor used inside conversations for composing messages.
 *
 * **Used sub components:**
 *
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-item>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @csspart wy-message-editor-inputs - Container for the editor inputs and add menu
 * @csspart wy-message-editor-text - Wrapper for the editor text area
 */
@customElement("wy-message-editor")
@localized()
export class WyMessageEditor extends WyEditor {

  static override styles = [...WyEditor.styles, messageEditorCss];

  constructor() {
    super();
    this.editorType = "messages";
    this.editorClass = "wy-message-editor";
  }

  /**
   * Render content that appears above the message editor.
   *
   * By default returns the same lists section used by the base editor.
   *
   * @internal
   */
  protected override renderTopSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return [
      this.renderLists()
    ];
  }

  /**
   * Render the primary middle slot containing the add-menu, editor and send button.
   *
   * Overrides the base implementation to provide message-specific controls and layout.
   *
   * @internal
   */
  protected override renderMiddleSlot() {
    return html` <div part="wy-message-editor-inputs">
      <!-- Add -->
      ${this.componentFeatures?.allowsAnyFeature(
        Feature.Attachments,
        Feature.CloudFiles,
        Feature.Polls,
        Feature.Meetings,
        Feature.ZoomMeetings,
        Feature.GoogleMeet,
        Feature.MicrosoftTeams
      )
        ? html`<wy-dropdown icon="plus" directionY="up" ?disabled=${this.disabled}>
            ${this.componentFeatures?.allowsFeature(Feature.Attachments)
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
            ${this.componentFeatures?.allowsFeature(Feature.CloudFiles)
              ? html`
                  <wy-dropdown-item @click=${this.openCloudFiles} title=${msg("From cloud")}>
                    <wy-icon name="cloud"></wy-icon>
                    <span>${msg("From cloud")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.componentFeatures?.allowsFeature(Feature.Polls)
              ? html`
                  <wy-dropdown-item @click=${() => this.openPolls()} title=${msg("Poll")}>
                    <wy-icon name="poll"></wy-icon>
                    <span>${msg("Poll")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.ZoomMeetings)
              ? html`
                  <wy-dropdown-item @click=${() => this.handleMeetingClick("zoom")} title=${msg("Zoom meeting")}>
                    <wy-icon svg="zoom-meetings"></wy-icon>
                    <span>${msg("Zoom meeting")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.GoogleMeet)
              ? html`
                  <wy-dropdown-item @click=${() => this.handleMeetingClick("google")} title=${msg("Google Meet")}>
                    <wy-icon svg="google-meet"></wy-icon>
                    <span>${msg("Google Meet")}</span>
                  </wy-dropdown-item>
                `
              : nothing}
            ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.MicrosoftTeams)
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
      <div part="wy-message-editor-text" ${ref(this.editorRef)}> ${this.renderEditorDummy()} </div>

      <!-- Button -->
      <wy-button
        kind="icon"
        color="primary-text"
        title=${msg("Send", { desc: "Button action to send" })}
        @click="${() => this.submit()}"
        ?disabled=${this.disabled}
      >
        <wy-icon name="send"></wy-icon>
      </wy-button>
    </div>`;
  }

  /**
   * Render the bottom slot for message editor with no content.
   *
   * @internal
   */
  protected override renderBottomSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return nothing;
  }
}
