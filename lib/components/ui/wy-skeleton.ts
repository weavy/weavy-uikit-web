import { LitElement, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";

import placeholderCss from "../../scss/components/placeholder.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-skeleton": WySkeleton;
  }
}

/**
 * Masked text content placeholder.
 *
 * @csspart wy-skeleton - Wrapper for the whole skeleton text.
 * @csspart wy-placeholder-line - Each line in the text.
 * @csspart wy-placeholder - Placeholder for each word in the text.
 */
@customElement("wy-skeleton")
export class WySkeleton extends LitElement {
  static override styles = [placeholderCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * The text to mask.
   */
  @property()
  text: string = "";

  override render() {
    const text = this.text.trim();

    return html`
      <div part="wy-skeleton">
        ${text.length
          ? text.split(/(\n+)/).map((line) => {
              // lines
              const words = line.split(/(\s+)/);
              return html`
                <div part="wy-placeholder-line">
                  ${words.map((word) => html` <span part="wy-placeholder">${word}</span> `)}
                </div>
              `;
            })
          : nothing}
      </div>
    `;
  }
}
