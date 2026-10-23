import { html, nothing, TemplateResult, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getTextStreamFromResponse } from "../utils/data";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";
import type { BlobType, FileMutationContextType, FileType, MutateFileProps } from "../types/files.types";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import type { WyEditorFile } from "./wy-editor-file";
import { partMap } from "../utils/directives/shadow-part-map";
import { EditorChangeEventType, FileEditorSaveEventType } from "../types/editor.events";
import { MutationController } from "../controllers/mutation-controller";
import { getUpdateFileMutationOptions, MutateFileBlobVariables } from "../data/file-edit";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { getUploadBlobMutationOptions } from "../data/blob-upload";
import { getDraftOptions, getFileDraftKey, removeDraft } from "../data/drafts";
import { QueryController } from "../controllers/query-controller";
import type { EditorDraftType } from "../types/editor.types";
import { renderMarkdown } from "../utils/markdown-render";
import { highlightCodeAsHtml } from "../utils/code-highlight";
import type { DirectiveResult } from "lit/async-directive.js";

import colorModeCss from "../scss/color-modes.scss";
import contentCodeCss from "../scss/components/content-code.scss";
import contentTextCss from "../scss/components/content-text.scss";
import documentCss from "../scss/components/document.scss";
import codeCss from "../scss/components/code.scss";
import textCss from "../scss/components/text.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./wy-empty";
import "./ui/wy-progress-circular";
import "./ui/wy-container";
import "./wy-editor-file";
import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-badge";
import "./ui/wy-overlay";
import { Feature } from "../types/features.types";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-view-text": WyFileViewText;
  }
}

