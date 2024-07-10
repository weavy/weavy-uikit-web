import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "@lit/localize";
import { ThemeController } from "./controllers/theme-controller";
import { BlockProviderMixin } from "./mixins/block-mixin";
import { Constructor } from "./types/generic.types";
import { ContextualTypes } from "./types/app.types";
import { NotificationType, NotificationTypes } from "./types/notifications.types";
import { repeat } from "lit/directives/repeat.js";
import { getMarkNotificationMutation } from "./data/notifications";
import { RealtimeNotificationEventType } from "./types/realtime.types";
import { WeavyContextProps } from "./types/weavy.types";
import { dispatchLinkEvent, getNotificationText } from "./utils/notifications";

import colorModesStyles from "./scss/color-modes";
import { hostContents } from "./scss/host";

import "./components/wy-notification-list-item";
import { WyToast } from "./components/wy-toast";

@customElement("wy-notification-toasts")
@localized()
export class WyNotificationToasts extends BlockProviderMixin(LitElement) {
  static override styles = [colorModesStyles, hostContents];

  override contextualType = ContextualTypes.Unknown;

  /**
   * What type of notifications to display.
   *
   * @type "" | "activity" | "mention" | "reaction"
   */
  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  /**
   * Sets the kind of notifications to use.
   * - "internal" - Use HTML notifications.
   * - "native" - Use browser notifications.
   */
  @property()
  appearance: "internal" | "native" /*| "auto"*/ = "internal";

  /**
   * Require the user to consent to notifications.
   * This in only affective with appearance =  "internal", since "native" always requires user consent.
   *
   * @type Boolean
   */
  @property({ type: Boolean })
  requestUserPermission: boolean = false;

  /**
   * Sets the duration in ms of the *internal* notification toasts. Defaults to 5000.
   */
  @property({ type: Number })
  duration: number = WyToast.defaultDuration;

  @state()
  protected _notifications: NotificationType[] = [];

  _nativeNotifications: Notification[] = [];

  protected markNotificationMutation?: ReturnType<typeof getMarkNotificationMutation>;

  protected handleEvent = (e: RealtimeNotificationEventType) => {
    if (this.typeFilter === NotificationTypes.All || this.typeFilter === e.notification.type) {
      if (e.action === "notification_deleted") {
        this.removeNotification(e.notification.id);
        this.closeNativeNotification(e.notification.id);
      } else {
        if (e.action === "notification_created" && e.notification.is_unread) {
          this.addOrUpdateNotification(e.notification);
        } else {
          this.updateNotification(e.notification);
        }
        this.addOrUpdateNativeNotification(e.notification);
      }
    }
  };

  async addOrUpdateNotification(notification: NotificationType) {
    if (!this.requestUserPermission || (await this.hasUserPermission())) {
      const updatedNotifications = [...this._notifications];
      const existingNotificationIndex = updatedNotifications.findIndex((n) => n.id === notification.id);

      if (existingNotificationIndex !== -1) {
        updatedNotifications.splice(existingNotificationIndex, 1, notification);
        this._notifications = updatedNotifications;
      } else {
        updatedNotifications.push(notification);
        this._notifications = updatedNotifications;
      }
    }
  }

  async updateNotification(notification: NotificationType) {
    if (!this.requestUserPermission || (await this.hasUserPermission())) {
      const updatedNotifications = [...this._notifications];
      const existingNotificationIndex = updatedNotifications.findIndex((n) => n.id === notification.id);

      if (existingNotificationIndex !== -1) {
        updatedNotifications.splice(existingNotificationIndex, 1, notification);
        this._notifications = updatedNotifications;
      }
    }
  }

  removeNotification(notificationId: number) {
    const updatedNotifications = [...this._notifications];
    const existingNotificationIndex = updatedNotifications.findIndex((n) => n.id === notificationId);
    if (existingNotificationIndex !== -1) {
      updatedNotifications.splice(existingNotificationIndex, 1);
      this._notifications = updatedNotifications;
    }
  }

