import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import overlayStyles from "../scss/all"
import { createRef, ref } from "lit/directives/ref.js";
import { AppContextProps } from "../mixins/app-mixin";
import { AppContextProviderMixin } from "../mixins/app-provider-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-button";
import "./wy-icon";

/**
 * Overlay wrapper for displaying in portal.
 *
 */
@customElement("wy-overlay")
export default class WyOverlay extends AppContextProviderMixin(LitElement) implements AppContextProps {
  
  static override styles = overlayStyles;

  protected exportParts = new ShadowPartsController(this);

  // PROPERTIES
  @property({ type: Boolean })
  open: boolean = true;

  @property({ type: Boolean })
  maximized: boolean = false;

  @property({ type: Boolean })
  header: boolean = false;

  override tabIndex: number = 0;

  private viewportRef = createRef<HTMLDivElement>();

  close() {
    this.open = false;

    this.dispatchEvent(new CustomEvent("close"));
    this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
  }

  handleKeys = (e: KeyboardEvent) => {
    //console.log("key", e.key);
    if (this.open) {
      if (e.key === "Escape") {

        e.stopImmediatePropagation();
        this.close();
      }
    }
  };

  regainFocus(e: Event) {
    //console.log("regain focus?");
    if (this.open && e.composedPath()[0] !== this) {
      e.stopImmediatePropagation();
      //console.log("Time to focus!");
      this.viewportRef.value?.focus();
    }
  }

  checkFocus(e: FocusEvent) {
    const target = e.target as HTMLElement;
    requestAnimationFrame(() => {
      if (!target || !target.isConnected) {
        this.regainFocus(e);
      }
    })
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);
    
    if (changedProperties.has("open")) {
      if (this.open) {
        this.addEventListener("keyup", this.handleKeys);
        this.addEventListener("release-focus", this.regainFocus);
        this.addEventListener("focusout", this.checkFocus);
      } else {
        this.removeEventListener("keyup", this.handleKeys);
        this.removeEventListener("release-focus", this.regainFocus);
        this.removeEventListener("focusout", this.checkFocus);
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
