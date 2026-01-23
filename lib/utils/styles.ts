import { Hct } from "@material/material-color-utilities";
import { argbFromHex } from "@material/material-color-utilities";
import { argbFromRgba, getComputedColor, hexWithAlphaFromArgb } from "./colors";
import { type CSSResult, type CSSResultOrNative, supportsAdoptingStyleSheets } from "lit";
import { throwOnDomNotAvailable } from "./dom";
import { SchemeWeavy } from "./color-scheme-weavy";

export function getCSSThemeColor(element: Element) {
  // By inherited --wy-theme
  const themeColor = getComputedStyle(element).getPropertyValue("--wy-theme-color");
  return themeColor || undefined;
}

export function observeCSSThemeColor(element: Element, callback: (themeColor?: string) => void) {
  let prevColor = getCSSThemeColor(element);
  const observer = new MutationObserver(() => {
    const nextColor = getCSSThemeColor(element);
    if (nextColor !== prevColor) {
      //console.log("--wy-theme-color changed", nextColor);
      prevColor = nextColor;
      callback(nextColor);
    }
  });

  const observerOptions = {
    attributes: true,
    attributeFilter: ["class", "style"],
  };
  let parent: Node | null = element as Node;

  while (parent && parent !== document) {
    observer.observe(parent, observerOptions);
    parent = parent.parentNode;
  }

  return () => observer.disconnect();
}

export function getMetaThemeColor() {
  throwOnDomNotAvailable();

  // By meta theme-color
  const metaThemeColors = Array.from(document.head.querySelectorAll("meta[name='theme-color']"));
  const themeColor = metaThemeColors
    .filter((meta) => {
      // Only use matching media if defined
      const metaMedia = meta.getAttribute("media");
      return !metaMedia || window.matchMedia(metaMedia)?.matches;
    })
    .pop()
    ?.getAttribute("content");

  return themeColor || undefined;
}

export function observeMetaThemeColor(callback: (themeColor?: string) => void) {
  throwOnDomNotAvailable();

  const metaThemeColors = Array.from(document.head.querySelectorAll("meta[name='theme-color']"));

  if (!metaThemeColors) {
    return () => {};
  }

  let prevColor = getMetaThemeColor();

  const checkChangedColor = () => {
    const nextColor = getMetaThemeColor();
    if (nextColor !== prevColor) {
      //console.log("meta theme-color changed", nextColor);
      prevColor = nextColor;
      callback(nextColor);
    }
  };

  const nodeObserver = new MutationObserver(checkChangedColor);
  const nodeObserverOptions = {
    attributes: true,
    attributeFilter: ["content"],
  };

  const metaQueries: MediaQueryList[] = [];
  metaThemeColors.forEach((meta) => {
    nodeObserver.observe(meta, nodeObserverOptions);

    const metaMedia = meta.getAttribute("media");
    if (metaMedia) {
      const metaQuery = window.matchMedia(metaMedia);
      metaQuery.addEventListener("change", checkChangedColor);
      metaQueries.push(metaQuery);
    }
  });

  return () => {
    nodeObserver.disconnect();
    metaQueries.forEach((metaQuery) => metaQuery.removeEventListener("change", checkChangedColor));
  };
}

const seedColorsCache: Array<{ seedColor: string; colors: string[] }> = [];
const SEED_COLORS_CACHE_SIZE = 16;

