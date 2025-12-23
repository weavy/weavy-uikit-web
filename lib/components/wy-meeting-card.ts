import { LitElement, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type { MeetingType } from "../types/meetings.types";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { getMeetingIconName, getMeetingTitle } from "../utils/meetings";
import { openUrl } from "../utils/urls";
import { ifDefined } from "lit/directives/if-defined.js";

import hostContentCss from "../scss/host-contents.scss";

import "./ui/wy-item";
import "./ui/wy-icon";

declare global {
  interface HTMLElementTagNameMap {
    "wy-meeting-card": WyMeetingCard;
  }
}

/**
 * Card display for a meeting (e.g. Zoom, Google Meet, Teams).
 *
 * **Used sub components:**
 *
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @csspart wy-meeting - Meeting card item
 */
@customElement("wy-meeting-card")
@localized()
export class WyMeetingCard extends LitElement {
  static override styles = [hostContentCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Meeting data rendered by the card.
   */
  @property({ attribute: false })
  meeting!: MeetingType;

  override render() {
    // NOTE: meeting considered ended if created more than 2 hours ago
    const meetingHasEnded = (new Date().getTime() - new Date(this.meeting.created_at).getTime()) / (1000 * 60 * 60) > 2;

    return html`
      <wy-item-list rounded filled>
        ${meetingHasEnded
          ? html`
              <wy-item part="wy-meeting" size="lg" disabled title="${msg("Meeting ended")}">
                <wy-icon slot="image" svg="${getMeetingIconName(this.meeting.provider)}" size="48"></wy-icon>
                <span slot="title">${getMeetingTitle(this.meeting.provider)}</span>
                <span slot="text">${this.meeting.code}</span>
              </wy-item>
            `
          : html`
              <wy-item
                interactive
                size="lg"
                part="wy-meeting"
                @click=${(e: MouseEvent) => { e.preventDefault(); openUrl(this.meeting.join_url, "_blank"); }}
                url=${ifDefined(this.meeting.join_url)}
                title="${msg("Join meeting")}"
              >
                <wy-icon
                  slot="image"
                  svg="${getMeetingIconName(this.meeting.provider)}"
                  size="48"
                  color="native"
                ></wy-icon>
                <span slot="title">${getMeetingTitle(this.meeting.provider)}</span>
                <span slot="text">${this.meeting.code}</span>
              </wy-item>
            `}
        </wy-item-list>
    `;
  }
}
