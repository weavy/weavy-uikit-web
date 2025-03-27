import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ThemeController } from "./controllers/theme-controller";
import { AppTypeStrings, WeavyComponent } from "./classes/weavy-component";
import { AppTypeGuid, AppTypeString, ComponentType } from "./types/app.types";
import { allFeatures, ComponentFeatures, featureListFromString, featureConfigFromList } from "./contexts/features-context";

import colorModesStyles from "./scss/color-modes.scss";
import hostContentsStyles from "./scss/host-contents.scss";
import hostFontStyles from "./scss/host-font.scss";

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

  @property({
    converter: {
      fromAttribute(value, _type) {
        return AppTypeStrings.get(value as AppTypeString) ?? value
      }
    }
  })
  override componentType?: AppTypeGuid | ComponentType | undefined = ComponentType.Unknown;

  @property({
    converter: {
      fromAttribute(value, _type) {
        const featureList = typeof value === "string" ? featureListFromString(value, allFeatures) : allFeatures;
        return new ComponentFeatures(featureConfigFromList(featureList));
      },
    },
  })
  override componentFeatures = new ComponentFeatures(featureConfigFromList(allFeatures));

  protected theme = new ThemeController(this, WyComponent.styles);
  
  override render() {
    return html`<slot></slot>`;
  }
}
