import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { FileType } from "../types/files.types";
import { FileOpenEventType } from "../types/files.events";
import { fileSizeAsString, getExtension, getIcon, getKind, getProvider } from "../utils/files";
import { NamedEvent } from "../types/generic.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import hostContentCss from "../scss/host-contents.scss";

import "./base/wy-icon";
import "./base/wy-button";

/**
 * List of annotations. Displayed as inline buttons.
 * 
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 * @cssPart wy-annotations - Wrapper for the annotations.
 * @cssPart wy-annotation - Annotation button.
 * @cssPart wy-annotation-icon - The icon of the annotation button.
 * @cssPart wy-annotation-text - The text of the annotation button.
 */
@customElement("wy-annotations-list")
export default class WyAttachmentsList extends WeavySubComponent {
  static override styles = [hostContentCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * The annotations file list to display.
   */
  @property({ attribute: false })
  files: FileType[] = [];

  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
    return this.dispatchEvent(event);
  }

  override render() {
    if (this.settings?.annotations === "none") {
      return nothing;
    }

    return html`
      <div part="wy-annotations">
        ${this.files.map((a: FileType) => {
          const fileSize = a.size && a.size > 0 ? fileSizeAsString(a.size) : null;
          const ext = getExtension(a.name);
          const { icon } = getIcon(a.name);
          const kind = getKind(a.name);
          const provider = getProvider(a.provider);
          const title = `${a.name}${fileSize ? ` • ${fileSize}` : ''}`;

          return html`
            <wy-button
              part="wy-annotation"
              @click=${(e: Event) => {
                !e.defaultPrevented && !a.is_trashed && this.dispatchFileOpen(e, a);
              }}
              kind="filled"
              small
              title=${title}
            >
              <wy-icon part="wy-annotation-icon" name=${icon} .overlayName=${provider} size="24" kind=${kind} ext=${ext}></wy-icon>
              <span part="wy-annotation-text">${a.name}</span>
            </wy-button>
          `;
        })}
      </div>
    `;
  }
}