  async addOrUpdateNativeNotification(notification: NotificationType) {
    if (this.appearance !== "internal" && (await this.hasUserPermission())) {
      const updatedExistingNotification = this.removeNativeNotification(notification.id);
      const otherMember = notification.actor;
      const { title, detail } = getNotificationText(notification);
      const nativeNotification = new Notification(title, {
        tag: `wy-${notification.id}`,
        lang: this.weavyContext?.locale,
        body: detail,
        icon: otherMember.avatar_url,
        // @ts-expect-error Property `renotify` not available in ts types yet
        renotify: updatedExistingNotification && e.notification.is_unread,
      });

      nativeNotification.onclick = async () => {
        const weavyContext = await this.whenWeavyContext();
        this.handleMark(true, notification.id);
        dispatchLinkEvent(this, weavyContext, notification);
      };

      nativeNotification.onclose = () => {
        this.removeNativeNotification(notification.id);
      };

      this._nativeNotifications = [...this._nativeNotifications, nativeNotification];
    }
  }

  removeNativeNotification(notificationId: number) {
    const updatedNativeNotifications = [...this._nativeNotifications];
    const existingNativeNotificationIndex = updatedNativeNotifications.findIndex(
      (n) => n.tag === `wy-${notificationId}`
    );
    if (existingNativeNotificationIndex) {
      updatedNativeNotifications.splice(existingNativeNotificationIndex, 1);
      this._nativeNotifications = updatedNativeNotifications;
      return true;
    }
    return false;
  }

  closeNativeNotification(notificationId: number) {
    const existingNativeNotificationIndex = this._nativeNotifications.findIndex(
      (n) => n.tag === `wy-${notificationId}`
    );
    if (existingNativeNotificationIndex) {
      this._nativeNotifications[existingNativeNotificationIndex].close();
      return true;
    }
    return false;
  }

  async hasUserPermission() {
    if (!("Notification" in window)) {
      console.error("This browser does not support desktop notifications");
    } else if (!window.isSecureContext) {
      console.error(
        `Desktop notifications can only be used in secure contexts. 
        See https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts`
      );
    } else if (Notification.permission === "granted") {
      return true;
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    // Unavailable or the user has denied notifications
    return false;
  }

  clearNotifications() {
    this._notifications = [];
  }

  private async handleMark(markAsRead: boolean, notificationId: number) {
    await this.markNotificationMutation?.mutate({ markAsRead: markAsRead, notificationId });
  }

  #unsubscribeToRealtime?: () => void;

  constructor() {
    super();
    new ThemeController(this, WyNotificationToasts.styles);
  }

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.markNotificationMutation = getMarkNotificationMutation(this.weavyContext);

      this.#unsubscribeToRealtime?.()

      this.weavyContext.subscribe(null, "notification_created", this.handleEvent);
      this.weavyContext.subscribe(null, "notification_updated", this.handleEvent);
      //this.weavyContext.subscribe(null, "notification_deleted", this.handleEvent);

      this.#unsubscribeToRealtime = () => {
        this.weavyContext?.unsubscribe(null, "notification_created", this.handleEvent);
        this.weavyContext?.unsubscribe(null, "notification_updated", this.handleEvent);
        //this.weavyContext?.unsubscribe(null, "notification_deleted", this.handleEvent);
        this.#unsubscribeToRealtime = undefined;
      }
    }

    if (
      (changedProperties.has("requestUserPermission") && this.requestUserPermission) ||
      (changedProperties.has("appearance") && this.appearance !== "internal")
    ) {
      this.hasUserPermission();
    }
  }

  override render() {
    return html`
      ${this.user && this.appearance !== "native"
        ? html`
            <wy-toasts ?show=${Boolean(this._notifications.length)} @hide=${this.clearNotifications}>
              ${repeat(
                this._notifications,
                (notification) => notification.id,
                (notification) => {
                  return html`
                    <wy-toast
                      duration=${this.duration}
                      @closed=${(e: CustomEvent<{ silent: boolean }>) => {
                        if (!e.detail.silent) {
                          this.handleMark(true, notification.id);
                        }
                        this.removeNotification(notification.id);
                      }}
                    >
                      <wy-notification-list-item standalone .notification=${notification}></wy-notification-list-item>
                    </wy-toast>
                  `;
                }
              )}
            </wy-toasts>
          `
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}

export type WyNotificationToastsType = Constructor<WyNotificationToasts>;