/**
 * Text / code / HTML preview component used in file previews.
 *
 * **Used sub components:**
 *
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 *
 * @csspart wy-content-progress - Progress indicator shown while loading.
 * @csspart wy-content-code - Container for rendered code content.
 * @csspart wy-code - Modifier for code styling.
 * @csspart wy-document - Document wrapper used for HTML/text rendering.
 * @csspart wy-content-html - Container for rendered HTML.
 * @csspart wy-content-text - Container for plain text content.
 *
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-file-view-text")
export class WyFileViewText extends WeavySubAppComponent {
  static override styles = [
    colorModeCss,
    textCss,
    contentTextCss,
    contentCodeCss,
    documentCss,
    codeCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Source file.
   */
  @property({ attribute: false })
  file?: FileType;

  @property({ type: Boolean })
  edit: boolean = false;

  /**
   * Show the unsaved draft instead of the stored content. Ignored while editing, since the editor loads the draft itself.
   */
  @property({ type: Boolean })
  draft: boolean = false;

  /**
   * Query controller for the unsaved draft shown when `draft` is set.
   * @internal
   */
  private draftQuery = new QueryController<EditorDraftType>(this);

  @state()
  display: "text" | "code" | "document" = "text";

  /**
   * The unsaved draft rendered as HTML (markdown and highlighted code). Kept apart from the stored HTML so that
   * switching between the draft and a stored version is just a matter of which one `render()` picks.
   * @internal
   */
  @state()
  draftHtml?: string;

  /**
   * The draft text that `draftHtml` was rendered from, used to skip re-rendering and to drop stale renders.
   * @internal
   */
  #draftRenderedText?: string;

  /**
   * Id used for handling drafts.
   * @internal
   */
  @state()
  draftKey?: string;

  /**
   * Cached string content produced by the latest fetch.
   *
   * @internal
   */
  @state()
  text?: string;

  /**
   * Cached string content produced by the latest fetch.
   *
   * @internal
   */
  @state()
  fileContent?: string;

  /**
   * Content formatted as HTML.
   * @internal
   */
  @state()
  html?: string;

  /**
   * Loading indicator flag while fetching file content.
   *
   * @internal
   */
  @state()
  loadingText = false;

  /**
   * Loading indicator flag while fetching preview content.
   *
   * @internal
   */
  @state()
  loadingHtml = false;

  /**
   * Reference to the content DOM node wrapper.
   *
   * @internal
   */
  protected contentRef: Ref<HTMLElement> = createRef();

  /**
   * Reference to the editor DOM node wrapper.
   *
   * @internal
   */
  protected editorRef: Ref<WyEditorFile> = createRef();

  /**
   * Identifies the loaded revision and representation independently of mutable query-cache file objects.
   */
  private contentKey?: string;

  /**
   * Prevents an older content response from overwriting a newer revision or representation.
   */
  private contentRequest = 0;

  /**
   * Puts focus to the editor if available.
   */
  setFocus() {
    if (this.edit) {
      void this.editorRef.value?.focusInput();
    }
  }

  /**
   * Dispatches the `file-preview-loaded` event when content becomes available.
   *
   * @internal
   * @returns {boolean} `true` if the event was not canceled.
   */
  protected dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded");
    return this.dispatchEvent(event);
  }

  /**
   * Publishes the current text edit, or the unsaved draft when called outside the editor (from the preview menu).
   */
  async save() {
    await this.updateComplete;
    if (!this.weavy || !this.draftKey || !this.file) {
      return;
    }

    const draftText = this.weavy.queryClient.getQueryData<EditorDraftType>(["draft", this.draftKey])?.text;
    // The editor holds the latest text while editing. Outside the editor only a stored draft can be published;
    // the loaded file content alone is nothing new, so there is nothing to do without a draft.
    const text = this.edit ? ((await this.editorRef.value?.getText()) ?? draftText ?? this.text) : draftText;
    if (text === undefined) {
      if (!this.edit) {
        return;
      }
      throw new Error("File content is not loaded");
    }

    const file = new File([text], this.file.name, { type: this.file.media_type });
    const blob = await this.uploadBlobMutation.mutate({ file });
    const published = await this.updateFileMutation.mutate({ file: this.file, blob });
    // The mutation updates the file in the query cache before this call returns, so a host (the preview, the file
    // block) may already have pushed the published revision into this view and started loading its preview. Drop
    // every in-flight read, whether for the previous revision or that early load, and force one fresh load of the
    // published revision below; the content key check would otherwise treat it as already loading and nothing would
    // ever apply, leaving the view waiting forever. The published text stays until the new preview is ready.
    this.contentRequest++;
    this.contentKey = undefined;
    this.text = text;
    this.fileContent = text;
    this.html = undefined;
    this.file = published;
    this.requestUpdate("file");
    removeDraft(this.weavy, this.draftKey);
  }

  /** @internal */
  private uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>(this);

  /**
   * Mutation handling rename requests.
   * @internal
   */
  private updateFileMutation = new MutationController<
    FileType,
    Error,
    MutateFileBlobVariables,
    FileMutationContextType
  >(this);

  protected override willUpdate(changedProperties: PropertyValueMap<this>) {
    super.willUpdate(changedProperties);

    if (changedProperties.has("edit") && changedProperties.get("edit") && !this.edit) {
      this.text = this.fileContent;
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("user")) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      void this.uploadBlobMutation.trackMutation(getUploadBlobMutationOptions(this.weavy, this.user, this.app.id));
      void this.updateFileMutation.trackMutation(getUpdateFileMutationOptions(this.weavy, this.app));
    }

    if ((changedProperties.has("weavy") || changedProperties.has("file")) && this.weavy) {
      this.draftKey = this.file ? getFileDraftKey(this.file) : undefined;
    }

    if ((changedProperties.has("weavy") || changedProperties.has("draft") || changedProperties.has("draftKey")) && this.weavy) {
      if (this.draft && this.draftKey) {
        void this.draftQuery.trackQuery(getDraftOptions(this.weavy, this.draftKey));
      } else {
        this.draftQuery.untrackQuery();
      }
    }

    // TODO: Change the async loading into infinite scrolling

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("file") ||
        changedProperties.has("edit") ||
        changedProperties.has("componentFeatures")) &&
      this.weavy &&
      this.file
    ) {
      let previewSrc = this.file.preview_url;
      let fileSrc = this.file.download_url;

      // Check if preview src is virtual
      if (previewSrc && /^(?:blob:|data:)/.test(previewSrc)) {
        if (!fileSrc) {
          fileSrc = previewSrc;
        }
        previewSrc = undefined;
      }

      if (this.file.preview_format === "code") {
        this.display = "code";
      } else if (this.file.preview_format === "html") {
        // Formatted text
        this.display = "document";
      } else {
        // Raw text
        this.display = "text";
      }

      const renderHtml = Boolean(
        previewSrc &&
        this.display !== "text" &&
        !(this.componentFeatures?.allowsFeature(Feature.FileEdit) && this.edit)
      );
      const contentKey = JSON.stringify([this.file.id, this.file.rev, renderHtml ? previewSrc : fileSrc, renderHtml]);
      if (contentKey === this.contentKey) {
        return;
      }

      this.contentKey = contentKey;
      const contentRequest = ++this.contentRequest;
      this.loadingHtml = false;
      this.loadingText = false;
      this.html = undefined;

      if (renderHtml && previewSrc) {
        this.loadingHtml = true;
        void this.weavy
          .fetchFile(previewSrc)
          .then(getTextStreamFromResponse)
          // Create a new response out of the stream
          .then((stream) => new Response(stream))
          // Create an object URL for the response
          .then((response) => response.text())
          .then((html) => {
            if (contentRequest !== this.contentRequest) {
              return;
            }
            this.loadingHtml = false;
            this.html = html;
            this.dispatchLoaded();
          });
      } else if (fileSrc) {
        this.loadingText = true;

        void this.weavy
          .fetchFile(fileSrc)
          .then(getTextStreamFromResponse)
          // Create a new response out of the stream
          .then((stream) => new Response(stream))
          // Create an object URL for the response
          .then((response) => response.text())
          .then((text) => {
            if (contentRequest !== this.contentRequest) {
              return;
            }
            this.loadingText = false;
            this.text = text;
            this.fileContent = text;
            this.dispatchLoaded();
            return text;
          });
      }
    }

    // The server only renders stored content, so a draft is rendered locally: markdown to HTML and code to
    // highlighted HTML. While editing, the editor holds the draft itself and no render is needed.
    const draftText = this.draft && !this.edit ? this.draftQuery.result?.data?.text : undefined;
    const draftFile = this.file;
    if (draftText !== undefined && draftFile && draftText !== this.#draftRenderedText) {
      this.#draftRenderedText = draftText;
      this.draftHtml = undefined;

      const rendering =
        draftFile.media_type === "text/markdown"
          ? renderMarkdown(draftText)
          : this.display === "code"
            ? highlightCodeAsHtml(draftText, draftFile.name)
            : undefined;

      void rendering?.then((rendered) => {
        // Drop the render if the draft changed in the meantime
        if (this.#draftRenderedText === draftText) {
          this.draftHtml = rendered;
        }
      });
    }
  }

  /**
   * Renders the content to show, either the stored file content or the unsaved draft.
   *
   * @param content - Raw text, shown as is for plain text and while a markdown draft is being rendered.
   * @param contentHtml - Rendered HTML, used for documents and server-highlighted code.
   * @param isDraft - Whether the content is the unsaved draft rather than stored content.
   */
  protected renderText(
    content?: string,
    contentHtml?: string,
    isDraft: boolean = false,
  ): TemplateResult | DirectiveResult | string {
    // A code draft is rendered in the same pre/code structure as the server-highlighted code, with the locally
    // highlighted HTML once it is ready and the raw text until then (or when no language matches the file)
    if (isDraft && this.display === "code" && content !== undefined) {
      return html`<pre><code>${contentHtml !== undefined ? unsafeHTML(contentHtml) : content}</code></pre>`;
    }

    return (this.display === "text" || (isDraft && contentHtml === undefined)) && content !== undefined
      ? content
      : contentHtml !== undefined
        ? unsafeHTML(contentHtml)
        : html` <wy-empty><wy-progress-circular indeterminate padded></wy-progress-circular></wy-empty> `;
  }

  override render() {
    const mode = "light";

    // Show the unsaved draft instead of the stored content when selected. While editing, the editor holds the draft.
    const draftText = this.draft && !this.edit ? this.draftQuery.result?.data?.text : undefined;
    const isDraft = draftText !== undefined;
    const content = isDraft ? draftText : this.text;
    const contentHtml = isDraft ? this.draftHtml : this.html;

    const wrapperParts = {
      "wy-light": this.display !== "code" && mode === "light",
      "wy-document": this.display !== "code",
    };

    const codeParts = {
      "wy-code": this.display === "code" && contentHtml !== undefined,
    };

    const contentParts = {
      "wy-content-html": this.display === "document" && contentHtml !== undefined,
      "wy-content-text": this.display === "text" && content !== undefined,
    };

    const contentCodeParts = {
      "wy-content-code": this.display === "code",
    };

    return html`
      <wy-container fill overflow @click=${() => this.setFocus()}>
          ${
            (this.loadingText && this.text === undefined && this.html !== undefined) ||
            (this.loadingHtml && this.text !== undefined && this.html === undefined)
              ? html`<wy-progress-circular overlay part="wy-content-progress" indeterminate></wy-progress-circular>`
              : nothing
          }
          ${
            this.componentFeatures?.allowsFeature(Feature.FileEdit) && this.edit
              ? html`
                  <wy-editor-file
                    ${ref(this.editorRef)}
                    .draft=${true}
                    .text=${this.text || ""}
                    .fileContent=${this.fileContent}
                    .file=${this.file}
                    .mode=${this.display !== "code" && mode === "light" ? "light" : "auto"}
                    .appearance=${this.display}
                    @change=${(e: EditorChangeEventType) => {
                      this.text = e.detail.text;
                    }}
                    @save=${(_e: FileEditorSaveEventType) => {
                      void this.save();
                    }}
                    ><div slot="dummy" part=${partMap({ ...contentParts, ...codeParts })}
                      >${this.renderText(content, contentHtml, isDraft)}</div
                    ></wy-editor-file
                  >
                `
              : html`
                  <div
                    ${ref(this.contentRef)}
                    part=${partMap({ ...wrapperParts, ...codeParts, ...contentParts, ...contentCodeParts })}
                    >${this.renderText(content, contentHtml, isDraft)}</div
                  >
                `
          }
        </div>
      </wy-container>
    `;
  }

  override updated(changedProperties: PropertyValueMap<this>) {
    super.updated(changedProperties);

    if (changedProperties.has("loadingText") && changedProperties.get("loadingText") && !this.loadingText) {
      void this.editorRef.value?.focusInput();
    }
  }
}
