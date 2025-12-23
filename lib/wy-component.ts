import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ThemeController } from "./controllers/theme-controller";
import { UnknownApp, WeavyAppComponent } from "./classes/weavy-app-component";
import { AppTypeGuid, AppTypeString, UnknownAppType } from "./types/app.types";
import { allFeatures, ComponentFeatures, featureListFromString, featureConfigFromList } from "./contexts/features-context";

import colorModesCss from "./scss/color-modes.scss";
import hostContentsCss from "./scss/host-contents.scss";
import hostFontCss from "./scss/host-font.scss";
import { AppTypeStrings } from "./classes/weavy-type-component";

declare global {
  interface HTMLElementTagNameMap {
    "wy-component": WyComponent;
  }
}

/**
 * @import { WyActionEventType } from "./types/action.events"
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyLinkEventType } from "./types/notifications.events"
 * @import { WyPreviewOpenEventType } from "./types/files.events"
 * @import { WyPreviewCloseEventType } from "./types/files.events"
 * @import { WyUnreadEventType } from "./types/ui.events"
 */

/**
 * Generic Weavy component wrapper to provide app functionality to any provided sub components.
 *
 * @tagname wy-component
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyLinkEventType} wy-link - Fired when a notification is clicked.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed. 
 * @fires {WyUnreadEventType} wy-unread - Fired when the unread count change.
 * @slot - Generic slot for any consuming sub components.
 */
@customElement("wy-component")
export class WyComponent extends WeavyAppComponent {
  static override styles = [colorModesCss, hostContentsCss, hostFontCss];

  /**
   * App guid or component type for the component wrapper.
   */
  @property({
    converter: {
      fromAttribute(value, _type) {
        return AppTypeStrings.get(value as AppTypeString) ?? value
      }
    }
  })
  override appType?: AppTypeGuid | UnknownAppType | undefined = UnknownApp;

  /**
   * Feature configuration. May be provided as a space separated attribute string.
   */
  @property({
    converter: {
      fromAttribute(value, _type) {
        const featureList = typeof value === "string" ? featureListFromString(value, allFeatures) : allFeatures;
        return new ComponentFeatures(featureConfigFromList(featureList));
      },
    },
  })
  override componentFeatures = new ComponentFeatures(featureConfigFromList(allFeatures));

  /** @internal */
  protected theme = new ThemeController(this, WyComponent.styles);
  
  override render() {
    return html`<slot></slot>`;
  }
}
