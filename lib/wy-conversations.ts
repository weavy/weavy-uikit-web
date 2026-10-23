import { html, type PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized } from "@lit/localize";
import { AppTypeGuid } from "./types/app.types";
import { ComponentFeatures } from "./contexts/features-context";
import {
  type ConversationFilterProps,
  UnreadConversationsController,
  type UnreadConversationsProps,
} from "./controllers/unread-conversations-controller";
import { DefaultMessengerFeatures } from "./types/conversation.types";
import { WyActionEventType } from "./types/action.events";
import { ActionType } from "./types/action.types";
import { NamedEvent } from "./types/generic.types";
import { AppTypeStrings, WeavyTypeComponent } from "./classes/weavy-type-component";
import { byWhitespace } from "./utils/strings";

import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostFillCss from "./scss/host-fill.scss";
import hostFontCss from "./scss/host-font.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";

import "./components/wy-conversation-list";

declare global {
  interface HTMLElementTagNameMap {
    "wy-conversations": WyConversations;
  }
}

/**
 * @import { WyUnreadEventType } from "./types/ui.events"
 */

/**
 * Weavy conversations component to list and select chats, one-to-one conversations or group chats.
 *
 * **Component Layout**
 *
 * The component is [block-level](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content) with pre-defined CSS styling to adapt to flex- and grid-layouts as well as traditional flow-layouts.
 * It's usually recommended to use a proper flex-layout for the container you are placing the component in for a smooth layout integration.
 *
 * The height grows with the content per default. Content is automatically loaded during scrolling when the last content becomes visible (aka infinite scrolling).
 * If placed in a flex- or grid-layout or if an explicit height is set, the component becomes scrollable.
 *
 * The content within the components is per default aligned to the edges of it's own _box_ and designed to not be placed next to a edge or border. 
 * It's recommended to adjust the layout with your default padding. Setting the `--wy-padding-outer` to your default padding will allow the component to still fill the are where it's placed, 
 * but with proper padding within the scrollable area of the component. 
 * If you want to make the component go all the way to the edges without padding or any outermost roundness instead, 
 * set `--wy-padding-outer: 0;` and `--wy-border-radius-outer: 0;` to make the component fit nicely with the edge. 
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_.
 *
 * **Used sub components:**
 *
 * - [`<wy-conversation-list>`](./components/wy-conversation-list.ts)
 *
 * @tagname wy-conversations
 * @fires {WyActionEventType} wy-action - Emitted when a conversation is selected or an action is performed on a conversation.
 * @fires {WyUnreadEventType} wy-unread - Fired when the number of unread notifications change.
 *
 * @example <caption>Standard conversation list</caption>
 * A conversation list placed in a container using a flex layout.
 *
 * ```html
 * <div style="display: flex; height: 100%;">
 *   <wy-conversations></wy-conversations>
 * </div>
 * ```
 */
@customElement("wy-conversations")
@localized()
export class WyConversations
  extends WeavyTypeComponent
  implements UnreadConversationsProps, ConversationFilterProps
{
  static override styles = [colorModesCss, hostBlockCss, hostFillCss, hostFontCss, hostPaddedCss, hostScrollYCss];

  /** @internal */
  override componentFeatures = new ComponentFeatures(DefaultMessengerFeatures);

  /** @internal */
  protected theme = new ThemeController(this, WyConversations.styles);

  /** @internal */
  protected unreadConversations: UnreadConversationsController = new UnreadConversationsController(this);

  /** App types included in the conversation list. The attribute accepts whitespace-separated type names or guids. */
  @property({
    converter: {
      fromAttribute(value: string | null): AppTypeGuid[] {
        // Markup uses names or guids separated by whitespace, e.g. appTypes="chat_room private_chat".
        if (value === null) {
          return [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];
        }
        return value.trim().split(byWhitespace).filter(Boolean).map((type) => {
          const guid = Array.from(AppTypeStrings).find(([name]) => name === type)?.[1] ??
            Object.values(AppTypeGuid).find((guid) => String(guid) === type);
          if (!guid) {
            throw new Error(`Unknown conversation app type: ${type}`);
          }
          return guid;
        });
      },
    },
  })
  override appTypes: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  /** Current unread conversation count. */
  get unread(): number {
    return this.unreadConversations.unread;
  }

  /** Active conversation id. */
  @property({ type: Number })
  conversationId?: number | null = null;

  /** @internal */
  protected persistState = new PersistStateController(this);

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("user")) &&
      this.weavy &&
      this.user
    ) {
      this.persistState.observe(
        [{ name: "conversationId", override: false }],
        "conversations",
        `u${this.user?.id}`,
        (changedPersistProperties) => {
          if (changedPersistProperties.has("conversationId") && this.conversationId) {
            // Dispatch wy-action event when conversationId is initially restored
            const event: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
              detail: {
                action: ActionType.Select,
                app: { id: this.conversationId },
              },
              bubbles: true,
              composed: true,
            });
            this.dispatchEvent(event);
          }
        }
      );
    }

    if (changedProperties.has("link") && this.link?.app) {
      this.conversationId = this.link.app.id;
    }

    if (changedProperties.has("appTypes")) {
      await this.unreadConversations.track(this.appTypes);
    }
  }

  override render() {
    return html`
      <wy-conversation-list
        .conversationTypes=${this.appTypes}
        conversationId=${ifDefined(this.conversationId !== null ? this.conversationId : undefined)}
        @wy-action=${(e: WyActionEventType) => {
          if (!e.defaultPrevented && e.detail.action === ActionType.Select && e.detail.app !== undefined) {
            this.conversationId = e.detail.app?.id;
          }
        }}
      >
      </wy-conversation-list>
    `;
  }
}
