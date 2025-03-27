import {
  CSSResultOrNative,
  LitElement,
  ReactiveController,
  ReactiveControllerHost,
  adoptStyles,
  css,
  unsafeCSS,
} from "lit";
import { generateThemeColors, getCSSThemeColor, getMetaThemeColor, observeCSSThemeColor, observeMetaThemeColor } from "../utils/styles";

/**
 * Controller for generating theme colors from a resolved `--wy-theme-color`or meta theme color.
 * Regenerates when theme color is updated. 
 */
export class ThemeController implements ReactiveController {
  constructor(host: ReactiveControllerHost & LitElement & Element, styles?: CSSResultOrNative[]) {
    host.addController(this);
    this.host = host;

    if (styles) {
      this.styles = styles;
    }
  }

  #firstUpdate = true;

  host: ReactiveControllerHost & LitElement & Element;
  styles: CSSResultOrNative[] = [];

  #themeColor?: string;
  get themeColor() {
    return this.#themeColor;
  }
  set themeColor(themeColor: string | undefined) {
    this.#themeColor = themeColor;
    this.checkThemeUpdate();
  }


  private _resolvedThemeColor?: string;

  private cssObserverDisconnect?: () => void;
  private metaObserverDisconnect?: () => void;

  checkThemeUpdate() {
    const nextThemeColor = this.themeColor || getCSSThemeColor(this.host) || getMetaThemeColor();
    if (nextThemeColor && nextThemeColor !== this._resolvedThemeColor) {
      this._resolvedThemeColor = nextThemeColor;
      console.info("Configuring theme", this._resolvedThemeColor);
      const themeColors = generateThemeColors(this._resolvedThemeColor).join("");
      const colorCSS = css`
        :host {
          ${unsafeCSS(themeColors)};
        }
      `;
      const shadowRoot = this.host.renderRoot as ShadowRoot;
      adoptStyles(shadowRoot, [...this.styles, colorCSS]);
    }
  }

  hostUpdate() {
    if (this.#firstUpdate) {
      this.checkThemeUpdate();
      this.#firstUpdate = false;
    }
  }

  hostConnected() {
    this.cssObserverDisconnect = observeCSSThemeColor(this.host, () => this.checkThemeUpdate());
    this.metaObserverDisconnect = observeMetaThemeColor(() => this.checkThemeUpdate());
  }

  hostDisconnected() {
    this.cssObserverDisconnect?.();
    this.metaObserverDisconnect?.();
  }
}
