import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import chatCss from "./scss/all.scss";
import colorModes from "./scss/colormodes.scss";
//import { HistoryController } from './controllers/history-controller'
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import type { FeaturesConfigType, FeaturesListType } from "./types/features.types";
import { ResizeController } from "./controllers/resize-controller";
import { classMap } from "lit/directives/class-map.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";
import { ContextConsumer } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "./client/context-definition";
import {
  RealtimeAppEventType,
  RealtimeConversationDeliveredEventType,
  RealtimeConversationMarkedEventType,
  RealtimeMessageEventType,
  RealtimeReactionEventType,
} from "./types/realtime.types";
import type { ConversationType } from "./types/app.types";
import { QueryController } from "./controllers/query-controller";
import { getApiOptions } from "./data/api";
import type { UserType } from "./types/users.types";

import "./components/wy-empty";
import "./components/wy-conversation-list";
import "./components/wy-conversation";
import "./components/wy-button";
import "./components/wy-icon";
import "./components/wy-badge";
import "./components/wy-spinner";
import { whenParentsDefined } from "./utils/dom";
import { WeavyContextProps } from "./types/weavy.types";

@customElement("wy-messenger")
@localized()
export default class WyMessenger extends LitElement {
  static override styles = [
    colorModes,
    chatCss,
    css`
      :host(wy-messenger) {
        display: flex;
        align-items: stretch;
        position: relative;
        flex: 1;
        min-width: 0;
      }

      wy-conversation-list {
        flex: 0 1 50%;
        min-width: 0;
        max-width: 24rem;
        border-right: 1px solid var(--wy-outline-variant, var(--wy-neutral-variant-80, #c1c7ce));
      }

      wy-conversation {
        flex: 0 1 100%;
        min-width: 50%;
      }

      .wy-close-conversation {
        display: none;
      }

      wy-conversation-list.overlay-mode {
        flex: 0 1 100%;
        min-width: 0;
        max-width: none;
        border-right: none;
      }

      wy-conversation.overlay-mode {
        flex: 0 1 100%;
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        z-index: 1;
      }

      wy-conversation-list[conversationid].overlay-mode {
        display: none;
      }

      wy-conversation:not([data-conversation-id]).overlay-mode {
        display: none;
      }

      .overlay-mode .wy-close-conversation {
        display: unset;
      }

      wy-empty.overlay-mode {
        display: none;
      }
    `,
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContext }, this>;

  // Manually consumed in performUpdate()
  @state()
  protected weavyContext?: WeavyContext;

  @property()
  name?: string;

  @property({ attribute: false })
  user?: UserType;

  @state()
  conversationId: number | null = null;

  @state()
  protected conversation?: ConversationType;

  @property({ type: Object })
  features: FeaturesConfigType = {};

  @state()
  availableFeatures?: FeaturesListType;

  //history = new HistoryController<this>(this, 'messenger', ['conversationId'])
  persistState = new PersistStateController<this>(this, "messenger", ["conversationId"]);
  resizer = new ResizeController(this);

