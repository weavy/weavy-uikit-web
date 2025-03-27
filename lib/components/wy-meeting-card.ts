import { LitElement, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type { MeetingType } from "../types/meetings.types";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { getMeetingIconName, getMeetingTitle } from "../utils/meetings";

import chatCss from "../scss/all.scss";

import "./base/wy-icon";
import "./base/wy-button";

@customElement("wy-meeting-card")
@localized()
export default class WyMeetingCard extends LitElement {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  meeting!: MeetingType;

  override render() {
    // NOTE: meeting considered ended if created more than 2 hours ago
    const meetingHasEnded = (new Date().getTime() - new Date(this.meeting.created_at).getTime()) / (1000 * 60 * 60) > 2;

    return html`
      <div class="wy-list">
        ${meetingHasEnded
          ? html`<div class="wy-item wy-list-item wy-meeting wy-disabled" title="${msg("Meeting ended")}">
                <wy-icon svg="${getMeetingIconName(this.meeting.provider)}" size="48" ></wy-icon>                
                <div class="wy-item-body">
                  <div class="wy-item-title">${getMeetingTitle(this.meeting.provider)}</div>
                  <div class="wy-item-text">${this.meeting.code}</div>
                </div> 
              </div>`
          : html`<a class="wy-item wy-list-item wy-meeting" href=${this.meeting.join_url} target="_blank"  title="${msg("Join meeting")}">
              <wy-icon svg="${getMeetingIconName(this.meeting.provider)}" size="48" color="native"></wy-icon>
              <div class="wy-item-body">
                <div class="wy-item-title">${getMeetingTitle(this.meeting.provider)}</div>
                <div class="wy-item-text">${this.meeting.code}</div>                
              </div>
            </a>`}
      </div>
    `;
  }
}
