import { customElement } from "lit/decorators.js";

import portalStyles from "../scss/portal";
import { LitElement, html } from "lit";

@customElement("wy-portal")
export default class WyPortal extends LitElement {
  static override styles = portalStyles;
  
  protected override render() {
      return html``;
  }
}
