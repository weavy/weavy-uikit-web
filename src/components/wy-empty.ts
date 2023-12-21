import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import chatCss from "../scss/all.scss";
import { localized, msg } from "@lit/localize";

import "./wy-icon";
import "./wy-spinner";
import { WeavyContextProps } from "../types/weavy.types";

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

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ type: Boolean })
  noNetwork: boolean = false;

  protected handleUpdate = () => this.requestUpdate();

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext")) {
      const lastContext = changedProperties.get("weavyContext") as WeavyContext | undefined;
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
              <div class="wy-content-icon">
                <div class="wy-content-icon">
                  <wy-icon name="server-network-off"></wy-icon>
                </div>
                <div class="wy-content-name">
                  <span>${msg("The server is offline, try again in a few minutes...")}</span>
                </div>
                <div class="wy-content-meta">
                  <wy-spinner ?hidden=${!this.weavyContext?.network.isPending}></wy-spinner>
                </div>
              </div>
            `
          : !this.noNetwork && this.weavyContext?.network.state === "offline"
          ? html`
              <div class="wy-content-icon">
                <div class="wy-content-icon">
                  <wy-icon name="wifi-off"></wy-icon>
                </div>
                <div class="wy-content-name">
                  <span>${msg("You are currently offline.")}</span>
                </div>
                <div class="wy-content-meta">
                  <wy-spinner ?hidden=${!this.weavyContext?.network.isPending}></wy-spinner>
                </div>
              </div>
            `
          : html`
              <slot>
                <div class="wy-content-icon">
                  <div class="wy-content-icon">
                    <wy-icon name="information"></wy-icon>
                  </div>
                  <div class="wy-content-name">
                    <slot name="title">
                      <span>${msg("Nothing to see here yet.")}</span>
                    </slot>
                  </div>
                </div>
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
