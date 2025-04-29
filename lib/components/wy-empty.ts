import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { localized, msg } from "@lit/localize";
import { WeavyProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./base/wy-icon";
import "./base/wy-spinner";

@customElement("wy-empty")
@localized()
export default class WyEmpty extends LitElement {
  static override styles = [
    chatCss,
    hostContentsCss,
  ];
  
  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  @property({ type: Boolean })
  noNetwork: boolean = false;

  protected handleUpdate = () => this.requestUpdate();

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("weavy")) {
      const lastContext = changedProperties.get("weavy") as WeavyType | undefined;
      if (lastContext && lastContext !== this.weavy) {
        lastContext.removeNetworkListener(this.handleUpdate);
      }
      if (this.weavy && lastContext !== this.weavy) {
        this.weavy.addNetworkListener(this.handleUpdate);
      }
    }
  }

  override render() {
    return html`
      <div class="wy-empty">
        ${this.weavy && !this.noNetwork && this.weavy?.network.state === "unreachable"
          ? html`
              <wy-icon-display>
                <wy-icon name="server-network-off"></wy-icon>
                <span slot="text">${msg("The server is offline, try again in a few minutes...")}</span>
                <wy-spinner slot="meta" ?hidden=${!this.weavy?.network.isPending}></wy-spinner>
              </wy-icon-display>
            `
          : !this.noNetwork && this.weavy?.network.state === "offline"
          ? html`
              <wy-icon-display>
                <wy-icon name="wifi-off"></wy-icon>
                <span slot="text">${msg("You are currently offline.")}</span>
                <wy-spinner slot="meta" ?hidden=${!this.weavy?.network.isPending}></wy-spinner>
              </wy-icon-display>
            `
          : html`
              <slot>
                <wy-icon-display>
                  <wy-icon name="information"></wy-icon>
                  <slot slot="text" name="title">
                    <span>${msg("Nothing to see here yet.")}</span>
                  </slot>
                </wy-icon-display>
              </slot>
            `}
      </div>
    `;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.weavy?.addNetworkListener(this.handleUpdate);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.weavy?.removeNetworkListener(this.handleUpdate);
  }
}
