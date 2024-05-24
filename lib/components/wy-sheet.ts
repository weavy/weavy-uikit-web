import { LitElement, type PropertyValues, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { AppContextProviderMixin } from "../mixins/app-provider-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import overlayStyles from "../scss/all"

import "./wy-button";
import "./wy-icon";

@customElement("wy-sheet")
export default class WySheet extends AppContextProviderMixin(LitElement) {
  static override styles = overlayStyles;

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  show = false;

  @property({ attribute: false })
  sheetId: string = "";

  private viewportRef = createRef<HTMLDivElement>();

  close() {
    this.show = false;
    this.dispatchEvent(new CustomEvent("close"));
    this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
  }

  private handleGlobalClose: (e: Event) => void;

  constructor() {
    super();
    this.handleGlobalClose = (e: Event) => {
      if (this.show) {
        const sheet = (e as CustomEvent).detail?.sheet;

        if (sheet instanceof WySheet && sheet !== this) {
          //console.log('global removemodal', sheet, sheet instanceof WySheet, sheet !== this)
          this.close();
        }
      }
    };
  }

  handleKeys = (e: KeyboardEvent) => {
    if (this.show) {
      if (e.key === "Escape") {
        //console.log("The Escape from Sheet Island");
        e.stopImmediatePropagation();
        this.close();
      }
    }
  };

  regainFocus(e: Event) {
    if (this.show && e.composedPath()[0] !== this) {
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

  override connectedCallback(): void {
    super.connectedCallback();
    this.whenWeavyContext().then(() => {
      this.weavyContext?.host.addEventListener("wy-sheets-close", this.handleGlobalClose);
    })
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("show")) {
      if (this.show) {
        this.weavyContext?.host.dispatchEvent(
          new CustomEvent("wy-sheets-close", { bubbles: true, composed: true, detail: { sheet: this } })
        );
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
    return html`
      <section class="wy-viewport" tabindex="0" ${ref(this.viewportRef)}>
        <div class="wy-sheet ${this.show ? "wy-show" : ""}">
          <slot name="header">
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <slot name="appbar-buttons" class="wy-appbar-buttons"></slot>
                <slot name="appbar-text" class="wy-appbar-text"></slot>
                <wy-button kind="icon" @click=${() => this.close()}>
                  <wy-icon name="close"></wy-icon>
                </wy-button>
              </nav>
            </header>
          </slot>
          <div class="wy-sheet-body wy-scroll-y">
            <slot></slot>
          </div>
        </div>
      </section>
    `;
  }

  override updated(changedProperties: PropertyValues<this>) {
    this.exportParts.addPartsFrom(this.viewportRef.value);

    if (changedProperties.has("show") && this.show) {
      this.viewportRef.value?.focus();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.weavyContext?.host.removeEventListener("wy-sheets-close", this.handleGlobalClose);
    this.close();
  }
}
