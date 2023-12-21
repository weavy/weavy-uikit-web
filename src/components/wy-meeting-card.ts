import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { MeetingType } from "../types/meetings.types";
import chatCss from "../scss/all.scss";
import { localized, msg, str } from "@lit/localize";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { relativeTime } from "../utils/datetime";
import "./wy-icon";
import "./wy-button";

@customElement("wy-meeting-card")
@localized()
export default class WyMeetingCard extends LitElement {
  
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  meeting!: MeetingType;

  override render() {
    const dateFull = this.meeting.ended_at
      ? new Intl.DateTimeFormat(this.weavyContext?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.meeting.ended_at)
        )
      : "";
    const dateFromNow = this.meeting.ended_at
      ? relativeTime(this.weavyContext?.locale, new Date(this.meeting.ended_at))
      : "";

    return html`
      <div class="wy-list">
        ${this.meeting.ended_at
          ? html`
              <div class="wy-item wy-meeting">
                <wy-icon name="zoom" size="96"></wy-icon>
                <div class="wy-item-body">
                  <div class="wy-item-title">${msg("Zoom meeting")}</div>
                  <div class="wy-item-body">
                    <time datetime=${this.meeting.ended_at} title=${dateFull}>${msg(str`Ended ${dateFromNow}`)}</time>
                    ${this.meeting.ended_at
                      ? html`
                          <div class="wy-meeting-actions">
                            <a href=${this.meeting.recording_url} target="_blank" class="wy-button wy-button-primary"
                              >${msg("Play recording")}</a
                            >
                          </div>
                        `
                      : nothing}
                  </div>
                </div>
              </div>
            `
          : html`
              <a class="wy-item wy-meeting" href=${this.meeting.join_url} target="_blank">
                <wy-icon name="zoom" size="96" color="native"></wy-icon>
                <div class="wy-item-body">
                  <div class="wy-item-title">${msg("Zoom meeting")}</div>
                  <div class="wy-item-body">
                    <div
                      >ID:
                      ${this.meeting.provider_id.substring(0, 3)}-${this.meeting.provider_id.substring(
                        3,
                        6
                      )}-${this.meeting.provider_id.substring(6)}</div
                    >
                    <div class="wy-meeting-actions">
                      <wy-button buttonClass="wy-button-primary">${msg("Join meeting")}</wy-button>
                    </div>
                  </div>
                </div>
              </a>
            `}
      </div>
    `;
  }
}
