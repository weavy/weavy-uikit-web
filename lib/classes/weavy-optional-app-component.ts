import { property, state } from "lit/decorators.js";
import type { UnknownAppType } from "../types/app.types";
import { toIntOrString } from "../converters/string";
import { UnknownApp, WeavyAppComponent } from "./weavy-app-component";
/**
 * Base class for exposed/public weavy components. This class provides common external properties and internal data provided as contexts for sub components.
 */
export class WeavyOptionalAppComponent extends WeavyAppComponent {
  // PROPERTIES
  /**
   * The appType is always "unknown" for optional apps, since the app will be fetched from the server.
   */
  @state()
  protected override appType: UnknownAppType = UnknownApp;

  /**
   * Optional filter to only show data from the app with the corresponding `uid`.
   */
  @property({ converter: toIntOrString })
  override uid?: string | number | null;
}
