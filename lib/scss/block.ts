import { unsafeCSS } from "lit";
import blockCss from "./block.scss?inline";
import blockScrollYCss from "./block-scroll-y.scss?inline";

export const blockStyles = unsafeCSS(blockCss);
export const blockScrollYStyles = unsafeCSS(blockScrollYCss);