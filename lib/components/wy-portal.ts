import { customElement } from "lit/decorators.js";
import { ModalPortal, modalController } from "lit-modal-portal";

import portalStyles from "../scss/portal.scss";

@customElement("wy-portal")
export default class WyPortal extends ModalPortal {
  static override styles = portalStyles

  connectedContexts = new Set();

  override disconnectedCallback() {
    super.disconnectedCallback();
    modalController.removeAll();
    modalController.host = undefined;
    this.connectedContexts.clear();
  }
}
