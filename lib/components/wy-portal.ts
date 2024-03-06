import { customElement } from "lit/decorators.js";
import { ModalPortal, modalController } from "lit-modal-portal";

import portalStyles from "../scss/portal"

@customElement("wy-portal")
export default class WyPortal extends ModalPortal {
  static override styles = portalStyles as unknown as typeof ModalPortal.styles;

  connectedContexts = new Set();

  override disconnectedCallback() {
    super.disconnectedCallback();
    modalController.removeAll();
    modalController.host = undefined;
    this.connectedContexts.clear();
  }
}
