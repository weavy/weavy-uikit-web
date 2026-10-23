import { html, nothing, type TemplateResult, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import throttle from "lodash.throttle";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { MetadataType } from "../types/lists.types";
import { EditorDraftType } from "../types/editor.types";
import type { EditorChangeEventType, FileEditorSaveEventType } from "../types/editor.events";
import type { NamedEvent } from "../types/generic.types";
import { onlyValues } from "../utils/data";
import { partMap } from "../utils/directives/shadow-part-map";
import type { FileType } from "../types/files.types";
import {
  hasMdFormat,
  mdBold,
  mdItalic,
  mdQuote,
  mdHeading,
  mdListOL,
  mdListUL,
  mdCode,
  mdCodeBlock,
  mdLink,
  mdImage,
} from "../utils/editor/commands-markdown";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { ThemeModeType } from "../types/ui.types";
import { getDraftOptions, getFileDraftKey, removeDraft, saveDraft } from "../data/drafts";
import { QueryController } from "../controllers/query-controller";

import colorModeCss from "../scss/color-modes.scss";
import rebootCss from "../scss/reboot.scss";
import contentCodeCss from "../scss/components/content-code.scss";
import contentTextCss from "../scss/components/content-text.scss";
import toolbarCss from "../scss/components/toolbar.scss";
import documentCss from "../scss/components/document.scss";
import codeCss from "../scss/components/code.scss";
import fileEditorStyles from "../scss/components/editor-file.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-avatar";
import "./ui/wy-dropdown";
import "./ui/wy-button";
import "./ui/wy-icon";
import "./wy-editor-core";
import { WyEditorCore } from "./wy-editor-core";
import "./ui/wy-overlay";
import "./ui/wy-container";
import "./ui/wy-progress-circular";
import "./wy-empty";

declare global {
  interface HTMLElementTagNameMap {
    "wy-editor-file": WyEditorFile;
  }
}

let markdown: typeof import("@logue/markdown-wasm");
let markdownIsLoading = false;

/**
 * Rich text editor used for posts, messages and comments.
 *
 * **Used sub components:**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @csspart wy-editor - Root editor container
 * @csspart wy-editor-msg-inputs - Container for inputs/buttons
 * @csspart wy-editor-msg-buttons - Container for action buttons
 *
 * @fires {MsgEditorSubmitEventType} submit - Emitted when the editor content is submitted
 * @fires {CustomEvent} edit-last - Emitted when the last message should be edited.
 */
@customElement("wy-editor-file")
@localized()
export class WyEditorFile extends WeavySubAppComponent {
  static override styles = [
    colorModeCss,
    rebootCss,
    hostContentsCss,
    documentCss,
    codeCss,
    contentTextCss,
    contentCodeCss,
    toolbarCss,
    fileEditorStyles,
  ];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Whether the editor is disabled.
   */
  @property({ type: Boolean })
  disabled: boolean = false;

  /**
   * Parent id for context (message/comment/post).
   */
  @property({ attribute: false })
  parentId?: number;

  /**
   * Placeholder text for the editor input.
   */
  @property()
  placeholder: string = "";

  /**
   * Initial editor text content (draft or loaded content).
   */
  @property({ attribute: false })
  text: string = "";

  /**
   * The file info if applicable. Required for full functionality.
   */
  @property({ attribute: false })
  file?: FileType;

  /**
   * Current file text content (loaded content).
   */
  @property({ attribute: false })
  fileContent?: string;

  /**
   * Optionally display the editor as a code editor or as a document layout.
   */
  @property()
  appearance: "default" | "code" | "document" | "text" = "default";

  /** Override the theme mode. */
  @property()
  mode: ThemeModeType = "auto";

  /**
   * Metadata associated with the editor content (e.g. agent instructions).
   *
   */
  @property({ type: Object })
  metadata?: MetadataType = {};

  /**
   * Text for the submit button.
   */
  @property()
  buttonText: string = "";

  /**
   * Whether this instance should persist drafts.
   */
  @property({ type: Boolean })
  draft: boolean = false;

  /**
   * Id used for handling drafts.
   * @internal
   */
  @state()
  draftKey?: string;

  /**
   * Initial draft text.
   */
  @state()
  draftText?: string;

  /**
   * Reactive state for markdown loading.
   */
  @state()
  get markdownIsLoading() {
    return markdownIsLoading;
  }

  /**
   * Query controller for getting file draft.
   * @internal
   */
  private draftQuery = new QueryController<EditorDraftType>(this);

  /**
   * Select all content in the editor.
   */
  async selectAllContent() {
    await this.whenEditor();
    await this.editorRef.value?.selectAllContent();
  }

  /**
   * Place cursor at the end of the editor content.
   */
  async setCursorFirst() {
    await this.whenEditor();
    await this.editorRef.value?.setCursorFirst();
  }

  /**
   * Place cursor at the end of the editor content.
   */
  async setCursorLast() {
    await this.whenEditor();
    await this.editorRef.value?.setCursorLast();
  }

  /**
   * Focus the editor input.
   */
  async focusInput() {
    await this.whenEditor();
    await this.editorRef.value?.focusInput();
  }

  /**
   * Resolves when the editor is available.
   *
   * @returns {Promise<WyEditorCore>}
   */
  async whenEditor() {
    return await this.#whenEditor;
  }
  #resolveEditor?: (editor: WyEditorCore) => void;
  #whenEditor = new Promise<WyEditorCore>((r) => {
    this.#resolveEditor = r;
  });

  /**
   * Whether to show a live markdown preview in an overlay.
   */
  @property({ type: Boolean })
  showLive: boolean = false;

  /**
   * Markdown text rendered as a html string.
   */
  @state()
  liveRender?: Uint8Array<ArrayBufferLike> | string | null;

  /**
   * Reference to the editor DOM node wrapper.
   *
   * @internal
   */
  protected editorRef: Ref<WyEditorCore> = createRef();

  /**
   * Gets the displayed document, including restored drafts and edits not yet saved by the draft throttle.
   */
  async getText() {
    await this.updateComplete;
    return this.editor?.state.doc.toString() ?? this.draftText ?? this.text;
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavy") || changedProperties.has("file")) && this.weavy) {
      this.draftKey = this.file ? getFileDraftKey(this.file) : undefined;
      // Initialize before the async query subscription so a fast Publish cannot read the original text.
      this.draftText = this.draftKey
        ? this.weavy.queryClient.getQueryData<EditorDraftType>(["draft", this.draftKey])?.text
        : undefined;
    }

    if ((changedProperties.has("weavy") || changedProperties.has("draftKey")) && this.weavy) {
      if (this.draftKey) {
        await this.draftQuery.trackQuery(getDraftOptions(this.weavy, this.draftKey));
      } else {
        this.draftQuery.untrackQuery();
        this.draftText = undefined;
      }
    }

    if (!this.draftQuery.result.isPending) {
      this.draftText = this.draftQuery.result.data?.text;
    }

    if (changedProperties.has("draftText") && !this.draftText && this.fileContent) {
      // Set initial text when draft is removed
      this.text = this.fileContent;
    }
  }

  /**
   * Persist draft to storage if draft mode is enabled.
   *
   * Saves editor text, embeds, poll options and ongoing file uploads to localStorage.
   *
   * @internal
   */
  protected saveDraft() {
    if (!this.weavy || !this.draft || !this.draftKey) return;

    if (this.hasChanged() && !this.draftQuery.result.isPending) {
      const draft: EditorDraftType = {
        text: this.text,
        updatedAt: new Date().toUTCString(),
      };
      saveDraft(this.weavy, this.draftKey, draft);
      this.draftText = undefined;
    } else if (this.fileContent !== undefined && this.draftText === this.fileContent) {
      removeDraft(this.weavy, this.draftKey);
    }
  }

  /**
   * Submit the editor content by dispatching a `submit` event.
   *
   * Validates that there is content to submit and that no uploads/embeds are still processing.
   *
   * @internal
   */
  protected submit() {
    const text = this.text?.trim() ?? "";
    if (!text) {
      return;
    }

    const saveEvent: FileEditorSaveEventType = new (CustomEvent as NamedEvent)("save", {
      detail: { text },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(saveEvent);
  }
  /**
   * Reset the editor state after a successful submit.
   *
   * Clears editor content, removes pending uploads from the query cache and deletes the stored draft.
   *
   * @internal
   */
  protected resetEditor() {
    if (this.weavy && this.draftKey) {
      removeDraft(this.weavy, this.draftKey);
    }
    this.clearEditor();
  }

  /**
   * Clear the editor UI and internal state (text, embeds, attachments, metadata).
   *
   * @internal
   */
  protected clearEditor() {
    this.text = "";
    this.metadata = {};
  }

  /**
   * Checks if the editor has a dirty internal state (text, embeds, attachments, metadata).
   *
   * @internal
   */
  protected hasChanged() {
    return this.fileContent !== undefined && this.text !== this.fileContent;
  }

  /**
   * Throttled drafting saver to minimize writes.
   *
   * @internal
   */
  private throttledDrafting = throttle(
    () => {
      this.saveDraft();
    },
    500,
    { leading: true, trailing: true },
  );

  /**
   * Prevents trailing writes from recreating a draft after Publish or Discard removes the editor.
   */
  override disconnectedCallback() {
    this.throttledDrafting.cancel();
    super.disconnectedCallback();
  }

  /**
   * CodeMirror editor
   * @internal
   */
  @state()
  protected get editor() {
    return this.editorRef.value?.editor;
  }

  protected renderEditor(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return html`<wy-editor-core
      ${ref(this.editorRef)}
      appearance="full"
      .text=${this.draftText ?? this.text}
      .filename=${this.file?.name}
      ?disabled=${this.disabled}
      @loaded=${() => this.requestUpdate("editor")}
      @change=${(e: EditorChangeEventType) => {
        this.text = e.detail.text;
      }}
      @select=${() => this.requestUpdate("editor")}
      @submit=${(e: CustomEvent) => {
        e.preventDefault();
        this.submit();
      }}
      ><slot name="dummy"></slot
    ></wy-editor-core>`;
  }

  protected renderLiveView() {
    return this.markdownIsLoading
      ? html` <wy-empty><wy-progress-circular indeterminate padded></wy-progress-circular></wy-empty> `
      : unsafeHTML(this.liveRender?.toString());
  }

  protected renderTopSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return nothing;
  }

  protected renderMiddleSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    const cssParts = {
      "wy-light": this.mode === "light",
      "wy-code": this.appearance === "code",
      "wy-document": this.appearance === "document" || this.appearance === "text",
      "wy-content-text": this.appearance === "text",
      "wy-content-text-edit": this.appearance === "text",
    };

    const anyParts = Array.from(Object.values(cssParts)).some(onlyValues);

    return anyParts
      ? html`<div part=${partMap(cssParts)}>${this.showLive ? this.renderLiveView() : this.renderEditor()}</div>`
      : this.renderEditor();
  }

  /**
   * Render the bottom slot which aggregates lists (polls, meetings, file uploads, attachments, embeds).
   *
   * @internal
   */
  protected renderBottomSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    const isMarkdown = this.file?.media_type === "text/markdown";

    const inputDisabled = this.showLive;

    return [
      isMarkdown
        ? html`
            <div part="wy-editor-toolbar wy-toolbar-area">
              <nav part="wy-toolbar wy-toolbar-center">
                <div part="wy-toolbar-buttons">
                  <wy-dropdown
                    directionY="up"
                    title=${msg("Heading")}
                    ?active=${hasMdFormat(this.editor, "heading1", true)}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon
                      slot="button-content"
                      name=${hasMdFormat(this.editor, "heading1")
                        ? "format-h1"
                        : hasMdFormat(this.editor, "heading2")
                          ? "format-h2"
                          : hasMdFormat(this.editor, "heading3")
                            ? "format-h3"
                            : hasMdFormat(this.editor, "heading4")
                              ? "format-h4"
                              : hasMdFormat(this.editor, "heading5")
                                ? "format-h5"
                                : hasMdFormat(this.editor, "heading6")
                                  ? "format-h6"
                                  : "format-header"}
                    ></wy-icon>
                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "heading1")}
                      @click=${() => mdHeading(1, this.editor)}
                      >${msg("Heading 1")}</wy-dropdown-item
                    >
                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "heading2")}
                      @click=${() => mdHeading(2, this.editor)}
                      >${msg("Heading 2")}</wy-dropdown-item
                    >
                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "heading3")}
                      @click=${() => mdHeading(3, this.editor)}
                      >${msg("Heading 3")}</wy-dropdown-item
                    >
                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "heading4")}
                      @click=${() => mdHeading(4, this.editor)}
                      >${msg("Heading 4")}</wy-dropdown-item
                    >
                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "heading5")}
                      @click=${() => mdHeading(5, this.editor)}
                      >${msg("Heading 5")}</wy-dropdown-item
                    >
                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "heading6")}
                      @click=${() => mdHeading(6, this.editor)}
                      >${msg("Heading 6")}</wy-dropdown-item
                    >
                  </wy-dropdown>

                  <div part="wy-toolbar-divider"></div>

                  <wy-button
                    kind="icon"
                    title=${msg("Bold")}
                    @click=${() => mdBold(this.editor)}
                    ?active=${hasMdFormat(this.editor, "bold")}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon name="format-bold"></wy-icon>
                  </wy-button>
                  <wy-button
                    kind="icon"
                    title=${msg("Italic")}
                    @click=${() => mdItalic(this.editor)}
                    ?active=${hasMdFormat(this.editor, "italic")}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon name="format-italic"></wy-icon>
                  </wy-button>
                  <wy-button
                    kind="icon"
                    title=${msg("Code")}
                    @click=${() => mdCode(this.editor)}
                    ?active=${hasMdFormat(this.editor, "inlineCode")}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon name="code-braces"></wy-icon>
                  </wy-button>

                  <div part="wy-toolbar-divider"></div>

                  <wy-button
                    kind="icon"
                    title=${msg("Link")}
                    @click=${() => mdLink(this.editor)}
                    ?active=${hasMdFormat(this.editor, "link")}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon name="link-variant"></wy-icon>
                  </wy-button>
                  <wy-button
                    kind="icon"
                    title=${msg("Image")}
                    @click=${() => mdImage(this.editor)}
                    ?active=${hasMdFormat(this.editor, "image")}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon name="image-outline"></wy-icon>
                  </wy-button>

                  <div part="wy-toolbar-divider"></div>

                  <wy-dropdown
                    directionY="up"
                    title=${msg("List")}
                    ?active=${hasMdFormat(this.editor, "listUnordered", true)}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon
                      slot="button-content"
                      name=${hasMdFormat(this.editor, "listOrdered") ? "format-list-ordered" : "format-list-bulleted"}
                    ></wy-icon>

                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "listOrdered")}
                      @click=${() => mdListOL(this.editor)}
                      ><wy-icon name="numeric"></wy-icon> ${msg("Ordered list")}</wy-dropdown-item
                    >
                    <wy-dropdown-item
                      ?active=${hasMdFormat(this.editor, "listUnordered")}
                      @click=${() => mdListUL(this.editor)}
                    >
                      <wy-icon name="circle-medium"></wy-icon>
                      ${msg("Bullet list")}</wy-dropdown-item
                    >
                  </wy-dropdown>
                  <wy-button
                    kind="icon"
                    title=${msg("Quote")}
                    @click=${() => mdQuote(this.editor)}
                    ?active=${hasMdFormat(this.editor, "blockquote")}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon name="format-quote"></wy-icon>
                  </wy-button>
                  <wy-button
                    kind="icon"
                    title=${msg("Code block")}
                    @click=${() => mdCodeBlock(this.editor)}
                    ?active=${hasMdFormat(this.editor, "blockCode")}
                    ?disabled=${inputDisabled}
                  >
                    <wy-icon name="code-block-braces"></wy-icon>
                  </wy-button>

                  <div part="wy-toolbar-divider"></div>

                  <wy-button
                    slot="actions"
                    ?hidden=${!isMarkdown}
                    kind="icon"
                    title=${msg("Toggle preview")}
                    @click=${() => {
                      this.showLive = !this.showLive;
                    }}
                  >
                    <wy-icon-stack>
                      <wy-icon name="eye-outline" state ?active=${!this.showLive}></wy-icon>
                      <wy-icon name="eye" layer state ?active=${this.showLive}></wy-icon> </wy-icon-stack
                  ></wy-button>

                  <slot name="actions"></slot>
                </div>
              </nav>
            </div>
          `
        : nothing,
      this.renderLists(),
    ];
  }

  /**
   * Render the lists section (poll options, meetings, file uploads, attachments, embeds).
   *
   * @internal
   */
  protected renderLists(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected override render() {
    return html`
      <div
        part=${partMap({
          "wy-editor": true,
          "wy-editor-file": true,
          "wy-content-code": this.appearance === "code",
          "wy-content-code-edit": this.appearance === "code" && Boolean(this.editor),
        })}
      >
        ${this.renderTopSlot()} ${this.renderMiddleSlot()} ${this.renderBottomSlot()}
      </div>
    `;
  }

  override updated(changedProperties: PropertyValueMap<this>) {
    super.updated(changedProperties);

    const isMarkdown = this.file?.media_type === "text/markdown";

    if (this.editorRef.value) {
      this.#resolveEditor?.(this.editorRef.value);
    }

    if (
      (changedProperties.has("text") || changedProperties.has("file") || changedProperties.has("showLive")) &&
      isMarkdown &&
      this.showLive
    ) {
      if (!markdownIsLoading) {
        if (markdown) {
          this.liveRender = this.text !== undefined ? markdown.parse(this.text, { bytes: false }) : undefined;
        } else {
          markdownIsLoading = true;

          void import("@logue/markdown-wasm").then(async (markdownModule) => {
            await markdownModule.ready();
            markdown = markdownModule;
            markdownIsLoading = false;
            this.liveRender = this.text !== undefined ? markdown.parse(this.text, { bytes: false }) : undefined;
          });
          this.requestUpdate("markdownIsLoading");
        }
      }
    }

    if (changedProperties.has("text")) {
      this.throttledDrafting();
    }
  }
}
