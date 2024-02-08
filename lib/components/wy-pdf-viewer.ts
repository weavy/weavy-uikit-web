import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";

import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import allCss from "../scss/all.scss";

import pdfjsLib, { type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist";
import { PDFViewer, EventBus, PDFFindController, PDFLinkService } from "pdfjs-dist/web/pdf_viewer";

import "./wy-button";
import "./wy-icon";
import { inputConsumeWithBlurOnEscape } from "../utils/keyboard";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-pdf-viewer")
@localized()
export default class WyPdfViewer extends LitElement {
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  DEFAULT_SCALE_DELTA = 1.1;
  MAX_SCALE = 3.0;
  MIN_SCALE = 0.2;

  SEARCH_FOR = ""; // This should be a property
  ENABLE_XFA = true;

  // Some PDFs need external cmaps.
  CMAP_URL?: URL;
  CMAP_PACKED = true;

  WORKER_URL?: URL;

  @property()
  src!: string;

  pageNumberRef: Ref<HTMLInputElement> = createRef<HTMLInputElement>();
  totalPagesRef: Ref<HTMLSpanElement> = createRef<HTMLSpanElement>();
  zoomLevelRef: Ref<HTMLInputElement> = createRef<HTMLInputElement>();

  viewerContainerRef = createRef<HTMLDivElement>();

  @state()
  pdfViewer?: PDFViewer;

  pdfEventBus: EventBus = new EventBus();
  pdfLinkService: PDFLinkService = new PDFLinkService({
    eventBus: this.pdfEventBus,
  });
  pdfFindController: PDFFindController = new PDFFindController({
    eventBus: this.pdfEventBus,
    linkService: this.pdfLinkService,
  });

  private loadingTask?: PDFDocumentLoadingTask;

  setScale(scale: number | string) {
    //console.debug("setScale:", scale)
    this.pdfViewer!.currentScaleValue = typeof scale === "number" ? scale.toFixed(2) : scale;
  }

  setPage(pageNumber: number) {
    //console.debug("setPage:", pageNumber)
    this.pdfViewer!.currentPageNumber = pageNumber;
  }

  updatePage() {
    //console.debug("updatePage");
    if (this.pdfViewer && this.pageNumberRef.value) {
      const pageNumber = parseInt(this.pageNumberRef.value.value);

      if (isNaN(pageNumber)) {
        this.setPage(this.pdfViewer.currentPageNumber);
      } else if (pageNumber > this.pdfViewer.pagesCount) {
        this.setPage(this.pdfViewer.pagesCount);
      } else if (pageNumber <= 0) {
        this.setPage(1);
      } else {
        this.setPage(pageNumber);
      }
    }
  }

  select(e: Event) {
    //console.debug("select");
    const input = e.target as EventTarget as HTMLInputElement;
    if (input) {
      input.setSelectionRange(0, input.value.length);
    }
  }

  fitToPage() {
    this.setScale("page-fit");
  }

  fitToWidth() {
    this.setScale("page-width");
  }

  zoomIn() {
    //console.debug('zoomIn')

    if (this.pdfViewer) {
      let newScale = this.pdfViewer.currentScale;
      let steps = 1;
      do {
        newScale = newScale * this.DEFAULT_SCALE_DELTA;
        newScale = Math.floor(newScale * 10) / 10;
        newScale = Math.min(this.MAX_SCALE, newScale);
      } while (--steps > 0 && newScale < this.MAX_SCALE);

      this.setScale(newScale);
    }
  }

  zoomOut() {
    //console.debug("zoomOut");
    if (this.pdfViewer) {
      let newScale = this.pdfViewer.currentScale;
      let steps = 1;
      do {
        newScale = newScale / this.DEFAULT_SCALE_DELTA;
        newScale = Math.floor(newScale * 10) / 10;
        newScale = Math.max(this.MIN_SCALE, newScale);
      } while (--steps > 0 && newScale > this.MIN_SCALE);

      this.setScale(newScale);
    }
  }

  updateZoom() {
    //console.debug("updateZoom");
    if (this.pdfViewer && this.zoomLevelRef.value) {
      const zoomValue = parseFloat(this.zoomLevelRef.value.value.replace("%", ""));
      if (isNaN(zoomValue)) {
        this.setScale(this.pdfViewer.currentScale + 0.0001);
      } else {
        this.setScale(zoomValue / 100);
      }
    }
  }

  clearDocument() {
    try {
      this.loadingTask?.destroy();
      //console.debug("loadingTask cleanup", loadingTask)
    } catch (e) {
      /* No worries */
    }

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore due to incorrect param type def?
      this.pdfViewer?.setDocument(null);
    } catch (e) {
      /* No worries */
    }

    try {
      this.pdfLinkService.setDocument(null, null);
    } catch (e) {
      /* No worries */
    }
  }

  override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      if (!this.WORKER_URL) {
        this.WORKER_URL = new URL("/js/pdf.worker.min.js", this.weavyContext.url);
        // Setting worker path to worker bundle.
        pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_URL.toString();
      }

      if (!this.CMAP_URL) {
        this.CMAP_URL = new URL("/cmaps/", this.weavyContext.url);
      }
    }
  }

  override update(changedProperties: PropertyValues<this & WeavyContextProps>) {
    super.update(changedProperties);

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("src") || changedProperties.has("pdfViewer")) &&
      this.weavyContext &&
      this.src &&
      this.pdfViewer
    ) {
      this.loadingTask = pdfjsLib.getDocument({
        url: this.src,
        enableXfa: this.ENABLE_XFA,
        cMapUrl: this.CMAP_URL?.toString() || "",
        cMapPacked: this.CMAP_PACKED,
      });

      this.loadingTask.promise.then((doc: PDFDocumentProxy) => {
        //console.log("LOADED PDF", src);

        this.pdfViewer!.setDocument(doc);
        this.pdfLinkService.setDocument(doc, null);
      });
    }
  }

  override updated() {
    //console.log('wy-pdf-viewer updated', this.viewerContainerRef.value, this.pdfViewer)
    if (this.weavyContext && this.viewerContainerRef.value && !this.pdfViewer) {
      // INIT PDF VIEWER
      //console.log("new pdf viewer", this.viewerContainerRef.value)

      // @ ts-ignore due to incorrect type def?
      this.pdfViewer = new PDFViewer({
        container: this.viewerContainerRef.value,
        eventBus: this.pdfEventBus,
        linkService: this.pdfLinkService,
        findController: this.pdfFindController,
        annotationEditorMode: pdfjsLib.AnnotationEditorType.DISABLE,
        //defaultZoomValue: 1.0,
        //scriptingManager: pdfScriptingManager,
        //enableScripting: true, // Only necessary in PDF.js version 2.10.377 and below.
      });
      //pdfViewer!.MAX_AUTO_SCALE = 1.0;

      this.pdfLinkService.setViewer(this.pdfViewer);

      this.pdfEventBus.on("scalechanging", () => {
        //console.debug("scalechanging")
        this.zoomLevelRef.value!.value = Math.round(this.pdfViewer!.currentScale * 100).toFixed(0) + "%";
      });

      this.pdfEventBus.on("pagechanging", () => {
        //console.debug("pagechanging")
        this.pageNumberRef.value!.value = this.pdfViewer!.currentPageNumber.toFixed(0);
      });

      this.pdfEventBus.on("pagesinit", () => {
        // We can use pdfViewer now, e.g. let's change default scale.
        if (this.isConnected) {
          this.pdfViewer!.currentScaleValue = "auto";
          this.pageNumberRef.value!.value = "1";
          this.totalPagesRef.value!.innerText = this.pdfViewer!.pagesCount.toFixed(0);

          // We can try searching for things.
          if (this.SEARCH_FOR) {
            if (this.pdfFindController && !("_onFind" in this.pdfFindController)) {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore due to missing type def
              this.pdfFindController.executeCommand("find", { query: this.SEARCH_FOR });
            } else {
              this.pdfEventBus.dispatch("find", { type: "", query: this.SEARCH_FOR });
            }
          }
        }
      });
    }
  }

  override render() {
    //console.log("wy-pdf-viewer render")
    return html`
      <div class="wy-content-pdf">
        <div class="wy-toolbars-bottom">
          <nav class="wy-toolbar wy-toolbar-center">
            <div class="wy-toolbar-buttons">
              <input
                type="text"
                class="wy-input"
                ${ref(this.pageNumberRef)}
                @keyup=${inputConsumeWithBlurOnEscape}
                @change=${this.updatePage}
                @click=${this.select}
                data-pdf-target="pageNumber"
              />
              <span class="wy-toolbar-text">/</span>
              <span class="wy-toolbar-text" ${ref(this.totalPagesRef)}>1</span>
            </div>
            <div class="wy-toolbar-buttons">
              <button class="wy-button wy-button-icon btn-zoom-out" @click=${this.zoomOut} title=${msg("Zoom out")}
                ><wy-icon name="minus"></wy-icon
              ></button>
              <input
                type="text"
                class="wy-input"
                ${ref(this.zoomLevelRef)}
                @keyup=${inputConsumeWithBlurOnEscape}
                @change=${this.updateZoom}
                @click=${this.select}
                value="100%"
                data-pdf-target="zoomLevel"
              />
              <button class="wy-button wy-button-icon btn-zoom-in" @click=${this.zoomIn} title=${msg("Zoom in")}
                ><wy-icon name="plus"></wy-icon
              ></button>
            </div>
            <div class="wy-toolbar-buttons">
              <button
                class="wy-button wy-button-icon btn-fit-page"
                @click=${this.fitToWidth}
                title=${msg("Fit to width")}
                ><wy-icon name="fit-width"></wy-icon
              ></button>
              <button class="wy-button wy-button-icon" @click=${this.fitToPage} title=${msg("Fit to screen")}
                ><wy-icon name="fit-screen"></wy-icon
              ></button>
            </div>
          </nav>
        </div>
        <div ${ref(this.viewerContainerRef)} class="wy-pdf-container">
          <div id="viewer" class="pdfViewer"></div>
        </div>
      </div>
    `;
  }

  override disconnectedCallback() {
    try {
      this.clearDocument();
      this.pdfViewer?.cleanup();
    } catch (e) {
      /* No worries */
    }

    this.pdfViewer = undefined;

    super.disconnectedCallback();
  }
}
