import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import emptyCss from "../scss/components/empty.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-icon";
import "./ui/wy-progress-circular";


declare global {
  interface HTMLElementTagNameMap {
    "wy-empty": WyEmpty;
  }
}

/**
 * Generic empty state display used across the UI.
 *
 * **Used sub components:**
 *
 * - [`<wy-icon-display>`](./ui/wy-icon.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @slot - Default slot for empty-state content (replaces internal default icon+text).
 * @slot title - Named slot used inside the default content for the title/text.
 *
 * @csspart wy-empty - Root container for the empty state display.
 */
@customElement("wy-empty")
@localized()
export class WyEmpty extends LitElement {
  static override styles = [
    emptyCss,
    hostContentsCss,
  ];
  
  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Consumed Weavy context providing network status.
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy?: WeavyType;

  /**
   * Hide network status messaging.
   */
  @property({ type: Boolean })
  noNetwork: boolean = false;

  /**
   * Force a re-render when network state changes.
   * @internal
   */
  protected handleUpdate = () => this.requestUpdate();

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("weavy")) {
      const lastContext = changedProperties.get("weavy");
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
      <div part="wy-empty">
        ${this.weavy && !this.noNetwork && this.weavy?.network.state === "unreachable"
          ? html`
              <wy-icon-display>
                <wy-icon name="server-network-off"></wy-icon>
                <span slot="text">${msg("The server is offline, try again in a few minutes...")}</span>
                <wy-progress-circular indeterminate slot="meta" ?hidden=${!this.weavy?.network.isPending}></wy-progress-circular>
              </wy-icon-display>
            `
          : !this.noNetwork && this.weavy?.network.state === "offline"
          ? html`
              <wy-icon-display>
                <wy-icon name="wifi-off"></wy-icon>
                <span slot="text">${msg("You are currently offline.")}</span>
                <wy-progress-circular indeterminate slot="meta" ?hidden=${!this.weavy?.network.isPending}></wy-progress-circular>
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
