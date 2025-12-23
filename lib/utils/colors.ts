import { alphaFromArgb, blueFromArgb, greenFromArgb, redFromArgb } from "@material/material-color-utilities";
import { throwOnDomNotAvailable } from "./dom";

export function hexFromRgba(rgba: string, opaque = false) {
  const parsedRgba = rgba
    .match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)
    ?.slice(1)
    .map((n, i) =>
      (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n)).toString(16).padStart(2, "0").replace("NaN", "")
    )
    .slice(0, opaque ? 2 : 3);

  if (!parsedRgba) {
    throw new Error("Could not parse rgba color.");
  }

  return `#${parsedRgba.join("")}`;
}

export function argbFromRgba(rgba: string, opaque: boolean = false) {
  const parsedRgba = rgba
    .match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)
    ?.slice(1)
    .map((n, i) => (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n)));

  if (!parsedRgba) {
    throw new Error("Could not parse rgba color.");
  }

  const [r, g, b, a] = parsedRgba;

  return (((opaque ? 255 : a & 0x0ff) << 24) | ((r & 0x0ff) << 16) | ((g & 0x0ff) << 8) | (b & 0x0ff)) >>> 0;
}

export function addAlphaToArgb(argb: number, alpha: number) {
  return (Math.round(255 * alpha) << 24) | (argb & 0xFFFFFF);
}

/**
 * Utility methods for hexadecimal representations of colors.
 */
/**
 * @param argb ARGB representation of a color.
 * @return RGBA Hex string representing color, ex. #ff0000FF for red.
 */
export function hexWithAlphaFromArgb(argb: number) {
    const r = redFromArgb(argb);
    const g = greenFromArgb(argb);
    const b = blueFromArgb(argb);
    const a = alphaFromArgb(argb);
    const outParts = [r.toString(16), g.toString(16), b.toString(16)];
    if (a !== 255) {
        outParts.push(a.toString(16));
    }
    // Pad single-digit output values
    for (const [i, part] of outParts.entries()) {
        if (part.length === 1) {
            outParts[i] = '0' + part;
        }
    }
    return '#' + outParts.join('');
}

export function getComputedColor(color: string) {
  throwOnDomNotAvailable();

  const computeNode = document.createElement("wy-compute-styles");
  computeNode.setAttribute("style", `color: ${color} !important;`);
  document.documentElement.append(computeNode);
  const computedColor = window.getComputedStyle(computeNode).color;
  computeNode.remove();
  return computedColor;
}
