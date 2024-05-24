import { LitElement, html, css, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import chatCss from "../scss/all";
import { localized, msg } from "@lit/localize";
import { WeavyContextProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-icon";
import "./wy-spinner";

@customElement("wy-empty")
@localized()
export default class WyEmpty extends LitElement {
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];
  
  protected exportParts = new ShadowPartsController(this);

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property({ type: Boolean })
  noNetwork: boolean = false;

  protected handleUpdate = () => this.requestUpdate();

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext")) {
      const lastContext = changedProperties.get("weavyContext") as WeavyContextType | undefined;
      if (lastContext && lastContext !== this.weavyContext) {
        lastContext.removeNetworkListener(this.handleUpdate);
      }
      if (this.weavyContext && lastContext !== this.weavyContext) {
        this.weavyContext.addNetworkListener(this.handleUpdate);
      }
    }
  }

  override render() {
    return html`
      <div class="wy-empty">
        ${this.weavyContext && !this.noNetwork && this.weavyContext?.network.state === "unreachable"
          ? html`
              <wy-icon-display>
                <wy-icon name="server-network-off"></wy-icon>
                <span slot="text">${msg("The server is offline, try again in a few minutes...")}</span>
                <wy-spinner slot="meta" ?hidden=${!this.weavyContext?.network.isPending}></wy-spinner>
              </wy-icon-display>
            `
          : !this.noNetwork && this.weavyContext?.network.state === "offline"
          ? html`
              <wy-icon-display>
                <wy-icon name="wifi-off"></wy-icon>
                <span slot="text">${msg("You are currently offline.")}</span>
                <wy-spinner slot="meta" ?hidden=${!this.weavyContext?.network.isPending}></wy-spinner>
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
    this.weavyContext?.addNetworkListener(this.handleUpdate);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.weavyContext?.removeNetworkListener(this.handleUpdate);
  }
}
