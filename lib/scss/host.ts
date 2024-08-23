import { unsafeCSS } from "lit";
import hostBlockCss from "./host-block.scss?inline";
import hostScrollYCss from "./host-scroll-y.scss?inline";
import hostContentsCss from "./host-contents.scss?inline";
import hostFontCss from "./host-font.scss?inline";
export const hostScrollYStyles = unsafeCSS(hostScrollYCss);
export const hostContents = unsafeCSS(hostContentsCss);
export const hostBlockStyles = unsafeCSS(hostBlockCss);
export const hostFontStyles = unsafeCSS(hostFontCss);