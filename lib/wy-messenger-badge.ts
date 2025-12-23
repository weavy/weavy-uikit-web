import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { AppTypeGuid } from "./types/app.types";
import {
  ConversationFilterProps,
  UnreadConversationsController,
  UnreadConversationsProps,
} from "./controllers/unread-conversations-controller";
import { ShadowPartsController } from "./controllers/shadow-parts-controller";
import type { BadgeAppearanceType, PositionType } from "./types/ui.types";

import hostFlexCss from "./scss/host-flex.scss";
import colorModesCss from "./scss/color-modes.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-badge";
import { WeavyTypeComponent } from "./classes/weavy-type-component";

declare global {
  interface HTMLElementTagNameMap {
    "wy-messenger-badge": WyMessengerBadge;
  }
}

/**
 * Weavy component showing unread counts for conversations/apps.
 *
 * **Used sub components:**
 *
 * - [`<wy-badge>`](./components/ui/wy-badge.ts)
 *
 * @tagname wy-messenger-badge
 * @fires {WyUnreadEventType} wy-unread - Fired when the number of unread notifications change.
 */
@customElement("wy-messenger-badge")
export class WyMessengerBadge extends WeavyTypeComponent implements UnreadConversationsProps, ConversationFilterProps {
  static override styles = [hostFlexCss, colorModesCss, hostFontCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /** @internal */
  protected unreadConversations: UnreadConversationsController = new UnreadConversationsController(this);

  /**
   * Conversation types included in the unread count.
   */
  @property({ attribute: false })
  override componentTypes: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  /**
   * Display size of the badge.
   *
   * @type {"count" | "compact" | "dot" | "none"}
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
   * Agent uid filter. When set, unread counts are limited to the agent chat.
   */
  @property({ type: String })
  override set agent(agent: string | undefined) {
    super.agent = agent;
    if (this._agentUid) {
      this.componentTypes = [AppTypeGuid.AgentChat];
    } else {
      this.componentTypes = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];
    }
  }

  override get agent() {
    return super.agent;
  }

  /**
   * Current unread conversation count.
   */
  get unread(): number {
    return this.unreadConversations.unread;
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (changedProperties.has("componentTypes") || changedProperties.has("agent")) {
      await this.unreadConversations.track(this.componentTypes, this.agent);
    }
  }

  override render() {
    return this.user && this.badge !== "none"
      ? html`
          <wy-badge
            appearance=${this.badge}
            position=${this.badgePosition}
            .count=${this.unreadConversations.isUnreadPending ? NaN : this.unreadConversations.unread}
          ></wy-badge>
        `
      : nothing;
  }
}
