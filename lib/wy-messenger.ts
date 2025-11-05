import { html, nothing, type PropertyValues } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";
import { type AppRef, type AppType, AppTypeGuid, AppTypeString } from "./types/app.types";
import { QueryController } from "./controllers/query-controller";
import { WeavyComponent } from "./classes/weavy-component";
import { getConversationOptions, resolveAppWithType } from "./data/conversation";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import type { ComponentFeaturePolicyConfig } from "./types/features.types";
import type { SelectedEventType } from "./types/app.events";
import { createRef, ref } from "lit/directives/ref.js";

import allStyles from "./scss/all.scss";
import messengerStyles from "./scss/components/messenger.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostFontStyles from "./scss/host-font.scss";

import "./components/wy-empty";
import "./components/wy-conversation-appbar";
import WyConversationList from "./components/wy-conversation-list";
import "./components/wy-conversation";
import "./components/base/wy-button";
import "./components/base/wy-icon";
import "./components/wy-messenger-badge";
import "./components/base/wy-spinner";
import "./components/wy-context-data";
import WyConversationNew from "./components/wy-conversation-new";

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
 * The conversation app type strings and app type guids specific for agents in Messenger.
 */
export const MessengerAgentTypes = new Map(
  Object.entries({
    [AppTypeString.AgentChat]: AppTypeGuid.AgentChat,
    [AppTypeGuid.AgentChat]: AppTypeString.AgentChat,
  })
);

export const WY_MESSENGER_TAGNAME = "wy-messenger";

declare global {
  interface HTMLElementTagNameMap {
    [WY_MESSENGER_TAGNAME]: WyMessenger;
  }
}

const DefaultMessengerFeatures: ComponentFeaturePolicyConfig = {
  // All available features as enabled/disabled by default
  [Feature.Attachments]: true,
  [Feature.CloudFiles]: true,
  [Feature.ContextData]: true,
  [Feature.Embeds]: true,
  [Feature.GoogleMeet]: true,
  [Feature.Meetings]: true,
  [Feature.Mentions]: true,
  [Feature.MicrosoftTeams]: true,
  [Feature.Polls]: true,
  [Feature.Previews]: true,
  [Feature.Reactions]: true,
  [Feature.Receipts]: true,
  [Feature.Typing]: true,
  [Feature.ZoomMeetings]: true,
};

const DefaultMessengerAgentFeatures: ComponentFeaturePolicyConfig = {
  // All available features as enabled/disabled by default
  [Feature.Attachments]: true,
  [Feature.ContextData]: true,
  [Feature.Embeds]: true,
  [Feature.Previews]: true,
  [Feature.Reactions]: false,
  [Feature.Receipts]: true,
  [Feature.Typing]: true,
};

/**
 * Weavy messenger component to render multiple one-to-one conversations, group chats or agent conversations.
 *
 * @element wy-messenger
 * @class WyMessenger
 * @extends {WeavyComponent}
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 *
 * @slot actions - Buttons placed in the top right of the conversation list.
 * @slot conversation-new - The button for creating a new conversation. Replaces the button.
 */
@customElement(WY_MESSENGER_TAGNAME)
@localized()
export class WyMessenger extends WeavyComponent {
  static override styles = [colorModesStyles, allStyles, messengerStyles, hostBlockStyles, hostFontStyles];

  override componentFeatures = new ComponentFeatures(DefaultMessengerFeatures);

  protected theme = new ThemeController(this, WyMessenger.styles);

