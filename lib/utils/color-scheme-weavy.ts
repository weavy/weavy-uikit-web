import { DynamicScheme, Hct, sanitizeDegreesDouble, TonalPalette } from "@material/material-color-utilities";
import { addAlphaToArgb } from "./colors";

//import {Variant} from '../dynamiccolor/variant.js';
/**
 * Set of themes supported by Dynamic Color.
 * Instantiate the corresponding subclass, ex. SchemeTonalSpot, to create
 * colors corresponding to the theme.
 */
export enum Variant {
  MONOCHROME,
  NEUTRAL,
  TONAL_SPOT,
  VIBRANT,
  EXPRESSIVE,
  FIDELITY,
  CONTENT,
  RAINBOW,
  FRUIT_SALAD,
}

export enum ColorPaletteName {
  Red = "red",
  DeepOrange = "deep-orange",
  Orange = "orange",
  Amber = "amber",
  Yellow = "yellow",
  Lime = "lime",
  LightGreen = "light-green",
  Green = "green",
  Teal = "teal",
  Cyan = "cyan",
  LightBlue = "light-blue",
  Blue = "blue",
  Indigo = "indigo",
  DeepPurple = "deep-purple",
  Purple = "purple",
  Pink = "pink",
  Gray = "gray",
}

export enum ColorScheme {
  Light = "light",
  Dark = "dark",
}

/**
 * Based on SchemeTonalSpot.
 *
 * A Dynamic Color theme with low to medium colorfulness and a Tertiary
 * TonalPalette with a hue related to the source color.
 *
 * The default Material You theme on Android 12 and 13.
 */
export class SchemeWeavy extends DynamicScheme {
  /**
   * Given a tone, produces a yellowish, colorful, color.
   */
  warningPalette: TonalPalette;

  allTones: { [key: string]: number } = {
    //"100": 100,
    "98": 98, // MD3
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

  namedColorPalettes: { [key in ColorPaletteName]: TonalPalette };
  namedColorToneMap: { [key in ColorPaletteName]: { [key in ColorScheme]: number } } = {
    red: { light: 60, dark: 60 },
    "deep-orange": { light: 60, dark: 60 },
    orange: { light: 70, dark: 70 },
    amber: { light: 70, dark: 70 },
    yellow: { light: 70, dark: 80 },
    lime: { light: 70, dark: 70 },
    "light-green": { light: 70, dark: 70 },
    green: { light: 60, dark: 60 },
    teal: { light: 60, dark: 60 },
    cyan: { light: 50, dark: 60 },
    "light-blue": { light: 60, dark: 70 },
    blue: { light: 70, dark: 80 },
    indigo: { light: 60, dark: 60 },
    "deep-purple": { light: 60, dark: 70 },
    purple: { light: 60, dark: 70 },
    pink: { light: 60, dark: 70 },
    gray: { light: 50, dark: 60 },
  };

  constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number) {
    super({
      sourceColorArgb: sourceColorHct.toInt(),
      variant: Variant.TONAL_SPOT,
      contrastLevel,
      isDark,
      primaryPalette: TonalPalette.fromHueAndChroma(sourceColorHct.hue, 36.0),
      secondaryPalette: TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16.0),
      tertiaryPalette: TonalPalette.fromHueAndChroma(sanitizeDegreesDouble(sourceColorHct.hue - 6 * 22.5), 16.0),
      neutralPalette: TonalPalette.fromHueAndChroma(sourceColorHct.hue, 6.0),
      neutralVariantPalette: TonalPalette.fromHueAndChroma(sourceColorHct.hue, 8.0),
    });

    const hue = sourceColorHct.hue;
    const chroma = sourceColorHct.chroma;

    const maxChroma = Math.max(48, chroma);
    const colorChroma = Math.min(maxChroma, 84); // Google suggests 84 for Error

    const divisions = 16.0; // Number of colors
    const colorGap = 360.0 / divisions; // Degrees between hue colors
    const redZero = 27.4; // HCT.FromInt(unchecked(0xff0000));
    const hueOffset = -8.0; // Average offset for the color wheel

