import { LitElement, type PropertyValues, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";

import overlayStyles from "../scss/all.scss";

import "./wy-button";
import "./wy-icon";
import { consume } from "@lit/context";
import { createRef, ref } from "lit/directives/ref.js";

@customElement("wy-sheet")
export default class WySheet extends LitElement {
  static override styles = overlayStyles;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ type: Boolean })
  show = false;

  @property({ attribute: false })
  sheetId: string = "";

  private viewportRef = createRef<HTMLDivElement>();

  close() {
    this.show = false;
    this.dispatchEvent(new Event("removeModal", { bubbles: true, composed: true }));
    this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
  }

  private handleGlobalClose: (e: Event) => void;

  constructor() {
    super();
    this.handleGlobalClose = (e: Event) => {
      if (this.show) {
        const sheet = (e as CustomEvent).detail?.sheet;

        if (sheet instanceof WySheet && sheet !== this) {
          //console.log('global removemodal', sheet, sheet instanceof WeavySheet, sheet !== this)
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

  override connectedCallback(): void {
    super.connectedCallback();
    this.weavyContext?.host.addEventListener("wy-sheets-close", this.handleGlobalClose);
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("show")) {
      if (this.show) {
        this.weavyContext?.host.dispatchEvent(
          new CustomEvent("wy-sheets-close", { bubbles: true, composed: true, detail: { sheet: this } })
        );
        this.addEventListener("keyup", this.handleKeys);
        this.addEventListener("release-focus", this.regainFocus);
      } else {
        this.removeEventListener("keyup", this.handleKeys);
        this.removeEventListener("release-focus", this.regainFocus);
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
