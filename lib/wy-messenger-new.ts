import { html, type PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyTypeComponent } from "./classes/weavy-type-component";
import { CreateConversationController, CreateConversationProps } from "./controllers/create-conversation-controller";
import { CreateConversationEventType } from "./types/conversation.events";
import { createRef, ref } from "lit/directives/ref.js";
import { MemberIdType } from "./types/members.types";

import messengerCss from "./scss/components/messenger.scss";
import scrollCss from "./scss/scroll.scss";
import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostFontCss from "./scss/host-font.scss";

import { WyConversationNew } from "./components/wy-conversation-new";

declare global {
  interface HTMLElementTagNameMap {
    "wy-messenger-new": WyMessengerNew;
  }
}

/**
 * Weavy messenger component to render a create conversation button with dialogs.
 *
 * **Used sub components:**
 *
 * - [`<wy-conversation-new>`](./components/wy-conversation-new.ts)
 *
 * @tagname wy-messenger-new
 * @fires {WyActionEventType} wy-action - Emitted when a conversation app is created and should be selected.
 */
@customElement("wy-messenger-new")
export class WyMessengerNew extends WeavyTypeComponent implements CreateConversationProps {
  static override styles = [colorModesCss, scrollCss, messengerCss, hostBlockCss, hostFontCss];

  /** @internal */
  protected theme = new ThemeController(this, WyMessengerNew.styles);

  /** @internal */
  protected createConversationController: CreateConversationController = new CreateConversationController(this);

  /** @internal */
  private conversationNewRef = createRef<WyConversationNew>();

  /**
   * Creates a new conversation.
   *
   * When in agent mode, the conversation is created instantly.
   *
   * @param members - Optional array of member ids or member uids.
   */
  async createConversation(members?: MemberIdType[]) {
    return await this.createConversationController.create(members);
  }

  /**
   * Opens the select-member dialog.
   *
   * @returns Promise resolving to the selected member ids or uids.
   */
  async selectMembers() {
    return await this.conversationNewRef.value?.selectMembers();
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (changedProperties.has("agent")) {
      this.createConversationController.agent = this.agent;
    }
  }

  override render() {
    return html`
      <wy-conversation-new
        .agent=${this.agent}
        @create=${async (e: CreateConversationEventType) => {
          await this.createConversationController.create(e.detail.members);
        }}
        ${ref(this.conversationNewRef)}
      ></wy-conversation-new>
    `;
  }
}