    const redHue = ((hue + 360.0 - redZero - hueOffset + colorGap / 2) % colorGap) + redZero + hueOffset - colorGap / 2;

    this.errorPalette = TonalPalette.fromHueAndChroma(redHue, 84);

    // Custom tokens

    // Warning does currently not support DynamicColor, which is limited to pre-defined names.
    this.warningPalette = TonalPalette.fromHueAndChroma(redHue + 4 * colorGap, colorChroma); // Same as yellow

    // Named colors
    this.namedColorPalettes = {
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
    } as { [key in ColorPaletteName]: TonalPalette };
  }

  // Solid base colors
  get black() {
    return 0x000000;
  }

  get white() {
    return 0xFFFFFF;
  }
  
  // Custom transparency based surface container colors
  
  get surfaceLayerLowest() {
    return this.isDark ? addAlphaToArgb(this.black, 0.5) : addAlphaToArgb(this.white, 0.75);
  }

  get surfaceLayerLow() {
    return this.isDark ? addAlphaToArgb(this.black, 0.25) : addAlphaToArgb(this.white, 0.5);
  }

  get surfaceLayer() {
    return this.isDark ? addAlphaToArgb(this.white, 0.05) : addAlphaToArgb(this.black, 0.05);
  }

  get surfaceLayerHigh() {
    return this.isDark ? addAlphaToArgb(this.white, 0.10) : addAlphaToArgb(this.black, 0.075);
  }

  get surfaceLayerHighest() {
    return this.isDark ? addAlphaToArgb(this.white, 0.15) : addAlphaToArgb(this.black, 0.10);
  }

  // Custom Tokens

  get warning() {
    return this.warningPalette.tone(this.isDark ? 90 : 70);
  }

  get onWarning() {
    return this.warningPalette.tone(this.isDark ? 30 : 0);
  }

  get warningContainer() {
    return this.warningPalette.tone(this.isDark ? 50 : 90);
  }

  get onWarningContainer() {
    return this.warningPalette.tone(this.isDark ? 95 : 10);
  }

  get highlight() {
    return this.primaryPalette.tone(this.isDark ? 20 : 95);
  }

  get onHighlight() {
    return this.primaryPalette.tone(this.isDark ? 90 : 10);
  }

  // Named colors
  namedColor(colorName: ColorPaletteName) {
    return this.namedColorPalettes[colorName].tone(this.namedColorToneMap[colorName][this.isDark ? "dark" : "light"]);
  }

  get red() {
    return this.namedColor(ColorPaletteName.Red);
  }

  get deepOrange() {
    return this.namedColor(ColorPaletteName.DeepOrange);
  }

  get orange() {
    return this.namedColor(ColorPaletteName.Orange);
  }
  get amber() {
    return this.namedColor(ColorPaletteName.Amber);
  }

  get yellow() {
    return this.namedColor(ColorPaletteName.Yellow);
  }

  get lime() {
    return this.namedColor(ColorPaletteName.Lime);
  }

  get lightGreen() {
    return this.namedColor(ColorPaletteName.LightGreen);
  }

  get green() {
    return this.namedColor(ColorPaletteName.Green);
  }

  get teal() {
    return this.namedColor(ColorPaletteName.Teal);
  }

  get cyan() {
    return this.namedColor(ColorPaletteName.Cyan);
  }

  get lightBlue() {
    return this.namedColor(ColorPaletteName.LightBlue);
  }

  get blue() {
    return this.namedColor(ColorPaletteName.Blue);
  }

  get indigo() {
    return this.namedColor(ColorPaletteName.Indigo);
  }

  get deepPurple() {
    return this.namedColor(ColorPaletteName.DeepPurple);
  }

  get purple() {
    return this.namedColor(ColorPaletteName.Purple);
  }

  get pink() {
    return this.namedColor(ColorPaletteName.Pink);
  }

  get gray() {
    return this.namedColor(ColorPaletteName.Gray);
  }
}
