//import { TonalPalette } from "@material/material-color-utilities/dist/palettes/tonal_palette";
import { Hct } from "@material/material-color-utilities";
import { argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import { Blend } from "@material/material-color-utilities";
import { TonalPalette } from "@material/material-color-utilities";
import { argbFromRgba, getComputedColor } from "./colors";
import { type CSSResult, type CSSResultOrNative, supportsAdoptingStyleSheets } from "lit";

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
      console.log("--wy-theme-color changed", nextColor);
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
  const metaThemeColors = Array.from(document.head.querySelectorAll("meta[name='theme-color']"));

  if (!metaThemeColors) {
    return () => {};
  }

  let prevColor = getMetaThemeColor();

  const checkChangedColor = () => {
    const nextColor = getMetaThemeColor();
    if (nextColor !== prevColor) {
      console.log("meta theme-color changed", nextColor);
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
    console.log("computed color", seedColor);
  }

  const argb = seedColor.startsWith("#") ? argbFromHex(computedSeedColor) : argbFromRgba(computedSeedColor);

  // Custom color theme assuming our main Weavy color when choosing secondary and tertiary
  // Weavy #156b93 ~ HCT(238, 48, 40) => #00658e
  // Colors are taken from Hue division by 16
  // Red HSL Hue 0deg = HCT Hue 27,4deg

  const hct = Hct.fromInt(argb);
  const hue = hct.hue;
  const chroma = hct.chroma;

  const maxChroma = Math.max(48, chroma);
  const colorChroma = Math.min(maxChroma, 84); // Google suggests 84 for Error

  const divisions = 16.0; // Number of colors
  const colorGap = 360.0 / divisions; // Degrees between hue colors
  const redZero = 27.4; // HCT.FromInt(unchecked(0xff0000));
  const hueOffset = -8.0; // Average offset for the color wheel

  const redHue = ((hue + 360.0 - redZero - hueOffset + colorGap / 2) % colorGap) + redZero + hueOffset - colorGap / 2;

  const palette: { [key: string]: TonalPalette } = {
    primary: TonalPalette.fromHueAndChroma(hue, maxChroma),
    secondary: TonalPalette.fromHueAndChroma(hue, maxChroma / 3),
    tertiary: TonalPalette.fromHueAndChroma(hue + 60, maxChroma / 2),
    neutral: TonalPalette.fromHueAndChroma(hue, Math.min(chroma / 12, 4)),
    "neutral-variant": TonalPalette.fromHueAndChroma(hue, Math.min(chroma / 6, 8)),
    error: TonalPalette.fromHueAndChroma(redHue, 84),
    warning: TonalPalette.fromHueAndChroma(redHue + 4 * colorGap, colorChroma), // Same as yellow

    red: TonalPalette.fromHueAndChroma(redHue, colorChroma),
    "deep-orange": TonalPalette.fromHueAndChroma(redHue + 1 * colorGap, colorChroma),
    orange: TonalPalette.fromHueAndChroma(redHue + 2 * colorGap, colorChroma),
    amber: TonalPalette.fromHueAndChroma(redHue + 3 * colorGap, colorChroma),
    yellow: TonalPalette.fromHueAndChroma(redHue + 4 * colorGap, colorChroma),
    lime: TonalPalette.fromHueAndChroma(redHue + 5 * colorGap, colorChroma),
    "light-green": TonalPalette.fromHueAndChroma(redHue + 6 * colorGap, colorChroma),
    green: TonalPalette.fromHueAndChroma(redHue + 7 * colorGap, colorChroma),
    teal: TonalPalette.fromHueAndChroma(redHue + 8 * colorGap, colorChroma),
    cyan: TonalPalette.fromHueAndChroma(redHue + 9 * colorGap, colorChroma),
    "light-blue": TonalPalette.fromHueAndChroma(redHue + 10 * colorGap, colorChroma),
    blue: TonalPalette.fromHueAndChroma(redHue + 11 * colorGap, colorChroma),
    indigo: TonalPalette.fromHueAndChroma(redHue + 12 * colorGap, colorChroma),
    "deep-purple": TonalPalette.fromHueAndChroma(redHue + 13 * colorGap, colorChroma),
    purple: TonalPalette.fromHueAndChroma(redHue + 14 * colorGap, colorChroma),
    pink: TonalPalette.fromHueAndChroma(redHue + 15 * colorGap, colorChroma),
    gray: TonalPalette.fromHueAndChroma(hue, 4),
  };

  const allTones: { [key: string]: number } = {
    //"100": 100,
    "99": 99,
    "95": 95,
    "90": 90,
    "80": 80,
    "70": 70,
    "60": 60,
    "50": 50,
    "40": 40,
    "30": 30,
    "20": 20,
    "10": 10,
    //"0": 0
  };

  const colorToneMap: { [key: string]: { [key: string]: number } } = {
    primary: allTones,
    secondary: allTones,
    tertiary: allTones,
    neutral: allTones,
    "neutral-variant": allTones,
    error: allTones,
    warning: allTones,
    blue: { light: 70, dark: 80 },
    indigo: { light: 60, dark: 60 },
    purple: { light: 60, dark: 70 },
    pink: { light: 60, dark: 70 },
    red: { light: 60, dark: 60 },
    orange: { light: 70, dark: 70 },
    yellow: { light: 70, dark: 80 },
    green: { light: 60, dark: 60 },
    teal: { light: 60, dark: 60 },
    cyan: { light: 50, dark: 60 },
    gray: { light: 50, dark: 60 },
  };

  for (const colorName in colorToneMap) {
    const tones = colorToneMap[colorName];
    for (const tone in tones) {
      const hex = hexFromArgb(palette[colorName].tone(tones[tone]));
      colors.push(`--wy-${colorName}-${tone}:${hex};`);
    }
  }

  // Surface Tones
  const tint = {
    light: palette.primary.tone(40),
    dark: palette.primary.tone(80),
  };

  const surface = {
    light: palette.neutral.tone(99),
    dark: palette.neutral.tone(10),
  };

  const surfaces: { [key: string]: { [key: string]: number } } = {
    "surface-1": {
      light: Blend.cam16Ucs(surface.light, tint.light, 0.05),
      dark: Blend.cam16Ucs(surface.dark, tint.dark, 0.05),
    },
    "surface-2": {
      light: Blend.cam16Ucs(surface.light, tint.light, 0.08),
      dark: Blend.cam16Ucs(surface.dark, tint.dark, 0.08),
    },
    "surface-3": {
      light: Blend.cam16Ucs(surface.light, tint.light, 0.11),
      dark: Blend.cam16Ucs(surface.dark, tint.dark, 0.11),
    },
    "surface-4": {
      light: Blend.cam16Ucs(surface.light, tint.light, 0.12),
      dark: Blend.cam16Ucs(surface.dark, tint.dark, 0.12),
    },
    "surface-5": {
      light: Blend.cam16Ucs(surface.light, tint.light, 0.14),
      dark: Blend.cam16Ucs(surface.dark, tint.dark, 0.14),
    },
  };

  for (const colorName in surfaces) {
    const tones = surfaces[colorName];
    for (const tone in tones) {
      const hex = hexFromArgb(tones[tone]);
      colors.push(`--wy-${colorName}-${tone}:${hex};`);
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
export const adoptGlobalStyles = (
  styles: Array<CSSResultOrNative>
) => {
  if (supportsAdoptingStyleSheets) {
    document.adoptedStyleSheets = styles.map((s) =>
      s instanceof CSSStyleSheet ? s : s.styleSheet!
    );
  } else {
    for (const s of styles) {
      const style = document.createElement('style');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nonce = (global as any)['litNonce'];
      if (nonce !== undefined) {
        style.setAttribute('nonce', nonce);
      }
      style.textContent = (s as CSSResult).cssText;
      (document.head || document.documentElement).appendChild(style);
    }
  }
};