import { html, type PropertyValues, PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";
import { type AppRef, type AppType, AppTypeGuid, AppTypeString } from "./types/app.types";
import { QueryController } from "./controllers/query-controller";
import type { BotType } from "./types/users.types";
import { cache } from "lit/directives/cache.js";
import { WeavyComponent } from "./classes/weavy-component";
import { ProductTypes } from "./types/product.types";
import { getConversationOptions, resolveAppWithType } from "./data/conversation";

import allStyles from "./scss/all.scss";
import messengerStyles from "./scss/components/messenger.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostFontStyles from "./scss/host-font.scss";

import "./components/wy-empty";
import "./components/wy-conversation-appbar";
import "./components/wy-conversation-list";
import "./components/wy-conversation";
import "./components/wy-conversation-extended";
import "./components/wy-button";
import "./components/wy-icon";
import "./components/wy-messenger-badge";
import "./components/wy-spinner";

/**
 * The conversation app type strings and app type guids associated with the Messenger.
 */
export const MessengerTypes = new Map(
  Object.entries({
    [AppTypeString.ChatRoom]: AppTypeGuid.ChatRoom,
    [AppTypeString.PrivateChat]: AppTypeGuid.PrivateChat,
    [AppTypeGuid.ChatRoom]: AppTypeString.ChatRoom,
    [AppTypeGuid.PrivateChat]: AppTypeString.PrivateChat,
  })
);

/**
 * The conversation app type strings and app type guids specific for bots in Messenger.
 */
export const MessengerBotTypes = new Map(
  Object.entries({
    [AppTypeString.BotChat]: AppTypeGuid.BotChat,
    [AppTypeGuid.BotChat]: AppTypeString.BotChat,
  })
);

export const WY_MESSENGER_TAGNAME = "wy-messenger";

declare global {
  interface HTMLElementTagNameMap {
    [WY_MESSENGER_TAGNAME]: WyMessenger;
  }
}

/**
 * Weavy messenger component to render multiple one-to-one conversations, group chats or bot conversations.
 *
 * @element wy-messenger
 * @class WyMessenger
 * @fires wy-preview-open {WyPreviewOpenEventType}
 * @fires wy-preview-close {WyPreviewCloseEventType}
 */
@customElement(WY_MESSENGER_TAGNAME)
@localized()
export class WyMessenger extends WeavyComponent {
  static override styles = [colorModesStyles, allStyles, messengerStyles, hostBlockStyles, hostFontStyles];

  override productType = ProductTypes.Messenger;

  @state()
  override appTypes: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  @property({ type: String })
  override get bot() {
    return super.bot;
  }
  override set bot(bot: string | undefined) {
    super.bot = bot
    if (this._bot) {
      this.appTypes = [AppTypeGuid.BotChat];
    } else {
      this.appTypes = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];
    }
    this.conversationId = null;
  }

  @state()
  conversationId: number | null = null;

  protected conversationQuery = new QueryController<AppType>(this);

  protected botQuery = new QueryController<BotType>(this);

  protected persistState = new PersistStateController(this);

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  protected releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  /**
   * Checks if a conversation belongs to Messenger.
   *
   * @param conversation {AppRef | AppType | number} - The conversation or id to check if it belongs to Messenger.
   * @returns Promise<Boolean>
   */
  async conversationBelongsToMessenger(conversation: AppRef | AppType | number): Promise<boolean> {
    if (!this.weavy) {
      return false;
    }

    return Boolean(await resolveAppWithType(this.weavy, conversation, this.appTypes, this.bot));
  }

  /**
   * Deselects any active conversation.
   */
  clearConversation() {
    this.conversationId = null;
  }

  constructor() {
    super();
    new ThemeController(this, WyMessenger.styles);
  }

  protected override async willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("bot") || changedProperties.has("user")) &&
      this.weavy &&
      this.user
    ) {
      this.persistState.observe(["conversationId"], this.bot || "messenger", `u${this.user?.id}`);
    }

    /*if (!this.botQuery.result?.isPending) {
      this.botUser = this.botQuery.result?.data;
    }*/

    if (changedProperties.has("link")) {
      if (this.link?.app) {
        if (await this.conversationBelongsToMessenger(this.link.app)) {
          this.conversationId = this.link.app.id;
        } else {
          throw new Error("Not a conversation");
        }
      }
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>) {
    super.update(changedProperties);

    if ((changedProperties.has("conversationId") || changedProperties.has("weavy")) && this.weavy) {
      if (this.conversationId) {
        this.conversationQuery.trackQuery(getConversationOptions(this.weavy, this.conversationId, this.appTypes));
      } else {
        this.conversationQuery.untrackQuery();
      }
    }
  }

  override render() {
    const { isPending: networkIsPending } = this.weavy?.network ?? { isPending: true };
    const { data: conversation, isPending } = this.conversationQuery.result ?? { isPending: networkIsPending };

    return html`
      <div class="wy-messenger-layout">
        <wy-conversation-list
          class="wy-scroll-y"
          .conversationTypes=${this.appTypes}
          .bot=${this.bot}
          .avatarUser=${this.botUser}
          .name=${this.name}
          conversationId=${ifDefined(this.conversationId !== null ? this.conversationId : undefined)}
          @conversation-selected=${(e: CustomEvent) => (this.conversationId = e.detail.id)}
        ></wy-conversation-list>

        <div
          class="wy-messenger-conversation wy-scroll-y"
          data-conversation-id=${this.conversationId !== null ? this.conversationId : ""}
        >
          <wy-conversation-appbar
            .conversationId=${this.conversationId || undefined}
            .conversation=${conversation}
            @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}
          >
            <span slot="action" class="wy-close-conversation">
              <wy-button kind="icon" @click=${() => (this.conversationId = null)}>
                <wy-icon name="back"></wy-icon>
              </wy-button>
              <wy-messenger-badge slot="badge" .bot=${this.bot}></wy-messenger-badge>
            </span>
          </wy-conversation-appbar>

          ${cache(
            this.conversationId
              ? !isPending
                ? this.bot
                  ? html`<wy-conversation
                      .conversationId=${this.conversationId}
                      .conversation=${conversation}
                    ></wy-conversation>`
                  : html`<wy-conversation-extended
                      .conversationId=${this.conversationId}
                      .conversation=${conversation}
                    ></wy-conversation-extended>`
                : html`<wy-empty><wy-spinner reveal></wy-spinner></wy-empty>`
              : html`<wy-empty noNetwork>${msg("Select a conversation")}</wy-empty>`
          )}
        </div>
      </div>
    `;
  }
}