export function generateThemeColors(seedColor: string, includeThemeColor = false) {
  if (seedColorsCache.some((s) => s.seedColor === seedColor)) {
    const colors = seedColorsCache.find((s) => s.seedColor === seedColor)?.colors;

    if (colors) {
      return colors;
    }
  }

  const colors = [];
  if (includeThemeColor) {
    colors.push(`--wy-theme-color:${seedColor};`);
  }

  let computedSeedColor = seedColor;
  // Get the theme from a hex or rgba() color
  if (!seedColor.startsWith("#") && !seedColor.startsWith("rgb")) {
    computedSeedColor = getComputedColor(seedColor);
  }

  const argb = seedColor.startsWith("#") ? argbFromHex(computedSeedColor) : argbFromRgba(computedSeedColor);

  // Custom color theme assuming our main Weavy color when choosing secondary and tertiary
  // Weavy #156b93 ~ HCT(238, 48, 40) => #00658e
  // Colors are taken from Hue division by 16
  // Red HSL Hue 0deg = HCT Hue 27,4deg

  const hct = Hct.fromInt(argb);
  const weavySchemes = {
    light: new SchemeWeavy(hct, false, 0.0),
    dark: new SchemeWeavy(hct, true, 0.0),
  };

  const colorTokenMap = {
    primary: "primary",
    onPrimary: "on-primary",
    primaryContainer: "primary-container",
    onPrimaryContainer: "on-primary-container",

    secondary: "secondary",
    onSecondary: "on-secondary",
    secondaryContainer: "secondary-container",
    onSecondaryContainer: "on-secondary-container",

    tertiary: "tertiary",
    onTertiary: "on-tertiary",
    tertiaryContainer: "tertiary-container",
    onTertiaryContainer: "on-tertiary-container",

    error: "error",
    onError: "on-error",
    errorContainer: "error-container",
    onErrorContainer: "on-error-container",

    background: "background",
    onBackground: "on-background",

    surface: "surface",
    onSurface: "on-surface",

    surfaceVariant: "surface-variant",
    onSurfaceVariant: "on-surface-variant",

    surfaceContainerLowest: "surface-container-lowest",
    surfaceContainerLow: "surface-container-low",
    surfaceContainer: "surface-container",
    surfaceContainerHigh: "surface-container-high",
    surfaceContainerHighest: "surface-container-highest",

    outline: "outline",
    outlineVariant: "outline-variant",

    shadow: "shadow",
    scrim: "scrim",

    // Custom surface layers

    surfaceLayerLowest: "surface-layer-lowest",
    surfaceLayerLow: "surface-layer-low",
    surfaceLayer: "surface-layer",
    surfaceLayerHigh: "surface-layer-high",
    surfaceLayerHighest: "surface-layer-highest",

    // Custom tokens

    warning: "warning",
    onWarning: "on-warning",
    warningContainer: "warning-container",
    onWarningContainer: "on-warning-container",

    highlight: "highlight",
    onHighlight: "on-highlight",

    // Named colors

    red: "red",
    deepOrange: "deep-orange",
    orange: "orange",
    amber: "amber",
    yellow: "yellow",
    lime: "lime",
    lightGreen: "light-green",
    green: "green",
    teal: "teal",
    cyan: "cyan",
    lightBlue: "light-blue",
    blue: "blue",
    indigo: "indigo",
    deepPurple: "deep-purple",
    purple: "purple",
    pink: "pink",
    gray: "gray",
  };

  for (const colorSchemeName in weavySchemes) {
    const weavyScheme = weavySchemes[colorSchemeName as keyof typeof weavySchemes];
    // Tokens
    for (const colorToken in colorTokenMap) {
      const colorTokenName = colorTokenMap[colorToken as keyof typeof colorTokenMap];
      const hex = hexWithAlphaFromArgb(weavyScheme[colorToken as keyof typeof colorTokenMap]);
      colors.push(`--wy-${colorTokenName}-${colorSchemeName}:${hex};`);
    }
  }

  // save to cache and truncate
  seedColorsCache.unshift({ seedColor, colors });
  seedColorsCache.length = Math.min(seedColorsCache.length, SEED_COLORS_CACHE_SIZE);

  //console.log("seedcolors cache", seedColorsCache.length, seedColorsCache[0].seedColor === seedColor)
  return colors;
}

/**
 * Applies the given styles to a `shadowRoot`. When Shadow DOM is
 * available but `adoptedStyleSheets` is not, styles are appended to the
 * `shadowRoot` to [mimic spec behavior](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets).
 * Note, when shimming is used, any styles that are subsequently placed into
 * the shadowRoot should be placed *before* any shimmed adopted styles. This
 * will match spec behavior that gives adopted sheets precedence over styles in
 * shadowRoot.
 */
export const adoptGlobalStyles = (styles: Array<CSSResultOrNative>) => {
  throwOnDomNotAvailable();

  if (supportsAdoptingStyleSheets) {
    document.adoptedStyleSheets = styles.map((s) => (s instanceof CSSStyleSheet ? s : (s.styleSheet as CSSStyleSheet)));
  } else {
    for (const s of styles) {
      const style = document.createElement("style");
      const nonce = (global as unknown as { litNonce: string })["litNonce"];
      if (nonce !== undefined) {
        style.setAttribute("nonce", nonce);
      }
      style.textContent = (s as CSSResult).cssText;
      (document.head || document.documentElement).appendChild(style);
    }
  }
};
