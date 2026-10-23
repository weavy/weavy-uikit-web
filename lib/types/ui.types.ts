export type OverlayAppearanceType = "modal" | "modal-input" | "sheet" | "drawer" | "full" | "none";
export type BadgeAppearanceType = "count" | "dot" | "none";
export type PositionType = "inline" | "top-right" | "bottom-right" | "bottom-left" | "top-left";
export type ThemeModeType = "light" | "dark" | "auto";
export type AppearanceModeType = "interactive" | "empty" | "none";

/**
 * Returns a supported appearance mode, defaulting invalid values to interactive.
 * @param value - Appearance mode to validate.
 * @returns A supported appearance mode.
 */
export function normalizeAppearanceMode(value: unknown): AppearanceModeType {
  return value === "empty" || value === "none" ? value : "interactive";
}