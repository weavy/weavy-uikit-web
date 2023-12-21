import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { ifDefined } from "lit/directives/if-defined.js";

import "./wy-spinner";
import "./wy-preview-icon";

import allCss from "../scss/all.scss";
import { codecError, mediaError, mediaLoaded } from "../utils/media";

@customElement("wy-preview-media")
export class WyPreviewMedia extends LitElement {
  
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property()
  format: string = "";

  @property()
  src!: string;

  @property()
  name: string = "";

  @property()
  mediaType?: string;

  mediaElement?: HTMLMediaElement;

  registerLoading(mediaElement: Element | undefined) {
    this.unregisterLoading();

    if (mediaElement) {
      this.mediaElement = mediaElement as HTMLMediaElement;

      mediaElement.classList.add("wy-loading");

      mediaElement.addEventListener("error", mediaError, true); // needs capturing
      mediaElement.addEventListener("loadedmetadata", mediaLoaded, true); // needs capturing
      mediaElement.addEventListener("loadedmetadata", codecError, true); // needs capturing
    }
  }

  unregisterLoading() {
    if (this.mediaElement) {
      // cleanup
      this.mediaElement.pause();
      this.mediaElement.removeAttribute("autoplay");
      this.mediaElement.setAttribute("preload", "none");

      this.mediaElement.removeEventListener("error", mediaError, true); // needs capturing
      this.mediaElement.removeEventListener("loadedmetadata", mediaLoaded, true); // needs capturing
      this.mediaElement.removeEventListener("loadedmetadata", codecError, true); // needs capturing

      this.mediaElement = undefined;
    }
  }

  override render() {
    return this.format === "video"
      ? html`
          <video ${ref(this.registerLoading)} class="wy-content-video" controls crossorigin="use-credentials" autoplay>
            <source src=${this.src} type=${ifDefined(this.mediaType)} />
            <wy-preview-icon src=${this.src} icon="file-video"></wy-preview-icon>
          </video>
          <wy-spinner></wy-spinner>
        `
      : html`
          <audio ${ref(this.registerLoading)} class="wy-content-audio" controls crossorigin="use-credentials" autoplay>
            <source src=${this.src} type=${ifDefined(this.mediaType)} />
          </audio>
        `;
  }

  override disconnectedCallback() {
    this.unregisterLoading();
    super.disconnectedCallback();
  }
}
