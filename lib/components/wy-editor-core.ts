import { html, nothing, type TemplateResult, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { MentionsCompletion } from "../types/codemirror.types";
import { AccessType } from "../types/app.types";
import throttle from "lodash.throttle";
import type { UserType } from "../types/users.types";
import { inputBlurOnEscape, inputConsume } from "../utils/keyboard";
import type { EditorView, KeyBinding, ViewUpdate } from "@codemirror/view";
import type { Compartment, EditorState, Extension, Facet } from "@codemirror/state";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { desktop } from "../utils/browser";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { Feature } from "../types/features.types";
import type {
  EditorChangeEventType,
  EditorClearEventType,
  EditorSubmitEventType,
  EditorTypingEventType,
} from "../types/editor.events";
import type { NamedEvent } from "../types/generic.types";
import { partMap } from "../utils/directives/shadow-part-map";
import type { MembersResultType } from "../types/members.types";
import { DropFilesEventType } from "../types/files.events";
import { isPopoverPolyfilled } from "../utils/dom";
import { ifDefined } from "lit/directives/if-defined.js";

import rebootCss from "../scss/reboot.scss";
import hostContentsCss from "../scss/host-contents.scss";
import editorCss from "../scss/components/editor-core-cm.scss";
import coreEditorCss from "../scss/components/editor-core.scss";

import "./ui/wy-avatar";
import "./ui/wy-item";

declare global {
  interface HTMLElementTagNameMap {
    "wy-editor-core": WyEditorCore;
  }
}

/**
 * Rich text editor used for posts, messages and comments.
 *
 * **Used sub components:**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 *
 * @csspart wy-core-editor - Wrapper for the editor
 *
 * @fires {EditorSubmitEventType} submit - Emitted when the editor content is submitted
 * @fires {EditorTypingEventType} edit - Throttled event when the user is typing.
 * @fires {EditorEditEventType} edit - When an edit of a previous text is requested.
 * @fires {EditorChangeEventType} change - When the text changes.
 * @fires {EditorClearEventType} clear - When clearing of the editor is requested.
 * @fires {DropFilesEventType} drop-files - When files are pasted into the editor.
 */
@customElement("wy-editor-core")
export class WyEditorCore extends WeavySubAppComponent {
  static override styles = [rebootCss, editorCss, coreEditorCss, hostContentsCss];

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
   * Placeholder text for the editor input.
   */
  @property()
  placeholder: string = "";

  /**
   * Initial editor text content (draft or loaded content).
   */
  @property()
  text?: string = "";

  /**
   * Whether typing indicators should be emitted.
   */
  @property({ type: Boolean })
  typing: boolean = true;

  /**
   * Editor usage context, used to adjust behavior and styling.
   */
  @property()
  editorType: "messages" | "posts" | "comments" = "posts";

  /**
   * Select all content in the editor.
   *
   * @internal
   */
  async selectAllContent() {
    await this.whenEditor();
    this.editor?.dispatch({
      selection: {
        anchor: 0,
        head: this.editor.state.doc.length,
      },
    });
  }

  /**
   * Place cursor at the end of the editor content.
   *
   * @internal
   */
  async setCursorLast() {
    await this.whenEditor();
    this.editor?.dispatch({
      selection: {
        anchor: this.editor.state.doc.length,
        head: this.editor.state.doc.length,
      },
    });
  }

  /**
   * Focus the editor input.
   *
   * @internal
   */
  async focusInput() {
    await this.whenEditor();
    this.editor?.focus();
  }

  @state()
  showTooltips: boolean = false;

  /**
   * The active EditorView instance.
   *
   * @internal
   */
  @state()
  protected editor?: EditorView;

  /**
   * Resolves when the editor is available.
   *
   * @returns {Promise<EditorView>}
   */
  async whenEditor() {
    return await this.#whenEditor;
  }
  #resolveEditor?: (editor: EditorView) => void;
  #whenEditor = new Promise<EditorView>((r) => {
    this.#resolveEditor = r;
  });

  /**
   * Programmatic editor view instance and extensions.
   *
   * @internal
   */
  protected editorExtensions?: Extension[];

  /**
   * EditorView constructor reference (lazy loaded).
   *
   * @internal
   */
  protected EditorView?: typeof EditorView;

  /**
   * Compartment to toggle editable/readonly.
   *
   * @internal
   */
  protected editorEditable?: Compartment;

  /**
   * Compartment and facets used to manage the editor keymap.
   *
   * @internal
   */
  protected editorKeymap?: Compartment;
  protected keymapFacet?: Facet<readonly KeyBinding[], readonly (readonly KeyBinding[])[]>;
  protected keymaps?: {
    weavyEnterSendKeymap: KeyBinding[];
    weavyModifierEnterSendKeymap: KeyBinding[];
    weavyKeymap: KeyBinding[];
    defaultKeymap: KeyBinding[];
    historyKeymap: KeyBinding[];
  };

  /**
   * Placeholder compartment for dynamic placeholder extension.
   *
   * @internal
   */
  protected editorPlaceholder?: Compartment;
  protected placeholderExtension?: (content: string | HTMLElement | ((view: EditorView) => HTMLElement)) => Extension;

  /**
   * Reference to the editor DOM node wrapper.
   *
   * @internal
   */
  protected editorRef: Ref<HTMLElement> = createRef();
  protected editorInitialized: boolean = false;

  protected tooltipsRef: Ref<HTMLElement> = createRef();

  constructor() {
    super();
    this.addEventListener("keydown", inputBlurOnEscape);
    this.addEventListener("keyup", inputConsume);
  }

  override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (
      !changedProperties.has("text") &&
      ((changedProperties.has("weavy") && changedProperties.get("weavy") !== this.weavy) ||
        (changedProperties.has("app") && changedProperties.get("app")?.id !== this.app?.id) ||
        (changedProperties.has("user") && changedProperties.get("user")?.id !== this.user?.id)) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      // clear editor
      this.clear();
    }

    // set editor text if text property is update (from saved draft)
    if (changedProperties.has("text") && this.editor && this.editor.state.doc.toString() !== this.text) {
      this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: this.text } });
    }
  }

  protected override updated(changedProperties: PropertyValueMap<this>): void {
    if (
      (changedProperties.has("weavy") || changedProperties.has("user")) &&
      this.weavy &&
      this.user &&
      this.editorRef.value &&
      this.tooltipsRef.value
    ) {
      void this.weavy.whenUrl().then(() => {
        void import("../utils/editor/editor").then(
          ({
            weavyHighlighter,
            syntaxHighlighting,
            history,
            dropCursor,
            mentions,
            tooltips,
            autocompletion,
            placeholder,
            keymap,
            weavyKeymap,
            defaultKeymap,
            historyKeymap,
            markdown,
            languages,
            EditorView,
            EditorState,
            Compartment,
          }) => {
            if (this.editorInitialized) {
              return;
            }

            this.editorInitialized = true;

            this.editorEditable = new Compartment();
            this.editorPlaceholder = new Compartment();
            this.editorKeymap = new Compartment();
            this.EditorView = EditorView;
            this.placeholderExtension = placeholder;
            this.keymapFacet = keymap;
            this.keymaps = {
              weavyModifierEnterSendKeymap: [{ key: "Mod-Enter", run: () => this.submit() }],
              weavyEnterSendKeymap: [{ key: "Enter", run: () => this.submit() }],
              weavyKeymap: [
                ...weavyKeymap,
                {
                  key: "ArrowUp",
                  run: (e) => {
                    if (!e.state.doc.toString().trim()) {
                      return this.editLast();
                    }
                    return false;
                  },
                },
              ],
              defaultKeymap: [...defaultKeymap],
              historyKeymap: [...historyKeymap],
            };

            this.editorExtensions = [
              EditorView.contentAttributes.of({
                spellcheck: "true",
                autocorrect: "on",
                autocapitalize: "on",
                enterkeyhint: this.settings?.enterToSend === "always" ? "send" : "enter",
              }),
              tooltips({
                parent: this.tooltipsRef.value,
                position: isPopoverPolyfilled() ? "fixed" : "absolute",
                tooltipSpace: (view) => {
                  this.showTooltips = true;
                  try {
                    this.tooltipsRef.value?.showPopover();
                  } catch {
                    /* No worries */
                  }

                  const measureEl = view.dom.ownerDocument.documentElement;
                  return { top: 0, left: 0, bottom: measureEl.clientHeight, right: measureEl.clientWidth };
                },
              }),
              history(),
              dropCursor(),
              mentions,
              autocompletion({
                override: this.componentFeatures?.allowsFeature(Feature.Mentions)
                  ? [(context: CompletionContext) => this.autocomplete(context)]
                  : [], //showMention
                closeOnBlur: false,
                aboveCursor: this.editorType !== "posts",
                icons: false,
                addToOptions: [
                  {
                    render: function (completion: MentionsCompletion, _state: EditorState) {
                      const item = document.createElement("wy-item");

                      item.interactive = false;

                      if (!completion.item?.access || completion.item.access === AccessType.None) {
                        item.disabled = true;
                      }

                      const avatar = document.createElement("wy-avatar");
                      avatar.slot = "image";
                      avatar.src = completion.item?.avatar_url || "";
                      avatar.name = completion.item?.name || "";

                      const name = document.createElement("span");
                      name.slot = "title";
                      name.innerText = completion.item?.name || "";

                      item.appendChild(avatar);
                      item.appendChild(name);
                      return item;
                    },
                    position: 10,
                  },
                ],
              }),
              syntaxHighlighting(weavyHighlighter, { fallback: true }),
              EditorView.lineWrapping,
              markdown({ codeLanguages: languages }),
              EditorView.domEventHandlers({
                paste: (evt: ClipboardEvent, _view: EditorView): boolean | void => {
                  let files: File[] = [];
                  const items = evt.clipboardData?.items || [];

                  for (const item of items) {
                    if (item.kind === "file") {
                      const file = item.getAsFile();
                      if (file) {
                        files = [...files, file];
                      }
                    }
                  }

                  if (this.componentFeatures?.allowsFeature(Feature.Attachments) && files.length > 0) {
                    return this.dispatchFiles(files);
                  }
                },
                keyup: (evt: KeyboardEvent, _view: EditorView) => {
                  //this.text = _view.state.doc.toString();

                  if (
                    this.componentFeatures?.allowsFeature(Feature.Typing) &&
                    this.typing &&
                    _view.state.doc.toString() !== ""
                  ) {
                    void this.throttledTyping();
                  }
                },
              }),
              EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                  // This runs whenever the document content changes

                  this.text = update.state.doc.toString().trim();

                  void this.dispatchChange(this.text);
                }
              }),
              // Compartments
              this.editorEditable.of(EditorView.editable.of(!this.disabled)),
              this.editorPlaceholder.of(this.placeholderExtension(this.placeholder)),
              this.editorKeymap.of(this.keymapFacet.of(this.getKeymaps())),
              EditorView.updateListener.of((_v: ViewUpdate) => {
                // HACK because placeholder extension doesn't allow change
                this.updatePlaceHolderText();

                // HACK to fix compartment references, order must be same as initial config
                const compartments = Array.from(
                  (
                    this.editor?.state as unknown as { config: { compartments: Map<Compartment, unknown> } }
                  ).config.compartments.keys(),
                );
                this.editorEditable = compartments[0];
                this.editorPlaceholder = compartments[1];
                this.editorKeymap = compartments[2];
              }),
            ];

            if (!this.editor) {
              this.editor = new EditorView({
                state: EditorState.create({
                  doc: this.text,
                  extensions: this.editorExtensions,
                }),
                parent: this.editorRef.value,
              });

              this.#resolveEditor?.(this.editor);
            }
          },
        );
      });
    }

    if (changedProperties.has("disabled") && this.editor && this.editorEditable && this.EditorView) {
      this.editor.dispatch({
        // Update readonly state
        effects: this.editorEditable.reconfigure(this.EditorView.editable.of(!this.disabled)),
      });
    }

    if (changedProperties.has("placeholder") && this.editor && this.editorPlaceholder && this.placeholderExtension) {
      const placeholder = this.placeholderExtension(this.placeholder);
      this.editor.dispatch({
        // Update placeholder state
        effects: this.editorPlaceholder.reconfigure(placeholder),
      });

      // HACK because reconfigure might not work
      this.updatePlaceHolderText();
    }

    if (changedProperties.has("settings") && this.editor && this.editorKeymap && this.keymapFacet) {
      this.editor.dispatch({
        // Update readonly state
        effects: this.editorKeymap.reconfigure(this.keymapFacet.of(this.getKeymaps())),
      });

      // HACK to update the enterkeyhint
      this.updateEnterKeyHint();
    }

    if (changedProperties.has("showTooltips")) {
      try {
        if (this.showTooltips) {
          this.tooltipsRef.value?.showPopover();
        } else {
          this.tooltipsRef.value?.hidePopover();
        }
      } catch {
        /* No worries */
      }
    }
  }

  /**
   * Update the visible placeholder text within the fallback DOM copy.
   *
   * @internal
   */
  protected updatePlaceHolderText() {
    const cmPlaceholder = this.renderRoot.querySelector<HTMLElement>(".cm-placeholder");

    if (cmPlaceholder && this.editor) {
      cmPlaceholder.setAttribute("aria-label", `placeholder ${this.placeholder}`);
      cmPlaceholder.innerText = this.placeholder;
    }
  }

  /**
   * Update enter key hint on the content element.
   *
   * @internal
   */
  protected updateEnterKeyHint() {
    const cmContent = this.renderRoot.querySelector<HTMLElement>(".cm-content");

    if (cmContent && this.editor) {
      cmContent.enterKeyHint = this.settings?.enterToSend === "always" ? "send" : "enter";
    }
  }

  /**
   * Compute and return keymaps for the current settings/editor type.
   *
   * @internal
   */
  protected getKeymaps() {
    if (!this.keymaps) {
      return [];
    }

    const { weavyKeymap, defaultKeymap, historyKeymap, weavyEnterSendKeymap, weavyModifierEnterSendKeymap } =
      this.keymaps;

    /**
     * Enter-to-send keymap:
     * - never - No keymap
     * - modifier - Mod+Enter
     * - auto - Mod+Enter for all. Enter for "messages" on desktop.
     * - always - Mod+Enter and Enter for all.
     */

    let enterKeymap = this.settings?.enterToSend === "never" ? [] : [...weavyModifierEnterSendKeymap];

    if (
      ((!this.settings?.enterToSend || this.settings?.enterToSend === "auto") &&
        this.editorType === "messages" &&
        desktop) ||
      this.settings?.enterToSend === "always"
    ) {
      enterKeymap = [...weavyEnterSendKeymap, ...enterKeymap];
    }

    return [...enterKeymap, ...weavyKeymap, ...defaultKeymap, ...historyKeymap];
  }

  /**
   * Autocomplete handler for mentions. Returns completion results or null.
   *
   * Called by the editor to resolve mention suggestions.
   *
   * @internal
   * @param context - Completion context from the editor
   * @returns Promise<CompletionResult | null>
   */
  protected async autocomplete(context: CompletionContext): Promise<CompletionResult | null> {
    if (!this.weavy || !this.app) {
      return null;
    }

    // match @mention except when preceded by ](
    // regex lookbehind is unfortunately not supported in safari
    let before = context.matchBefore(/(?:^|\s)(?!\]\()@(?=\S)([^@]+)/);

    // If completion wasn't explicitly started and there
    // is no word before the cursor, don't open completions.
    if (!context.explicit && !before) return null;

    // if valid, rematch (only when not using regex lookbehind)
    before = context.matchBefore(/@[^@]+/);

    const typed = before?.text.substring(1);
    const response = await this.weavy.fetch(`/api/apps/${this.app.id}/members?member=null&q=${typed}`);
    const result = (await response.json()) as MembersResultType;

    let completions: {
      item: UserType;
      label: string;
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => void;
    }[] = [];

    if (result.data) {
      completions = result.data
        .filter((item) => typeof item.name !== "undefined")
        .map((item) => {
          return {
            item: item,
            label: item.name,
            apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
              const toInsert = "[" + item.name + "](@u" + item.id.toString() + ")";
              let transaction = view.state.update({ changes: { from: from - 1, to: from } });
              view.dispatch(transaction);
              transaction = view.state.update({
                changes: { from: from - 1, to: to - 1, insert: toInsert },
              });
              view.dispatch(transaction);
              //view.dispatch(pickedCompletion);
            },
          };
        });
    }

    return {
      from: before ? before.from + 1 : context.pos,
      options: completions,
      filter: false,
    };
  }

  /**
   * Submit the editor content by dispatching a `submit` event.
   *
   * Validates that there is content to submit and that no uploads/embeds are still processing.
   */
  submit() {
    const text = this.editor?.state.doc.toString().trim() ?? "";

    const submitEvent: EditorSubmitEventType = new (CustomEvent as NamedEvent)("submit", {
      detail: { text },
      bubbles: false,
      composed: false,
    });

    const submitResult = this.dispatchEvent(submitEvent);

    if (submitResult) {
      this.clear();
    }
    return submitResult;
  }

  protected editLast() {
    const editLastEvent = new (CustomEvent as NamedEvent)("edit-last", {
      bubbles: true,
      composed: true,
    });

    return this.dispatchEvent(editLastEvent);
  }

  /**
   * Throttled typing indicator sender to reduce network traffic.
   *
   * @internal
   */
  private throttledTyping = throttle(
    () => {
      const event: EditorTypingEventType = new (CustomEvent as NamedEvent)("typing", {
        bubbles: true,
        composed: true,
      });

      this.dispatchEvent(event);
    },
    2000,
    { leading: true, trailing: false },
  );

  /**
   * Clear the editor UI and internal state (text, embeds, attachments, metadata).
   */
  clear() {
    const event: EditorClearEventType = new (CustomEvent as NamedEvent)("clear", {
      bubbles: true,
      composed: true,
    });

    if (this.dispatchEvent(event)) {
      this.editor?.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: "" } });
      this.text = "";
    }
  }

  protected dispatchChange(text: string) {
    const event: EditorChangeEventType = new (CustomEvent as NamedEvent)("change", {
      detail: { text },
      bubbles: true,
      composed: true,
    });

    return this.dispatchEvent(event);
  }

  protected dispatchFiles(files: File[]) {
    const event: DropFilesEventType = new (CustomEvent as NamedEvent)("drop-files", {
      detail: { files },
      bubbles: true,
      composed: true,
    });

    return this.dispatchEvent(event);
  }

  /**
   * Editor loading fallback dummy.
   * Hard copy of the rendered nodes when the editor is empty. Cleaned up to not be editable.
   */
  protected renderEditorDummy(): TemplateResult | typeof nothing {
    return !this.editorInitialized
      ? html`
          <div class="cm-editor">
            <div class="cm-announced"></div>
            <div tabindex="-1" class="cm-scroller">
              <div class="cm-content cm-lineWrapping">
                <div class="cm-line"
                  >${this.text
                    ? this.text
                    : html`<img class="cm-widgetBuffer" aria-hidden="true" /><span class="cm-placeholder"
                          >${this.placeholder}</span
                        ><br />`}</div
                >
              </div>
            </div>
          </div>
        `
      : nothing;
  }

  protected override render() {
    return html`
      <div
        part=${partMap({
          "wy-core-editor": true,
          "wy-core-post-editor": this.editorType === "posts",
          "wy-core-editor-comment": this.editorType === "comments",
          "wy-core-editor-message": this.editorType === "messages",
        })}
        ${ref(this.editorRef)}
      >
        ${this.renderEditorDummy()}
        <div
          ${ref(this.tooltipsRef)}
          part="wy-core-editor-tooltips"
          ?hidden=${isPopoverPolyfilled() && !this.showTooltips}
          popover=${ifDefined(isPopoverPolyfilled() ? undefined : "auto")}
        ></div>
      </div>
    `;
  }
}
