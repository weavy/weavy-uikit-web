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

export class ThemeController implements ReactiveController {
  constructor(host: ReactiveControllerHost & LitElement & Element, styles?: CSSResultOrNative[]) {
    host.addController(this);
    this.host = host;

    if (styles) {
      this.styles = styles;
    }

    this.cssObserverDisconnect = observeCSSThemeColor(host, () => this.checkThemeUpdate());
    this.metaObserverDisconnect = observeMetaThemeColor(() => this.checkThemeUpdate());
  }

  firstUpdate = true;

  host: ReactiveControllerHost & LitElement & Element;
  styles: CSSResultOrNative[] = [];

  themeColor?: string;
  private _resolvedThemeColor?: string;

  private cssObserverDisconnect?: () => void;
  private metaObserverDisconnect?: () => void;

  checkThemeUpdate() {
    const nextThemeColor = this.themeColor || getCSSThemeColor(this.host) || getMetaThemeColor();
    if (nextThemeColor && nextThemeColor !== this._resolvedThemeColor) {
      this._resolvedThemeColor = nextThemeColor;
      console.log("Configuring theme", this._resolvedThemeColor);
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
    if (this.firstUpdate) {
      this.checkThemeUpdate();
      this.firstUpdate = false;
    }
  }

  hostDisconnected() {
    this.cssObserverDisconnect?.();
    this.metaObserverDisconnect?.();
  }
}
