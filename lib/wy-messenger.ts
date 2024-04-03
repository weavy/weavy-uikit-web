import { LitElement, html, css, type PropertyValues, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
//import { HistoryController } from './controllers/history-controller'
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import type { FeaturesConfigType, FeaturesListType } from "./types/features.types";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";
import { ContextConsumer } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "./client/context-definition";
import {
  RealtimeAppEventType,
  RealtimeConversationDeliveredEventType,
  RealtimeConversationMarkedEventType,
  RealtimeMemberEventType,
  RealtimeMessageEventType,
} from "./types/realtime.types";
import { AppType, EntityTypes } from "./types/app.types";
import { ConversationTypeGuid, type ConversationType } from "./types/conversations.types";
import { QueryController } from "./controllers/query-controller";
import { getApi, getApiOptions } from "./data/api";
import type { BotType, UserType } from "./types/users.types";
import { whenParentsDefined } from "./utils/dom";
import { WeavyContextProps } from "./types/weavy.types";
import { InfiniteData } from "@tanstack/query-core";
import { ConversationsResultType } from "./types/conversations.types";
import { cache } from "lit/directives/cache.js";

import chatCss from "./scss/all";
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
export class WyMessenger extends LitElement {
  static override styles = [
    colorModes,
    chatCss,
    css`
      :host(wy-messenger) {
        display: flex;
        align-items: stretch;
        position: relative;
        flex: 1;
        min-width: 16rem;
        container-type: inline-size;
      }

      wy-conversation-list {
        flex: 0 1 50%;
        min-width: 0;
        max-width: 24rem;
        border-right: 1px solid var(--wy-outline-variant, var(--wy-neutral-variant-80, #c1c7ce));
      }

      .wy-messenger-conversation {
        flex: 0 1 100%;
        min-width: max(50%, 16rem);
        min-height: min-content;
        display: flex;
        flex-direction: column;
      }

      .wy-close-conversation {
        display: none;
      }

      @container (max-width: 768px) {
        wy-conversation-list {
          flex: 0 1 100%;
          min-width: 0;
          max-width: none;
          border-right: none;
        }
  
        wy-conversation-list[conversationid] {
          display: none;
        }
  
        .wy-messenger-conversation[data-conversation-id=""] {
          display: none;
        }
  
        .wy-close-conversation {
          display: unset;
        }
  
        wy-empty {
          display: none;
        }
      }
    `,
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContextType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  protected weavyContext?: WeavyContextType;

  @property()
  name?: string;

  @property()
  bot?: string;

  @state()
  types: ConversationTypeGuid[] = [ConversationTypeGuid.ChatRoom, ConversationTypeGuid.PrivateChat];

  @state()
  botUser?: BotType;

  @state()
  user?: UserType;

  @state()
  conversationId: number | null = null;

  @state()
  protected conversation?: ConversationType;

  @property({ type: Object })
  features: FeaturesConfigType = {};

  @state()
  availableFeatures?: FeaturesListType;

  protected conversationQuery = new QueryController<ConversationType>(this);
  protected userQuery = new QueryController<UserType>(this);
  protected featuresQuery = new QueryController<FeaturesListType>(this);

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

    const propertyName = type as keyof typeof this.hasEventListener;
    if (Object.prototype.hasOwnProperty.call(this.hasEventListener, propertyName)) {
      //console.log(`Setting ${propertyName} to true`)
      this.hasEventListener = {
        ...this.hasEventListener,
        [propertyName]: true,
      };
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
    if (
      realtimeEvent.message.parent?.type === EntityTypes.App &&
      (await this.conversationBelongsToMessenger(realtimeEvent.message.app_id))
    ) {
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
              .find((c) => c.id === conversation);
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

  protected override async scheduleUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.scheduleUpdate();
  }

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));
      this.featuresQuery.trackQuery(getApiOptions<FeaturesListType>(this.weavyContext, ["features", "messenger"]));
    }

    if (!this.userQuery.result?.isPending) {
      this.user = this.userQuery.result?.data;
    }

    if (!this.featuresQuery.result?.isPending) {
      this.availableFeatures = this.featuresQuery.result?.data;
    }

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

  protected override update(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
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
                  .find((c) => c.id === this.conversationId);
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
          .user=${this.user}
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
                    .availableFeatures=${this.availableFeatures}
                    .features=${this.features}
                  ></wy-conversation>`
                : html` <wy-conversation-extended
                    .conversationId=${this.conversationId}
                    .conversation=${conversation}
                    .availableFeatures=${this.availableFeatures}
                    .features=${this.features}
                  ></wy-conversation-extended>`
              : html` <wy-empty><wy-spinner></wy-spinner></wy-empty> `
            : html`
                <wy-empty noNetwork>${msg("Select a conversation")}</wy-empty>
              `
        )}
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
