import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { AppTypeGuid } from "./types/app.types";
import {
  ConversationFilterProps,
  UnreadConversationsController,
  UnreadConversationsProps,
} from "./controllers/unread-conversations-controller";
import type { BadgeAppearanceType, PositionType } from "./types/ui.types";
import { WeavyTypeComponent } from "./classes/weavy-type-component";
import { ThemeController } from "./controllers/theme-controller";

import hostFlexCss from "./scss/host-flex.scss";
import colorModesCss from "./scss/color-modes.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-badge";

declare global {
  interface HTMLElementTagNameMap {
    "wy-messenger-badge": WyMessengerBadge;
  }
}

/**
 * Weavy Messenger badge component that renders a realtime badge for the number of unread conversations.
 * The badge fits well into a button or similar.
 * The badge is automatically updated when new messages awaits and when messages have been read.
 *
 * When the `unread` count property changes, the component fires a `"wy-unread"` event with the updated count.
 * You can listen to the event to use the unread count for something else, and you can also turn off the component rendering by setting the `badge` property to `"none"`.
 * 
 * ** Component layout **
 *
 * The badge displays as an inline badge, matching normal text per default.
 * It has a filled background with rounded edge.
 * The badge scales with the current font-size where it's placed, using `0.75em` for the badge `font-size`.
 * The badge is only displayed when there is an unread count of 1 or higher.
 *
 * > When placing the badge in a `<button>` element, note that buttons initially have a `font-size` of `13.3333px` instead of inheriting font-size from it's parents.
 *
 * Setting the `badge` property to `"dot"` removes the text, only indicating that there is unread conversations without any count.
 *
 * The `badgePosition` property can be changed from `"inline"` to `"top-right"` or any other corner,
 * to give it absolute positioning over the top-right corner.
 * The absolute positioning is relative to the closest parent element with set CSS `position`, for instance `relative` positioning.
 *
 * **Used sub components:**
 *
 * - [`<wy-badge>`](./components/ui/wy-badge.ts)
 *
 * @tagname wy-messenger-badge
 * @fires {WyUnreadEventType} wy-unread - Fired when the number of unread conversations change.
 * 
 * @example <caption>Inline Messenger badge in a text</caption>
 *
 * Display a badge that shows unread count and tracks messages and conversations for the authenticated user.
 * 
 * ```html
 * <div>Messenger <wy-messenger-badge></wy-messenger-badge></div>
 * ```
 *
 * @example <caption>Cornered Messenger badge</caption>
 *
 * Displays a badge in the top-right corner of a button with adjusted font-size.
 * Note that the badge position is relative to its closest positioned ancestor element, therefore we need to set CSS `position` on the button.
 *
 * ```html
 * <button style="position: relative; font-size: 1rem;">
 *   <span>Messenger</span>
 *   <wy-messenger-badge badgePosition="top-right"></wy-messenger-badge>
 * </button>
 * ```
 */
@customElement("wy-messenger-badge")
export class WyMessengerBadge extends WeavyTypeComponent implements UnreadConversationsProps, ConversationFilterProps {
  static override styles = [hostFlexCss, colorModesCss, hostFontCss];

  /** @internal */
  protected theme = new ThemeController(this, WyMessengerBadge.styles);

  /** @internal */
  protected unreadConversations: UnreadConversationsController = new UnreadConversationsController(this);

  /** 
   * Disabled link matching/consuming.
   * @internal 
   */
  override matchesLink(): boolean {
    return false;
  }

  /**
   * Conversation types included in the unread count.
   */
  @property({ attribute: false })
  override appTypes: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  /**
   * Display size of the badge.
   *
   * @type {"count" | "dot" | "none"}
   * @default "count"
   */
  @property({ type: String })
  badge: BadgeAppearanceType = "count";

  /**
   * Positioning of the badge.
   *
   * @type {"inline" | "top-right" | "bottom-right" | "bottom-left" | "top-left"}
   * @default "inline"
   */
  @property({ type: String })
  badgePosition: PositionType = "inline";

  /**
   * Current unread conversation count.
   */
  get unread(): number {
    return this.unreadConversations.unread;
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (changedProperties.has("appTypes")) {
      await this.unreadConversations.track(this.appTypes);
    }
  }

  override render() {
    return this.user && this.badge !== "none"
      ? html`
          <wy-badge
            ?dot=${this.badge === "dot"}
            position=${this.badgePosition}
          >${this.unreadConversations.isUnreadPending ? "" : this.unreadConversations.unread}</wy-badge>
        `
      : nothing;
  }
}