  /**
   * Event: New message created.
   * @event wy:message_created
   */
  realtimeMessageCreatedEvent = (realtimeEvent: RealtimeMessageEventType) =>
    new CustomEvent("wy:message_created", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Message reaction added.
   * @event wy:reaction_added
   */
  realtimeReactionAddedEvent = (realtimeEvent: RealtimeReactionEventType) =>
    new CustomEvent("wy:reaction_added", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Message reaction removed.
   * @event wy:reaction_removed
   */
  realtimeReactionRemovedEvent = (realtimeEvent: RealtimeReactionEventType) =>
    new CustomEvent("wy:reaction_removed", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Conversation app details updated.
   * @event wy:app_updated
   */
  realtimeAppUpdatedEvent = (realtimeEvent: RealtimeAppEventType) =>
    new CustomEvent("wy:app_updated", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Message seen-by status updated.
   * @event wy:conversation_marked
   */
  realtimeConversationMarkedEvent = (realtimeEvent: RealtimeConversationMarkedEventType) =>
    new CustomEvent("wy:conversation_marked", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Message delivered status updated.
   * @event wy:conversation_delivered
   */
  realtimeConversationDeliveredEvent = (realtimeEvent: RealtimeConversationDeliveredEventType) =>
    new CustomEvent("wy:conversation_delivered", { bubbles: true, composed: false, detail: realtimeEvent });

  handleRealtimeMessageCreatedEvent = (realtimeEvent: RealtimeMessageEventType) => {
    this.dispatchEvent(this.realtimeMessageCreatedEvent(realtimeEvent));
  };

  handleRealtimeConversationMarkedEvent = (realtimeEvent: RealtimeConversationMarkedEventType) => {
    this.dispatchEvent(this.realtimeConversationMarkedEvent(realtimeEvent));
  };

  protected conversationQuery = new QueryController<ConversationType>(this);

  protected selectConversation(id: number) {
    this.conversationId = id;
  }

  protected clearConversation() {
    this.conversationId = null;
  }

  constructor() {
    super();
    new ThemeController(this, WyMessenger.styles);
  }

  override async performUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.performUpdate();
  }

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.weavyContext.subscribe(null, "message_created", this.handleRealtimeMessageCreatedEvent);
      this.weavyContext.subscribe(null, "conversation_marked", this.handleRealtimeConversationMarkedEvent);
    }

    if ((changedProperties.has("conversationId") || changedProperties.has("weavyContext")) && this.weavyContext) {
      if (this.conversationId) {
        this.conversationQuery.trackQuery(
          getApiOptions<ConversationType>(this.weavyContext, ["conversations", this.conversationId])
        );
      } else {
        this.conversationQuery.untrackQuery();
      }
    }
  }

  override render() {
    const overlayModeClasses = this.resizer.conditions;
    const { isPending: networkIsPending } = this.weavyContext?.network ?? { isPending: true };
    const { data: conversation, isPending } = this.conversationQuery.result ?? { isPending: networkIsPending };

    return html`
      <wy-conversation-list
        class="wy-scroll-y ${classMap(overlayModeClasses)}"
        name=${ifDefined(this.name)}
        conversationId=${ifDefined(this.conversationId !== null ? this.conversationId : undefined)}
        @conversation-selected=${(e: CustomEvent) => this.selectConversation(e.detail.id)}
      ></wy-conversation-list>
      ${this.conversationId
        ? !isPending && conversation
          ? html` <wy-conversation
              class=${classMap(overlayModeClasses)}
              data-conversation-id=${ifDefined(this.conversationId !== null ? this.conversationId : undefined)}
              .conversation=${conversation}
              .availableFeatures=${this.availableFeatures}
              .features=${this.features}
              @wy:app_updated=${(e: CustomEvent<RealtimeAppEventType>) =>
                this.dispatchEvent(this.realtimeAppUpdatedEvent(e.detail))}
              @wy:conversation_delivered=${(e: CustomEvent<RealtimeConversationDeliveredEventType>) =>
                this.dispatchEvent(this.realtimeConversationDeliveredEvent(e.detail))}
              @wy:reaction_added=${(e: CustomEvent<RealtimeReactionEventType>) =>
                this.dispatchEvent(this.realtimeReactionAddedEvent(e.detail))}
              @wy:reaction_removed=${(e: CustomEvent<RealtimeReactionEventType>) =>
                this.dispatchEvent(this.realtimeReactionRemovedEvent(e.detail))}
            >
              <span slot="action" class="wy-close-conversation">
                <wy-button kind="icon" @click=${() => this.clearConversation()}>
                  <wy-icon name="back"></wy-icon>
                </wy-button>
                <wy-badge slot="badge"></wy-badge>
              </span>
            </wy-conversation>`
          : html` <wy-empty class=${classMap(overlayModeClasses)}><wy-spinner overlay></wy-spinner></wy-empty> `
        : html` <wy-empty class=${classMap(overlayModeClasses)} noNetwork>${msg("Select a conversation")}</wy-empty> `}
    `;
  }

  override firstUpdated() {
    if (this.parentElement) {
      this.resizer.observe({
        name: "overlay-mode",
        target: this,
        condition: (entry) => entry.contentRect.width <= 768,
      });
    }
  }

  override disconnectedCallback(): void {
    if (this.weavyContext) {
      // realtime
      this.weavyContext.unsubscribe(null, "message_created", this.handleRealtimeMessageCreatedEvent);
      this.weavyContext.unsubscribe(null, "conversation_marked", this.handleRealtimeConversationMarkedEvent);
    }
    super.disconnectedCallback();
  }
}
