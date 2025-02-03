import { LitElement, type PropertyValues, html, css } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import overlayStyles from "../scss/all.scss";

import "./wy-button";
import "./wy-icon";

@customElement("wy-sheet")
export default class WySheet extends LitElement {
  static override styles = [
    overlayStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  noPadding: boolean = false;

  @property({ type: Boolean })
  show = false;

  private viewportRef = createRef<HTMLDialogElement>();

  close() {
    this.show = false;
    try {
      if (this.viewportRef.value?.popover) {
        this.viewportRef.value?.hidePopover();
      } else {
        this.viewportRef.value?.close();
      }
    } catch {
      /* No worries */
    }
  }

  handleClose(e: ToggleEvent) {
    if ((e.type === "toggle" && e.newState === "closed") || e.type === "close") {
      this.show = false;
      this.dispatchEvent(new CustomEvent("close"));
      this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
    }
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    
  }

  override render() {
    return html`
      <dialog class="wy-dialog" tabindex="0" ${ref(this.viewportRef)} popover>
        <div class="wy-sheet ${this.show ? "wy-show" : ""}">
          <slot name="header">
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <wy-button kind="icon" @click=${() => this.close()}>
                  <wy-icon name="close"></wy-icon>
                </wy-button>
                <slot name="appbar-text" class="wy-appbar-text"></slot>
                <slot name="appbar-buttons" class="wy-appbar-buttons wy-appbar-buttons-last"></slot>
              </nav>
            </header>
          </slot>
          <div class="wy-sheet-body wy-scroll-y ${this.noPadding ? "wy-sheet-no-padding" : ""}">
            <slot></slot>
          </div>
        </div>
      </dialog>
    `;
  }

  override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("show")) {
      try {
        if (this.show) {
          if (this.viewportRef.value?.popover) {
            this.viewportRef.value?.showPopover();
          } else {
            this.viewportRef.value?.show();
          }
        } else {
          if (this.viewportRef.value?.popover) {
            this.viewportRef.value?.hidePopover();
          } else {
            this.viewportRef.value?.close();
          }
        }
      } catch {
        /* No worries */
      }
    }
    if (changedProperties.has("show") && this.show) {
      this.viewportRef.value?.focus();
    }
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.viewportRef.value?.addEventListener(this.viewportRef.value.popover ? "toggle" : "close", (e: Event) =>
      this.handleClose(e as ToggleEvent)
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.close();
  }
}
