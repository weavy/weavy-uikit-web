import { LitElement, html, type PropertyValues, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
//import { HistoryController } from './controllers/history-controller'
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";
import { AppRef, AppType } from "./types/app.types";
import { ConversationTypeGuid, type ConversationType } from "./types/conversations.types";
import { QueryController } from "./controllers/query-controller";
import { getApiOptions } from "./data/api";
import type { BotType } from "./types/users.types";
import { cache } from "lit/directives/cache.js";
import { BlockProviderMixin } from "./mixins/block-mixin";
import { Constructor } from "./types/generic.types";
import { ProductTypes } from "./types/product.types";
import { getConversationOptions, resolveConversation } from "./data/conversation";

import allStyles from "./scss/all.scss";
import messengerStyles from "./scss/components/messenger.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostFontStyles from "./scss/host-font.scss";

import "./components/wy-empty";
import "./components/wy-conversation-appbar";
import "./components/wy-conversation-list";
import "./components/wy-conversation-extended";
import "./components/wy-button";
import "./components/wy-icon";
import "./components/wy-badge";
import "./components/wy-spinner";

@customElement("wy-messenger")
@localized()
export class WyMessenger extends BlockProviderMixin(LitElement) {
  static override styles = [colorModesStyles, allStyles, messengerStyles, hostBlockStyles, hostFontStyles];

  override productType = ProductTypes.Messenger;

  @state()
  override conversationTypes: ConversationTypeGuid[] = [
    ConversationTypeGuid.ChatRoom,
    ConversationTypeGuid.PrivateChat,
  ];

  @property()
  bot?: string;

  @state()
  botUser?: BotType;

  @state()
  conversationId: number | null = null;

  @state()
  protected conversation?: ConversationType;

  protected conversationQuery = new QueryController<ConversationType>(this);

  protected botQuery = new QueryController<BotType>(this);

  //history = new HistoryController<this>(this, 'messenger', ['conversationId'])
  protected persistState = new PersistStateController<this>(this, this.bot || "messenger", ["conversationId"]);

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
    if (!this.weavyContext) {
      return false;
    }

    return Boolean(await resolveConversation(this.weavyContext, conversation, this.conversationTypes));
  }

  /**
   * Set the active conversation.
   *
   * @param id {number} - The id of the conversation to select.
   */
  async selectConversation(id: number) {
    if (await this.conversationBelongsToMessenger(id)) {
      this.conversationId = id;
    } else {
      throw new Error(`The conversation ${id} is invalid.`);
    }
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

    if ((changedProperties.has("weavyContext") || changedProperties.has("bot")) && this.weavyContext && this.bot) {
      this.persistState.prefixKey = this.bot || "messenger";
      this.conversationTypes = [ConversationTypeGuid.BotChat];
      this.botQuery.trackQuery(getApiOptions<BotType>(this.weavyContext, ["users", this.bot]));
      this.conversationId = null;
    }

    if (!this.botQuery.result?.isPending) {
      this.botUser = this.botQuery.result?.data;
    }

    if (changedProperties.has("link")) {
      if (this.link?.app) {
        if (this.conversationId !== this.link.app.id) {
          //console.log("selecting conversation", this.link.app.id)
          this.selectConversation(this.link.app.id);
        }
      }
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>) {
    super.update(changedProperties);

    if ((changedProperties.has("conversationId") || changedProperties.has("weavyContext")) && this.weavyContext) {
      if (this.conversationId) {
        this.conversationQuery.trackQuery(getConversationOptions(this.weavyContext, this.conversationId));
      } else {
        this.conversationQuery.untrackQuery();
      }
    }
  }

  override render() {
    const { isPending: networkIsPending } = this.weavyContext?.network ?? { isPending: true };
    const { data: conversation, isPending } = this.conversationQuery.result ?? { isPending: networkIsPending };

    return html`
      <div class="wy-messenger-layout">
        <wy-conversation-list
          class="wy-scroll-y"
          .conversationTypes=${this.conversationTypes}
          .bot=${this.bot}
          .avatarUser=${this.botUser}
          .name=${this.name}
          conversationId=${ifDefined(this.conversationId !== null ? this.conversationId : undefined)}
          @conversation-selected=${(e: CustomEvent) => this.selectConversation(e.detail.id)}
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
              <wy-button kind="icon" @click=${() => this.clearConversation()}>
                <wy-icon name="back"></wy-icon>
              </wy-button>
              <wy-badge slot="badge" .bot=${this.bot}></wy-badge>
            </span>
          </wy-conversation-appbar>

          ${cache(
            this.conversationId
              ? !isPending
                ? this.bot
                  ? html` <wy-conversation
                      .conversationId=${this.conversationId}
                      .conversation=${conversation}
                    ></wy-conversation>`
                  : html` <wy-conversation-extended
                      .conversationId=${this.conversationId}
                      .conversation=${conversation}
                    ></wy-conversation-extended>`
                : html` <wy-empty><wy-spinner></wy-spinner></wy-empty> `
              : html` <wy-empty noNetwork>${msg("Select a conversation")}</wy-empty> `
          )}
        </div>
      </div>
    `;
  }
}

export type WyMessengerType = Constructor<WyMessenger>;
