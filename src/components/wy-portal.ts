import { customElement } from "lit/decorators.js";
import { ModalPortal } from "lit-modal-portal";

import portalStyles from "../scss/portal.scss";

@customElement("wy-portal")
export default class WyPortal extends ModalPortal {
  static override styles = portalStyles
}
