import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { createRef, ref } from "lit/directives/ref.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";

import overlayStyles from "../../scss/all.scss"
import colorModesStyles from "../../scss/color-modes.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import "./wy-button";
import "./wy-icon";

/**
 * Overlay wrapper for displaying in portal.
 *
 */
@customElement("wy-overlay")
export default class WyOverlay extends LitElement {
  
  static override styles = [
    overlayStyles,
    colorModesStyles,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  // PROPERTIES
  @property({ type: Boolean })
  show: boolean = true;

  @property({ type: Boolean })
  maximized: boolean = false;

  @property({ type: Boolean })
  filled: boolean = false;

  @property({ type: Boolean })
  header: boolean = false;

  private viewportRef = createRef<HTMLDialogElement>();

  close() {
    this.viewportRef.value?.close();
    this.show = false;
  }

  handleClose(_e: Event) {
    this.show = false;
    this.dispatchEvent(new CustomEvent("close"));
    this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
  }

  override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    
    if (changedProperties.has("show")) {
      if (this.show) {
        this.viewportRef.value?.showModal();
      } else {
        this.viewportRef.value?.close();
      }
    }
  }

  override render() {
    const modalClasses = {
      "wy-open": this.show,
      "wy-modal-padded": !this.filled && !this.maximized,
      "wy-modal-full": this.maximized && !this.filled,
    };
    return html`
      <dialog class="wy-dialog wy-overlay-dialog" ${ref(this.viewportRef)}>
        <div class="wy-overlay wy-transition wy-modal ${classMap(modalClasses)}">
          ${this.header
            ? html`
                <slot name="header">
                  <header class="wy-appbars">
                    <nav class="wy-appbar">
                      <wy-button kind="icon" @click=${() => this.close()}><wy-icon name="close"></wy-icon></wy-button>
                      <slot name="appbar-text" class="wy-appbar-text"></slot>
                      <slot name="appbar-buttons" class="wy-appbar-buttons wy-appbar-buttons-last"></slot>
                    </nav>
                  </header>
                </slot>
              `
            : nothing}
          <slot></slot>
        </div>
      </dialog>
    `;
  }

  override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("show") && this.show) {
      this.viewportRef.value?.focus();
    }
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.viewportRef.value?.addEventListener("close", (e: Event) => this.handleClose(e))
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.close();
  }
}
