import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import overlayStyles from "../scss/all.scss";
import { falsyBoolean } from "../converters/falsy-boolean";

import "./wy-button";
import "./wy-icon";
import { createRef, ref } from "lit/directives/ref.js";

/**
 * Overlay wrapper for displaying in portal.
 *
 */
@customElement("wy-overlay")
export default class WyOverlay extends LitElement {
  
  static override styles = overlayStyles;

  @property({ converter: falsyBoolean })
  open: boolean = true;

  @property({ type: Boolean })
  maximized: boolean = false;

  @property({ type: Boolean })
  header: boolean = false;

  private viewportRef = createRef<HTMLDivElement>();

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  /**
   * A modal should be closed.
   * @event removeModal
   */
  removeModalEvent = () => new Event("removeModal", { bubbles: true, composed: true });

  close() {
    this.open = false;

    this.dispatchEvent(this.removeModalEvent());
    this.dispatchEvent(this.releaseFocusEvent());
  }

  handleKeys = (e: KeyboardEvent) => {
    if (this.open) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        this.close();
      }
    }
  };

  regainFocus(e: Event) {
    if (this.open && e.composedPath()[0] !== this) {
      e.stopImmediatePropagation();
      //console.log("Time to focus!");
      this.viewportRef.value?.focus();
    }
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("open")) {
      if (this.open) {
        this.addEventListener("keyup", this.handleKeys);
        this.addEventListener("release-focus", this.regainFocus);
      } else {
        this.removeEventListener("keyup", this.handleKeys);
        this.removeEventListener("release-focus", this.regainFocus);
      }
    }
  }

  override render() {
    const modalClasses = {
      "wy-open": this.open,
      "wy-modal-full": this.maximized,
    };
    return html`
      <section class="wy-overlays wy-viewport" tabindex="0" ${ref(this.viewportRef)}>
        <div class="wy-panel wy-overlay wy-transition wy-modal ${classMap(modalClasses)}">
          ${this.header
            ? html`
                <slot name="header">
                  <header class="wy-appbars">
                    <nav class="wy-appbar">
                      <wy-button kind="icon" @click=${() => this.close()}><wy-icon name="close"></wy-icon></wy-button>
                      <slot name="appbar-text" class="wy-appbar-text"></slot>
                      <slot name="appbar-buttons" class="wy-appbar-buttons"></slot>
                    </nav>
                  </header>
                </slot>
              `
            : nothing}
          <slot></slot>
        </div>
      </section>
    `;
  }

  override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("open") && this.open) {
      this.viewportRef.value?.focus();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.close();
  }
}