  @state()
  override appTypes: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  @property({ type: String })
  override get agent() {
    return super.agent;
  }
  override set agent(agent: string | undefined) {
    super.agent = agent;
    if (this._agentUid) {
      this.appTypes = [AppTypeGuid.AgentChat];
      this.componentFeatures = new ComponentFeatures(
        DefaultMessengerAgentFeatures,
        this.componentFeatures.allowedFeatures()
      );
    } else {
      this.appTypes = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];
      this.componentFeatures = new ComponentFeatures(
        DefaultMessengerFeatures,
        this.componentFeatures.allowedFeatures()
      );
    }
    this.conversationId = null;
  }

  /**
   * Placeholder text for the message editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  @property({ type: Number })
  conversationId?: number | null = null;

  protected conversationQuery = new QueryController<AppType>(this);
  protected persistState = new PersistStateController(this);

  private conversationNewRef = createRef<WyConversationNew>();
  private conversationListRef = createRef<WyConversationList>();
  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  protected releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  /**
   * Checks if a conversation belongs to Messenger.
   *
   * @deprecated
   * @param conversation {AppRef | AppType | number} - The conversation or id to check if it belongs to Messenger.
   * @returns Promise<Boolean>
   */
  async conversationBelongsToMessenger(conversation: AppRef | AppType | number): Promise<boolean> {
    console.warn("conversationBelongsToMessenger() is deprecated. Compare app to to .appTypes instead.");

    if (!this.weavy) {
      return false;
    }

    return Boolean(await resolveAppWithType(this.weavy, conversation, this.appTypes, this.agent));
  }

  /**
   * Creates a new conversation.
   *
   * - When no members are specified, the user selector is shown.
   * - When in agent mode, a conversation is created instantly.
   *
   * @param members {(number|string)[] | undefined} - Optional array of member id or member uid to bypass user selection dialog.
   */
  async createConversation(members?: (number | string)[]) {
    await this.conversationNewRef.value?.create(members);
  }

  /**
   * Set the active conversation.
   *
   * @deprecated
   * @param id {number} - The id of the conversation to select.
   */
  selectConversation(id: number) {
    console.warn("selectConversation() is deprecated. Set .conversationId instead.");
    this.conversationId = id;
    return true;
  }

  /**
   * Deselects any active conversation.
   * @deprecated
   */
  clearConversation() {
    console.warn("clearConversation() is deprecated. Set .conversationId to null instead.");
    this.conversationId = null;
  }

  protected override async willUpdate(changedProperties: PropertyValues<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("agent") || changedProperties.has("user")) &&
      this.weavy &&
      this.user
    ) {
      this.persistState.observe(
        [{ name: "conversationId", override: false }],
        this.agent || "messenger",
        `u${this.user?.id}`
      );
    }

    if (changedProperties.has("link") && this.link?.app) {
      this.conversationId = this.link.app.id;
    }

    if ((changedProperties.has("conversationId") || changedProperties.has("weavy")) && this.weavy) {
      if (this.conversationId) {
        void this.conversationQuery.trackQuery(getConversationOptions(this.weavy, this.conversationId, this.appTypes));
      } else {
        this.conversationQuery.untrackQuery();
      }
    }
  }

  override render() {
    const { isPending: networkIsPending } = this.weavy?.network ?? { isPending: true };
    const { data: conversation } = this.conversationQuery.result ?? { isPending: networkIsPending };

    const conversationListLength = this.conversationListRef.value?.conversationsQuery.result.data?.pages[0].count || 0;

    return html`
      <div class="wy-messenger-layout">
        <wy-conversation-list
          ${ref(this.conversationListRef)}
          .conversationTypes=${this.appTypes}
          .agent=${this.agent}
          conversationId=${ifDefined(this.conversationId !== null ? this.conversationId : undefined)}
          @selected=${(e: SelectedEventType) => (this.conversationId = e.detail.id)}
        >
          <wy-conversation-new
            slot="actions"
            .agent=${this.agent}
            @selected=${(e: SelectedEventType) => (this.conversationId = e.detail.id)}
            ${ref(this.conversationNewRef)}
          >
            <slot name="conversation-new"></slot>
          </wy-conversation-new>
          <slot name="actions" slot="actions"></slot>
        </wy-conversation-list>

        <div
          class="wy-messenger-conversation wy-scroll-y"
          data-conversation-id=${this.conversationId !== null ? this.conversationId : ""}
        >
          <wy-conversation-appbar
            .conversationId=${this.conversationId || undefined}
            .conversation=${conversation}
            @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}
            @selected=${(e: SelectedEventType) => (this.conversationId = e.detail.id)}
            ?hidden=${Boolean(!this.conversationId)}
          >
            <span slot="action" class="wy-close-conversation">
              <wy-button kind="icon" @click=${() => (this.conversationId = null)}>
                <wy-icon name="back"></wy-icon>
              </wy-button>
              <wy-messenger-badge slot="badge" .agent=${this.agent}></wy-messenger-badge>
            </span>
          </wy-conversation-appbar>

          ${this.conversationId
            ? html`<wy-conversation
                .conversationId=${this.conversationId}
                .conversation=${conversation}
                .placeholder=${this.placeholder ?? (this.agent ? msg("Ask anything...") : undefined)}
                .header=${!this.agent}
              ></wy-conversation>`
            : conversationListLength
            ? html`<wy-empty noNetwork>${msg("Select a conversation")}</wy-empty>`
            : nothing}
        </div>

        <wy-context-data-progress></wy-context-data-progress>
      </div>
    `;
  }
}
