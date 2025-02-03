import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyComponent } from "./classes/weavy-component";

import colorModesStyles from "./scss/color-modes.scss";
import hostContentsStyles from "./scss/host-contents.scss";
import hostFontStyles from "./scss/host-font.scss";
import { AppTypeString, ComponentType } from "./types/app.types";
import { ProductTypes } from "./types/product.types";

export const WY_COMPONENT_TAGNAME = "wy-component";

declare global {
  interface HTMLElementTagNameMap {
    [WY_COMPONENT_TAGNAME]: WyComponent;
  }
}

/**
 * Generic Weavy component to provide app functionality to any provided sub components.
 *
 * @element wy-component
 * @class WyComponent
 * @slot
 */
@customElement(WY_COMPONENT_TAGNAME)
export class WyComponent extends WeavyComponent {
  static override styles = [colorModesStyles, hostContentsStyles, hostFontStyles];

  @property()
  override componentType?: AppTypeString | ComponentType | undefined = ComponentType.Unknown;

  @property()
  override productType?: ProductTypes | undefined;

  constructor() {
    super();
    new ThemeController(this, WyComponent.styles);
  }

  override render() {
    return html`<slot></slot>`;
  }
}
