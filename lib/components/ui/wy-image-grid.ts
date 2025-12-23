import { LitElement, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ref } from "lit/directives/ref.js";
import type { FileType } from "../../types/files.types";
import type { FileOpenEventType } from "../../types/files.events";
import { getExtension } from "../../utils/files";
import { checkImageLoad, imageLoaded } from "../../utils/images";
import { partMap } from "../../utils/directives/shadow-part-map";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { NamedEvent } from "../../types/generic.types";
import imageGridCss from "../../scss/components/image-grid.scss";
import hostContentsCss from "../../scss/host-contents.scss";
import { isModifiedClick } from "../../utils/dom";

const MAX_ICON_SIZE = 128;

declare global {
  interface HTMLElementTagNameMap {
    "wy-image-grid": WyImageGrid;
  }
}

/**
 * Image grid with evenly layouted heights on each row.
 *
 * @csspart wy-image-grid - The grid container.
 * @csspart wy-image-grid-outer - Modifier class for outer styling.
 * @csspart wy-image - Image wrapper.
 * @csspart wy-image-filled - Expanding the image wrapper to the area where it's placed. 
 * @csspart wy-image-full-width - Image wrapper in full with.
 * @csspart wy-image-area - Area to render the image.
 * @csspart wy-image-content - The image.
 * @csspart wy-image-icon - The image when it's an icon.
 * @csspart wy-image-grid-more - Overlay on the last image in the limited span.
 *
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested.
 */
@customElement("wy-image-grid")
export class WyImageGrid extends LitElement {
  static override styles = [imageGridCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Array of images to display. Displays an overflow graphic on the last image in the limited span.
   */
  @property({ attribute: false })
  images: FileType[] = [];

  /**
   * The maximum number of images to display. The last image will get an graphic overlay indication there is more.
   *
   * Set to `Infinity` to disable the limit.
   */
  @property({ type: Number })
  limit: number = 3;

  /**
   * Display the image grid with outer styling.
   */
  @property({ type: Boolean, reflect: true })
  outer: boolean = false;

  /**
   * Dispatch a `file-open` event.
   *
   * @internal
   * @param e - Event that will be prevented.
   * @param file - The file to open.
   */
  dispatchFileOpen(e: MouseEvent, file: FileType) {

    // check for ctrl, meta or middle click
    if (isModifiedClick(e)) {
      e.stopPropagation();
      return;
    }    
    
    e.preventDefault();
    
    if (!file.is_trashed) {
      const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
      this.dispatchEvent(event);
    }
  }

  override render() {
    const more = this.images.length > this.limit ? this.images.length - this.limit : 0;
    const images = this.images.slice(0, this.limit);

    return html`
      <div
        part=${partMap({
          "wy-image-grid": true,
          "wy-image-grid-outer": this.outer,
        })}
      >
        ${images.map((a: FileType, idx: number) => {
          const isIcon = !a.width || a.width <= MAX_ICON_SIZE || !a.height || a.height <= MAX_ICON_SIZE;
          const ratio = a.width && a.height ? a.width / a.height : 1;
          const baseSize = 64;
          const flexRatio = ratio.toPrecision(5);
          const flexBasis = (ratio * baseSize).toPrecision(5) + "px";
          const padding = isIcon ? baseSize + "px" : (100 / ratio).toPrecision(5) + "%";
          const intrinsicWidth = a.width + "px";
          const fullWidth = this.images.length !== 2 && idx === 0;
          // display original file for gif and svg
          const ext = getExtension(a.name);
          const imageSrc = ext === ".gif" || ext === ".svg" ? a.download_url : a.preview_url;

          return imageSrc
            ? html`
                <a
                  href="${a.download_url ?? "#"}"
                  @click=${(e: MouseEvent) => {
                    !e.defaultPrevented && this.dispatchFileOpen(e, a);
                  }}
                  part=${partMap({
                    "wy-image": true,
                    "wy-image-filled": true,
                    "wy-image-full-width": fullWidth,
                  })}
                  style=${styleMap({
                    flexBasis: flexBasis,
                    flexGrow: flexRatio,
                    flexShrink: flexRatio,
                    width: intrinsicWidth,
                    backgroundImage: `linear-gradient(var(--wy-shade-invert, rgba(255,255,255,0.15))), url(${imageSrc}), linear-gradient(var(--wy-shade-opaque, white));`,
                  })}
                >
                  <div part="wy-image-area" style=${styleMap({ paddingBottom: padding })}>
                    <img
                      part=${partMap({ "wy-image-content": true, "wy-image-icon": isIcon })}
                      src=${imageSrc}
                      ${ref(checkImageLoad)}
                      @load=${imageLoaded}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    ${idx === images.length - 1 && more ? html`<span part="wy-image-grid-more">+${more}</span>` : ``}
                  </div>
                </a>
              `
            : nothing;
        })}
      </div>
    `;
  }
}
