import { html, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";
import { ref } from "lit/directives/ref.js";
import { WeavyProps } from "../types/weavy.types";

import WyEditor from "./wy-editor";
import "./base/wy-dropdown";
import "./base/wy-icon";
import "./base/wy-button";
import { Feature } from "../types/features.types";

@customElement("wy-comment-editor")
@localized()
export default class WyCommentEditor extends WyEditor {
  constructor() {
    super();
    this.editorType = "comments";
    this.editorClass = "wy-comment-editor";
  }

  override willUpdate(changedProperties: PropertyValues<this & WeavyProps>) {
    super.willUpdate(changedProperties);

    if (changedProperties.has("editorLocation") && this.editorLocation === "files") {
      this.editorClass = "wy-comment-editor wy-comment-editor-bottom";
    }
  }

  protected override renderTopSlot(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected override renderMiddleSlot() {
    return html`<div class="wy-comment-editor-inputs">
      <!-- Add -->
      ${this.componentFeatures?.allowsAnyFeature(
        Feature.Attachments,
        Feature.CloudFiles,
        Feature.Meetings,
        Feature.ZoomMeetings,
        Feature.GoogleMeet,
        Feature.MicrosoftTeams,
        Feature.Polls
      )
        ? html`<wy-dropdown icon="plus" directionY="up" ?disabled=${this.disabled}>
            ${this.componentFeatures?.allowsFeature(Feature.Attachments)
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
            ${this.componentFeatures?.allowsFeature(Feature.CloudFiles)
              ? html`<wy-dropdown-item @click=${this.openCloudFiles} title=${msg("From cloud")}>
                  <wy-icon name="cloud"></wy-icon>
                  <span>${msg("From cloud")}</span>
                </wy-dropdown-item>`
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
            ${this.componentFeatures?.allowsFeature(Feature.Polls)
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
      >
        ${this.renderEditorDummy()}
      </div>

      <!-- Button -->
      <wy-button kind="icon" @click="${this.submit}" title=${this.buttonText} ?disabled=${this.disabled}>
        <wy-icon name="send"></wy-icon>
      </wy-button>
    </div>`;
  }

  protected override renderBottomSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return [
      this.renderContextData(),
      this.renderLists()
    ];
  }
}
