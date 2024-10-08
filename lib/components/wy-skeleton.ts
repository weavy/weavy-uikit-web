import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all.scss"

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
        return `<div>${words.map(str => `<span class="wy-placeholder">${str}</span>`).join(" ")}</div>`;
      }).join(" ");
     
    }

    return html`
      <div>${unsafeHTML(skeleton)}</div>
    `;
  }
}
