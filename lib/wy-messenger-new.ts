import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyTypeComponent } from "./classes/weavy-type-component";
import { CreateConversationController } from "./controllers/create-conversation-controller";
import { CreateConversationEventType } from "./types/conversation.events";
import { createRef, ref } from "lit/directives/ref.js";
import { MemberIdType } from "./types/members.types";

import colorModesCss from "./scss/color-modes.scss";
import hostContentsCss from "./scss/host-contents.scss";
import hostFontCss from "./scss/host-font.scss";

import { WyConversationNew } from "./components/wy-conversation-new";
import type { OverlayAppearanceType } from "./types/ui.types";
import { property } from "lit/decorators.js";

declare global {
  interface HTMLElementTagNameMap {
    "wy-messenger-new": WyMessengerNew;
  }
}
/**
 * @import { WyActionEventType } from "./types/action.events"
 */


/**
 * Weavy messenger component to render a create conversation button with dialogs.
 *
 * When a conversation is created, the component fires a `"wy-action"` event with the action type `"select"` and details about the conversation.
 *
 * ** Component layout **
 *
 * The button is displayed as a clickable icon that acts as a button. The default size of the button is the icon size `1.5rem`/`24px` together with the set `--wy-padding` (which defaults to `0.5rem`/`8px`) on every side of the icon, which makes a total of `2.5rem`/`40px` per default.
 *
 * The select member dialog renders in a modal overlay centered in the [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer). That means that the dialog does not occupy any visual layout space where it's placed in the DOM, it only renders in the top layer.
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
 * 
 * **Used sub components:**
 *
 * - [`<wy-conversation-new>`](./components/wy-conversation-new.ts)
 *
 * @tagname wy-messenger-new
 * @fires {WyActionEventType} wy-action - Emitted when a conversation app is created and should be selected.
 * @example <caption>Inline new conversation button in a text</caption>
 * Display an icon button that opens a dialog to select users for a new conversation.
 *
 * ```html
 * <div>Create conversation <wy-messenger-new></wy-messenger-new></div>
 * ```
 */
@customElement("wy-messenger-new")
export class WyMessengerNew extends WeavyTypeComponent {
  static override styles = [colorModesCss, hostContentsCss, hostFontCss];

  /** @internal */
  protected theme = new ThemeController(this, WyMessengerNew.styles);

  /** 
   * Disabled link matching/consuming.
   * @internal 
   */
  override matchesLink(): boolean {
    return false;
  }

  /** @internal */
  protected createConversationController: CreateConversationController = new CreateConversationController(this);

  /** @internal */
  private conversationNewRef = createRef<WyConversationNew>();

  /**
   * Overlay appearance used for the create conversation dialog.
   *
   * @type {"modal" | "sheet" | "drawer" | "full" | "none"}
   * @default "modal"
   */
  @property({ type: String })
  overlay: OverlayAppearanceType = "modal";
  
  /**
   * Creates a new conversation.
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

  override render() {
    return html`
      <wy-conversation-new
        .overlay=${this.overlay}
        @create=${async (e: CreateConversationEventType) => {
          await this.createConversationController.create(e.detail.members);
        }}
        ${ref(this.conversationNewRef)}
      ></wy-conversation-new>
    `;
  }
}
