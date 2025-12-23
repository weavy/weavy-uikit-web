import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";
import type { OverlayAppearanceType } from "../../types/ui.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { CloseEventType } from "../../types/ui.events";
import { NamedEvent } from "../../types/generic.types";

import overlayCss from "../../scss/components/overlay.scss";
import modalCss from "../../scss/components/overlay-modal.scss";
import sheetCss from "../../scss/components/overlay-sheet.scss";
import drawerCss from "../../scss/components/overlay-drawer.scss";
import colorModesCss from "../../scss/color-modes.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import "./wy-titlebar";
import "./wy-button";
import "./wy-icon";

declare global {
  interface HTMLElementTagNameMap {
    "wy-overlay": WyOverlay;
  }
}

/**
 * Modal overlay based on `<dialog>` element.
 * See [MDN: Dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).
 *
 * Uses the native Popover API.
 * See [MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API).
 *
 * **Used sub components**
 *
 * - [`<wy-titlebar>`](./wy-titlebar.ts)
 * - [`<wy-button>`](./wy-button.ts)
 * - [`<wy-icon>`](./wy-icon.ts)
 *
 * @fires {CloseEventType} close - When overlay is closed.
 *
 * @slot - Default overlay content.
 * @slot header - The full header when `header' is enabled.
 * @slot title - Text in the `header`.
 * @slot actions - Buttons in the `header`.
 *
 * @csspart wy-dialog - Base for all dialogs.
 * @csspart wy-dialog-modal - Dialog with modal backdrop.
 * @csspart wy-overlay - Dialog content.
 * @csspart wy-overlay-titlebar - Dialog titlebar.
 * @csspart wy-modal - Modal overlay content with full viewport size.
 * @csspart wy-modal-centered - Modal overlay with limited size in the center of the viewport.
 * @csspart wy-sheet - Overlay in the bottom.
 * @csspart wy-drawer - Overlay in the right side.
 * @csspart wy-open - When dialog content is shown.
 * @csspart wy-maximized - When modal is maximized size.
 */

@customElement("wy-overlay")
export class WyOverlay extends LitElement {
  static override styles = [colorModesCss, hostContentsCss, overlayCss, modalCss, sheetCss, drawerCss];

  protected exportParts = new ShadowPartsController(this);

  private viewportRef = createRef<HTMLDialogElement>();

  /**
   * Whether the overlay should be shown.
   */
  @property({ type: Boolean, reflect: true })
  show: boolean = true;

  /**
   * Appearance of the overlay.
   *
   * - "modal" - Centered overlay with blocked background.
   * - "sheet" - Bottom overlay without background blocking.
   * - "drawer" - Side overlay without background blocking.
   * - "full" - Full window overlay.
   * - "none" - No rendering.
   */
  @property({ type: String })
  type: OverlayAppearanceType = "modal";

  /**
   * Maximized layout for the modal.
   */
  @property({ type: Boolean })
  maximized: boolean = false;

  /**
   * Remove the header.
   */
  @property({ type: Boolean })
  noHeader: boolean = false;

  /**
   * Close the modal.
   */
  close() {
    this.show = false;
    try {
      if (this.type !== "modal" && this.viewportRef.value?.popover) {
        this.viewportRef.value?.hidePopover();
      } else {
        this.viewportRef.value?.close();
      }
    } catch {
      /* No worries */
    }
  }

  /**
   * Checks whether the overlay is using the modal api.
   *
   * @param [type] - Optional type to check
   * @returns Whether the overlay is using the modal api.
   */
  isModal(type?: OverlayAppearanceType) {
    type ??= this.type;

    return type === "modal" || type === "full";
  }

  /**
   * Event handler for closing the modal.
   * @internal
   */
  handleClose = (e?: Event) => {
    if (this.isModal() || (e?.type === "toggle" && (e as ToggleEvent).newState === "closed") || e?.type === "close") {
      this.show = false;
      const event: CloseEventType = new (CustomEvent as NamedEvent)("close");
      this.dispatchEvent(event);
    }
  };

  override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("type") && this.viewportRef.value) {
      // Unregister previous listener
      const lastEventType =
        !this.isModal(changedProperties.get("type")) && this.viewportRef.value.popover ? "toggle" : "close";
      this.viewportRef.value.removeEventListener(lastEventType, this.handleClose);
    }
  }

  override render() {
    if (this.type === "none") {
      return nothing;
    }

    const dialogParts = {
      "wy-dialog": true,
      "wy-dialog-modal": this.isModal(),
    };

    const overlayParts = {
      "wy-overlay": true,
      "wy-modal": this.isModal(), // modal, full
      "wy-modal-centered": this.type === "modal",
      "wy-sheet": this.type === "sheet",
      "wy-drawer": this.type === "drawer",
      "wy-maximized": this.maximized,
      "wy-open": this.show,
    };

    const popover = this.isModal() ? undefined : "auto";

    return html`
      <dialog
        part=${partMap(dialogParts)}
        tabindex="0"
        popover=${ifDefined(popover)}
        ${ref(this.viewportRef)}
      >
        <div part=${partMap(overlayParts)}>
          ${this.noHeader
            ? nothing
            : html`
                <slot name="header">
                  <wy-titlebar part="wy-overlay-titlebar" header>
                    <wy-button slot="icon" kind="icon" @click=${() => this.close()}>
                      <wy-icon name="close"></wy-icon>
                    </wy-button>
                    <slot slot="title" name="title"></slot>
                    <slot slot="actions" name="actions"></slot>
                  </wy-titlebar>
                </slot>
              `}
          <slot></slot>
        </div>
      </dialog>
    `;
  }

  override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("type")) {
      // Register close/toggle event listener
      const eventType = !this.isModal() && this.viewportRef.value?.popover ? "toggle" : "close";
      this.viewportRef.value?.addEventListener(eventType, this.handleClose);

      if (this.show) {
        // Close and reopen when type changes
        if (!this.isModal(changedProperties.get("type")) && this.viewportRef.value?.popover) {
          this.viewportRef.value?.hidePopover();
        } else {
          this.viewportRef.value?.close();
        }
        this.requestUpdate("show");
      }
    }

    if (changedProperties.has("show")) {
      try {
        if (this.show) {
          if (this.isModal()) {
            this.viewportRef.value?.showModal();
          } else if (this.viewportRef.value?.popover) {
            this.viewportRef.value?.showPopover();
          } else {
            this.viewportRef.value?.show();
          }
        } else {
          if (!this.isModal() && this.viewportRef.value?.popover) {
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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.close();
  }
}
