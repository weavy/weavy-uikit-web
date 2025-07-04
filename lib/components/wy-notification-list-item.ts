import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";
import { relativeTime } from "../utils/datetime";
import { ifDefined } from "lit/directives/if-defined.js";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { NotificationType } from "../types/notifications.types";
import { dispatchLinkEvent, getNotificationText } from "../utils/notifications";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import {
  NotificationCloseEventType,
  NotificationHideEventType,
  NotificationMarkEventType,
  NotificationSelectEventType,
} from "../types/notifications.events";
import { NamedEvent } from "../types/generic.types";

import rebootCss from "../scss/components/base/reboot.scss";
import itemCss from "../scss/components/item.scss";
import metaCss from "../scss/components/meta.scss";
import notificationsCss from "../scss/components/notifications.scss";

import "./base/wy-avatar";
import "./base/wy-icon";
import "./base/wy-button";

@customElement("wy-notification-list-item")
@localized()
export default class WyNotificationListItem extends WeavySubComponent {
  static override styles = [rebootCss, itemCss, metaCss, notificationsCss];
  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  notificationId!: number;

  @property({ type: Boolean, reflect: true })
  selected: boolean = false;

  @property({ type: Boolean })
  standalone: boolean = false;

  @property({ attribute: false })
  notification!: NotificationType;

  private dispatchSelect(_e: Event) {
    const event: NotificationSelectEventType = new (CustomEvent as NamedEvent)("select", {
      detail: { notificationId: this.notificationId },
    });
    return this.dispatchEvent(event);
  }

  private dispatchMark(e: Event, markAsRead: boolean) {
    e.stopPropagation();
    // Note: comparing read with unread
    if (markAsRead === Boolean(this.notification.is_unread)) {
      const event: NotificationMarkEventType = new (CustomEvent as NamedEvent)("mark", {
        detail: { notificationId: this.notificationId, markAsRead: markAsRead },
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  private dispatchHide() {
    if (this.standalone) {
      const event: NotificationHideEventType = new (CustomEvent as NamedEvent)("hide", {
        bubbles: true,
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  private dispatchClose() {
    if (this.standalone) {
      const event: NotificationCloseEventType = new (CustomEvent as NamedEvent)("close", {
        bubbles: true,
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  private async handleClick(e: Event) {
    this.dispatchSelect(e);
    this.dispatchMark(e, true);
    this.dispatchHide();
    await dispatchLinkEvent(this, this.weavy, this.notification);
    this.dispatchClose();
  }

  override render() {
    const dateFull = this.notification.created_at
      ? new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.notification.created_at)
        )
      : "";
    const dateFromNow = this.notification.created_at
      ? relativeTime(this.weavy?.locale, new Date(this.notification.created_at))
      : "";

    const otherMember = this.notification.actor;

    const { title, titleHtml, detail } = getNotificationText(this.notification);

    const markButton = !this.standalone
      ? html`
          <div class="wy-item-actions wy-item-right">
            <wy-button
              kind="icon-inline"
              @click=${(e: Event) => this.dispatchMark(e, Boolean(this.notification.is_unread)) && this.dispatchClose()}
              title=${this.notification.is_unread ? msg("Mark as read") : msg("Mark as unread")}
            >
              <wy-icon
                name=${this.notification.is_unread ? "read" : "unread"}
                color=${this.notification.is_unread ? "" : "secondary"}
              ></wy-icon>
            </wy-button>
          </div>
        `
      : nothing;

    const timeMeta = !this.standalone
      ? html`
          <time class="wy-meta" datetime=${this.notification.created_at.toString()} title=${dateFull}>
            ${dateFromNow}
          </time>
        `
      : nothing;

    return html`
      <div
        class=${classMap({
          "wy-item wy-list-item-lg wy-item-hover wy-notification": true,
          "wy-unread": !this.standalone && Boolean(this.notification.is_unread),
          "wy-read": !this.standalone && !this.notification.is_unread,
          "wy-active": !this.standalone && this.selected,
        })}
        tabindex="0"
        @click=${(e: Event) => this.handleClick(e)}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        <div class="wy-item-inner">
          <wy-avatar
            class="wy-item-top"
            src=${ifDefined(otherMember?.avatar_url)}
            name=${ifDefined(otherMember?.name)}
            description=${ifDefined(otherMember?.comment)}
            presence=${otherMember?.presence || "away"}
            ?isAgent=${otherMember?.is_agent}
            id=${ifDefined(otherMember?.id)}
            size=${48}
          ></wy-avatar>

          <div class="wy-item-rows wy-item-rows-compact">
            <div class="wy-item-row">
              <div class="wy-item-title-lg" title=${title + (detail ? `: "${detail}"` : "")}>
                ${titleHtml}${detail ? html`: <q class="wy-item-quote">${detail}</q> ` : nothing}
              </div>
            </div>
            <div class="wy-item-row"> ${timeMeta} ${markButton} </div>
          </div>

          ${this.standalone
            ? html`
                <wy-button
                  kind="icon"
                  @click=${(e: Event) =>
                    this.dispatchMark(e, Boolean(this.notification.is_unread)) && this.dispatchClose()}
                >
                  <wy-icon name="close"></wy-icon>
                </wy-button>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}
