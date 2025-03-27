import { LitElement, html } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";

import chatCss from "../../scss/all.scss"

@customElement("wy-skeleton")
export default class WySkeleton extends LitElement {
  
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property()
  text: string = "";
  
  override render() {
  
    const text = this.text.trim();
    let skeleton = "";

    if (text.length) {
      const lines = text.split(/(\n+)/);
      skeleton = lines.map((l) => {
        const words = l.split(/(\s+)/);
        return `<div>${words.map(str => `<span class="wy-placeholder">${this.escapeHTML(str)}</span>`).join(" ")}</div>`;
      }).join(" ");     
    }

    return html`
      <div>${unsafeHTML(skeleton)}</div>
    `;
  }

  escapeHTML(str: string) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

}
