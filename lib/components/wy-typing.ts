import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import { localized, msg, str } from "@lit/localize";
import { WeavyContextProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { TypingController } from "../controllers/typing-controller";

@customElement("wy-typing")
@localized()
export default class WyTyping extends LitElement {
  protected exportParts = new ShadowPartsController(this);
  protected typing = new TypingController(this);

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property({ attribute: true, type: Number })
  appId?: number;

  @property({ attribute: true, type: Number })
  userId?: number;

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>): void {
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
      const nameList = new Intl.ListFormat(this.weavyContext?.locale, { style: "long", type: "conjunction" }).format(
        names
      );
      typingText = msg(str`${nameList} are typing${ellipsis}`, {
        desc: "A, B and C are typing...",
      });
    }

    return typingText ? html`<span>${typingText}</span>` : html`<slot></slot>`;
  }
}
