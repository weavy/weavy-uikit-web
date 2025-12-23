import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
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

import rebootCss from "../scss/reboot.scss";
import textCss from "../scss/components/text.scss";
import notificationsCss from "../scss/components/notifications.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-avatar";
import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-item";

declare global {
  interface HTMLElementTagNameMap {
    "wy-notification-list-item": WyNotificationListItem;
  }
}

/**
 * Notification list item used in lists or standalone toasts.
 *
 * **Used sub components:**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @csspart wy-notification - Root notification container.
 * @csspart wy-notification-text - Notification text.
 * @csspart wy-meta - Meta/time area.
 * @csspart wy-quote - Quoted notification text.
 *
 * @fires {NotificationSelectEventType} select - Emitted when the notification is selected.
 * @fires {NotificationMarkEventType} mark - Emitted when the notification is marked read/unread.
 * @fires {NotificationHideEventType} hide - Emitted when a standalone notification should be hidden.
 * @fires {NotificationCloseEventType} close - Emitted when a standalone notification should be closed.
 */
@customElement("wy-notification-list-item")
@localized()
export class WyNotificationListItem extends WeavySubComponent {
  static override styles = [rebootCss, textCss, notificationsCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Identifier of the notification being rendered.
   */
  @property({ type: Number })
  notificationId!: number;

  /**
   * Highlight the item when it matches the current selection.
   */
  @property({ type: Boolean, reflect: true })
  selected: boolean = false;

  /**
   * Render as a standalone toast (enables dismiss actions).
   */
  @property({ type: Boolean })
  standalone: boolean = false;

  /**
   * Notification data shown in the item.
   */
  @property({ attribute: false })
  notification!: NotificationType;

  /**
   * Emit a `select` event for the current notification.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchSelect(_e: Event) {
    const event: NotificationSelectEventType = new (CustomEvent as NamedEvent)("select", {
      detail: { notificationId: this.notificationId },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `mark` event toggling read status.
   *
   * @internal
   * @param e - Source event triggering the action.
   * @param markAsRead - Target read state.
   * @returns {boolean} True if the event was not canceled.
   */
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

  /**
   * Emit a `hide` event when the toast should disappear.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchHide() {
    if (this.standalone) {
      const event: NotificationHideEventType = new (CustomEvent as NamedEvent)("hide", {
        bubbles: true,
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit a `close` event when the toast should close.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchClose() {
    if (this.standalone) {
      const event: NotificationCloseEventType = new (CustomEvent as NamedEvent)("close", {
        bubbles: true,
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Handle click interactions and trigger navigation plus dismissal.
   *
   * @internal
   */
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

    return html`
      <wy-item
        part="wy-notification"
        size="md"
        interactive
        outer
        status=${!this.standalone && !this.notification.is_unread ? "read" : undefined }
        ?selected=${!this.standalone && this.selected}
        align="top"
        actionsPosition=${this.standalone ? "end" : "bottom"}
        tabindex="0"
        @click=${(e: Event) => this.handleClick(e)}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        <wy-avatar
          slot="image"
          src=${ifDefined(otherMember?.avatar_url)}
          name=${ifDefined(otherMember?.name)}
          description=${ifDefined(otherMember?.comment)}
          presence=${otherMember?.presence || "away"}
          ?isAgent=${otherMember?.is_agent}
          id=${ifDefined(otherMember?.id)}
          size=${48}
        ></wy-avatar>

        <div slot="title" part="wy-notification-text" title=${title + (detail ? `: "${detail}"` : "")}>
          ${titleHtml}${detail ? html`: <q part="wy-quote">${detail}</q> ` : nothing}
      </div>

        ${!this.standalone
          ? html`
              <time slot="text" part="wy-meta" datetime=${this.notification.created_at.toString()} title=${dateFull}>
                ${dateFromNow}
              </time>
            `
          : nothing}
        ${this.standalone
          ? html`
              <wy-button
                slot="actions"
                kind="icon"
                @click=${(e: Event) =>
                  this.dispatchMark(e, Boolean(this.notification.is_unread)) && this.dispatchClose()}
              >
                <wy-icon name="close"></wy-icon>
              </wy-button>
            `
          : html`
              <wy-button
                small
                slot="actions"
                kind="icon"
                @click=${(e: Event) =>
                  this.dispatchMark(e, Boolean(this.notification.is_unread)) && this.dispatchClose()}
                title=${this.notification.is_unread ? msg("Mark as read") : msg("Mark as unread")}
              >
                <wy-icon
                  name=${this.notification.is_unread ? "read" : "unread"}
                  color=${this.notification.is_unread ? "" : "secondary"}
                ></wy-icon>
              </wy-button>
            `}
      </wy-item>
    `;
  }
}
