import { LitElement, html, type PropertyValues, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
//import { HistoryController } from './controllers/history-controller'
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";

import {
  RealtimeAppEventType,
  RealtimeConversationDeliveredEventType,
  RealtimeConversationMarkedEventType,
  RealtimeMemberEventType,
  RealtimeMessageEventType,
} from "./types/realtime.types";
import { AppType, AppTypes } from "./types/app.types";
import { ConversationTypeGuid, type ConversationType } from "./types/conversations.types";
import { QueryController } from "./controllers/query-controller";
import { getApi, getApiOptions } from "./data/api";
import type { BotType } from "./types/users.types";
import { InfiniteData } from "@tanstack/query-core";
import { ConversationsResultType } from "./types/conversations.types";
import { cache } from "lit/directives/cache.js";
import { AppProviderMixin } from "./mixins/app-mixin";
import { Constructor } from "./types/generic.types";

import messengerCss from "./scss/all";
import colorModes from "./scss/colormodes";

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
export class WyMessenger extends AppProviderMixin(LitElement) {
  static override styles = [
    colorModes,
    messengerCss,
  ];

  override appType = AppTypes.Messenger;

  @property()
  name?: string;

  @property()
  bot?: string;

  @state()
  types: ConversationTypeGuid[] = [ConversationTypeGuid.ChatRoom, ConversationTypeGuid.PrivateChat];

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

  @state()
  hasEventListener: { [key: string]: boolean } = {
    "wy:message_created": false,
    "wy:app_created": false,
    "wy:conversation_marked": false,
    "wy:conversation_delivered": false,
    "wy:member_added": false,
  };

  /**
   * @ignore
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override addEventListener(type: any, listener: any, options?: any): void {
    // Check if any event is listened to

    if (this.hasEventListener) {
      const propertyName = type as keyof typeof this.hasEventListener;
      if (Object.prototype.hasOwnProperty.call(this.hasEventListener, propertyName)) {
        //console.log(`Setting ${propertyName} to true`)
        this.hasEventListener = {
          ...this.hasEventListener,
          [propertyName]: true,
        };
      }
    }
    super.addEventListener(type, listener, options);
  }

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  protected releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  /**
   * Event: New message created.
   * @event wy:message_created
   */
  protected realtimeMessageCreatedEvent = async (realtimeEvent: RealtimeMessageEventType) => {
    if (await this.conversationBelongsToMessenger(realtimeEvent.message.app.id)) {
      this.dispatchEvent(
        new CustomEvent("wy:message_created", { bubbles: true, composed: false, detail: realtimeEvent })
      );
    }
  };

  /**
   * Event: Conversation added.
   * @event wy:app_created
   */
  protected realtimeAppCreatedEvent = async (realtimeEvent: RealtimeAppEventType) => {
    if (await this.conversationBelongsToMessenger(realtimeEvent.app)) {
      this.dispatchEvent(new CustomEvent("wy:app_created", { bubbles: true, composed: false, detail: realtimeEvent }));
    }
  };

  /**
   * Event: Message seen-by status updated.
   * @event wy:conversation_marked
   */
  protected realtimeConversationMarkedEvent = async (realtimeEvent: RealtimeConversationMarkedEventType) => {
    if (await this.conversationBelongsToMessenger(realtimeEvent.conversation)) {
      this.dispatchEvent(
        new CustomEvent("wy:conversation_marked", { bubbles: true, composed: false, detail: realtimeEvent })
      );
    }
  };

  /**
   * Event: Message delivered status updated.
   * @event wy:conversation_delivered
   */
  protected realtimeConversationDeliveredEvent = async (realtimeEvent: RealtimeConversationDeliveredEventType) => {
    if (await this.conversationBelongsToMessenger(realtimeEvent.conversation)) {
      this.dispatchEvent(
        new CustomEvent("wy:conversation_delivered", { bubbles: true, composed: false, detail: realtimeEvent })
      );
    }
  };

  /**
   * Event: A member is added to a conversation app.
   * @event wy:member_added
   */
  protected realtimeMemberAddedEvent = async (realtimeEvent: RealtimeMemberEventType) => {
    if (await this.conversationBelongsToMessenger(realtimeEvent.app)) {
      this.dispatchEvent(new CustomEvent("wy:member_added", { bubbles: true, composed: false, detail: realtimeEvent }));
    }
  };

  /**
   * Checks if a conversation belongs to Messenger.
   *
   * @param conversation {AppType | number} - The conversation or id to check if it belongs to Messenger.
   * @returns Promise<Boolean>
   */
  async conversationBelongsToMessenger(conversation: AppType | number): Promise<Boolean> {
    if (!this.weavyContext) {
      return false;
    }

    let checkConversation: AppType;

    if (typeof conversation === "number") {
      checkConversation = await getApi<ConversationType>(
        this.weavyContext,
        ["conversations", conversation],
        undefined,
        {
          initialData: () => {
            // Use any data from the conversation-list query as the initial data for the conversation query
            return this.weavyContext?.queryClient
              .getQueryData<InfiniteData<ConversationsResultType>>(["conversations"])
              ?.pages.flatMap((cPage) => cPage.data)
              .find((c) => c?.id === conversation);
          },
        }
      );
    } else if (typeof conversation.type === "string") {
      checkConversation = conversation as ConversationType;
    } else {
      return false;
    }

    return (
      checkConversation.type === ConversationTypeGuid.ChatRoom ||
      checkConversation.type === ConversationTypeGuid.PrivateChat ||
      checkConversation.type === ConversationTypeGuid.BotChat
    );
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
      this.types = [ConversationTypeGuid.BotChat];
      this.botQuery.trackQuery(getApiOptions<BotType>(this.weavyContext, ["users", this.bot]));
      this.conversationId = null;
    }

    if (!this.botQuery.result?.isPending) {
      this.botUser = this.botQuery.result?.data;
    }

    if (
      (changedProperties.has("weavyContext") ||
        changedProperties.has("hasEventListener") ||
        changedProperties.has("user")) &&
      this.weavyContext &&
      this.user
    ) {
      this.weavyContext.unsubscribe(null, "message_created", this.realtimeMessageCreatedEvent);
      this.weavyContext.unsubscribe(null, "conversation_marked", this.realtimeConversationMarkedEvent);
      this.weavyContext.unsubscribe(null, "conversation_delivered", this.realtimeConversationDeliveredEvent);
      this.weavyContext.unsubscribe(null, "app_created", this.realtimeAppCreatedEvent);
      this.weavyContext.unsubscribe(null, "member_added", this.realtimeMemberAddedEvent);

      if (this.hasEventListener["wy:message_created"]) {
        this.weavyContext.subscribe(null, "message_created", this.realtimeMessageCreatedEvent);
      }

      if (this.hasEventListener["wy:conversation_marked"]) {
        this.weavyContext.subscribe(null, "conversation_marked", this.realtimeConversationMarkedEvent);
      }

      if (this.hasEventListener["wy:conversation_delivered"]) {
        this.weavyContext.subscribe(null, "conversation_delivered", this.realtimeConversationDeliveredEvent);
      }

      if (this.hasEventListener["wy:app_created"]) {
        this.weavyContext.subscribe(null, "app_created", this.realtimeAppCreatedEvent);
      }

      if (this.hasEventListener["wy:member_added"]) {
        this.weavyContext.subscribe(null, "member_added", this.realtimeMemberAddedEvent);
      }
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>) {
      super.update(changedProperties);

      if ((changedProperties.has("conversationId") || changedProperties.has("weavyContext")) && this.weavyContext) {
        if (this.conversationId) {
          this.conversationQuery.trackQuery(
            getApiOptions<ConversationType>(this.weavyContext, ["conversations", this.conversationId], undefined, {
              initialData: () => {
                // Use any data from the conversation-list query as the initial data for the conversation query
                return this.weavyContext?.queryClient
                  .getQueryData<InfiniteData<ConversationsResultType>>(["conversations"])
                  ?.pages.flatMap((cPage) => cPage.data)
                  .find((c) => c?.id === this.conversationId);
              },
            })
          );
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
          .types=${this.types}
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
              : html`
                  <wy-empty noNetwork>${msg("Select a conversation")}</wy-empty>
                `
          )}
        </div>
      </div>
    `;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext) {
      // realtime
      this.weavyContext.unsubscribe(null, "message_created", this.realtimeMessageCreatedEvent);
      this.weavyContext.unsubscribe(null, "conversation_marked", this.realtimeConversationMarkedEvent);
      this.weavyContext.unsubscribe(null, "conversation_delivered", this.realtimeConversationDeliveredEvent);
      this.weavyContext.unsubscribe(null, "app_created", this.realtimeAppCreatedEvent);
      this.weavyContext.unsubscribe(null, "member_added", this.realtimeMemberAddedEvent);
    }

    super.disconnectedCallback();
  }
}

export type WyMessengerType = Constructor<WyMessenger>;