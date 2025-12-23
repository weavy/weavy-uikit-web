import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { localized, msg, str } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { TypingController } from "../controllers/typing-controller";

declare global {
  interface HTMLElementTagNameMap {
    "wy-typing": WyTyping;
  }
}

/**
 * Displays a short "is typing" indicator for a conversation/app.
 *
 * Shows a localized string like "Alice is typing…" or "Alice and Bob are typing…".
 *
 * @slot - Fallback content when there is no typing activity.
 */
@customElement("wy-typing")
@localized()
export class WyTyping extends LitElement {
  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Tracks typing activity for the configured conversation.
   *
   * @internal
   */
  protected typing = new TypingController(this);

  /**
   * Consumed Weavy instance used for locale and presence lookups.
   *
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  /**
   * Identifier of the app whose typing activity should be displayed.
   */
  @property({ attribute: true, type: Number })
  appId?: number;

  /**
   * Current viewer id used to filter typing updates.
   */
  @property({ attribute: true, type: Number })
  userId?: number;

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("appId")) {
      this.typing.appId = this.appId;
    }

    if (changedProperties.has("userId")) {
      this.typing.userId = this.userId;
    }
  }

  override render() {
    const { names, ellipsis } = this.typing;
    let typingText;

    if (names.length === 1) {
      // Single person typing
      const name = names[0];
      typingText = msg(str`${name} is typing${ellipsis}`, { desc: "A is typing..." });
    } else if(names.length > 1) {
      // Multiple typing
      const nameList = new Intl.ListFormat(this.weavy?.locale, { style: "long", type: "conjunction" }).format(
        names
      );
      typingText = msg(str`${nameList} are typing${ellipsis}`, {
        desc: "A, B and C are typing...",
      });
    }

    return typingText ? html`<span>${typingText}</span>` : html`<slot></slot>`;
  }
}
