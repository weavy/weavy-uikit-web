import { html, nothing, type TemplateResult, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized, msg, str } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { MentionsCompletion } from "../types/codemirror.types";
import { AccessType } from "../types/app.types";
import throttle from "lodash.throttle";
import { typingMutation } from "../data/typing";
import { type MeetingType } from "../types/meetings.types";
import { addMeetingMutation } from "../data/meetings";
import { hasAbort, MutationController } from "../controllers/mutation-controller";
import {
  BlobType,
  ExternalBlobType,
  FileMutationContextType,
  FileStatusType,
  FileType,
  MutateFileProps,
} from "../types/files.types";
import { toUpperCaseFirst } from "../utils/strings";
import { getUploadBlobMutationOptions } from "../data/blob-upload";
import type { UsersResultType, UserType } from "../types/users.types";
import { MutationStateController } from "../controllers/mutation-state-controller";
import { repeat } from "lit/directives/repeat.js";
import { Mutation, MutationState } from "@tanstack/query-core";
import { removeMutation, removeMutations } from "../utils/mutation-cache";
import { WyCloudFiles } from "./wy-cloud-files";
import { ExternalBlobMutationType, getExternalBlobMutation } from "../data/blob-external";
import { PollOptionType } from "../types/polls.types";
import { clearEmbeds, getEmbeds, initEmbeds, isFetchingEmbeds } from "../utils/embeds";
import type { EmbedType } from "../types/embeds.types";
import { DropZoneController } from "../controllers/dropzone-controller";
import { getMeetingIconName, getMeetingTitle } from "../utils/meetings";
import { inputBlurOnEscape, inputConsume } from "../utils/keyboard";
import type { EditorView, KeyBinding, ViewUpdate } from "@codemirror/view";
import type { Compartment, EditorState, Extension, Facet } from "@codemirror/state";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { desktop } from "../utils/browser";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { Feature } from "../types/features.types";
import type { MetadataType } from "../types/lists.types";
import { EditorDraftType } from "../types/editor.types";
import { DropFilesEventType, ExternalBlobsEventType } from "../types/files.events";
import type { EditorSubmitEventType } from "../types/editor.events";
import type { NamedEvent } from "../types/generic.types";
import type { EmbedRemoveEventType } from "../types/embeds.events";
import { getStorage } from "../utils/data";
import { AgentAppTypeGuids } from "../classes/weavy-type-component";
import { partMap } from "../utils/directives/shadow-part-map";

import rebootCss from "../scss/reboot.scss";
import editorCss from "../scss/components/editor-base-cm.scss";
import postEditorCss from "../scss/components/editor-post.scss";
import pollCss from "../scss/components/poll.scss";
import dropzoneCss from "../scss/components/dropzone.scss";
import inputCss from "../scss/components/input.scss";

import "./ui/wy-avatar";
import "./ui/wy-dropdown";
import "./ui/wy-item";
import "./wy-embed";
import "./wy-file-item";
import "./wy-cloud-files";
import "./ui/wy-button";
import "./ui/wy-icon";

declare global {
  interface HTMLElementTagNameMap {
    "wy-editor": WyEditor;
  }
}

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
 * - [`<wy-file-item>`](./wy-file-item.ts)
 * - [`<wy-embed>`](./wy-embed.ts)
 * - [`<wy-cloud-files>`](./wy-cloud-files.ts)
 * - [`<wy-embed-select>`](./wy-embed.ts)
 *
 * @csspart wy-editor - Root editor container
 * @csspart wy-dragging - Applied when dragging files over the editor
 * @csspart wy-post-editor-text - Wrapper for the editor text area
 * @csspart wy-is-invalid - Applied when editor is in error state
 * @csspart wy-post-editor-inputs - Container for inputs/buttons
 * @csspart wy-post-editor-buttons - Container for action buttons
 * @csspart wy-poll-form - Poll options container
 * @csspart wy-input - Inputs inside poll options
 *
 * @fires {EditorSubmitEventType} submit - Emitted when the editor content is submitted (detail: { text, meetingId, blobs, attachments, pollOptions, embedId, contextData })
 */
@customElement("wy-editor")
@localized()
export class WyEditor extends WeavySubAppComponent {
  static override styles = [rebootCss, editorCss, postEditorCss, pollCss, dropzoneCss, inputCss];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);
  
  /** @internal */
  protected storage = getStorage("localStorage");

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
  private _placeholder: string = "";
  @property()
  set placeholder(placeholder) {
    this._placeholder = placeholder;
  }
  get placeholder() {
    return this._placeholder;
  }

  /**
   * Initial editor text content (draft or loaded content).
   */
  @property()
  text?: string = "";

  /**
   * Metadata associated with the editor content (e.g. agent instructions).
   *
   * @internal
   */
  @property({ type: Object })
  metadata?: MetadataType = {};

  /**
   * Optional single embed to prefill the editor.
   *
   * @internal
   */
  @property({ attribute: false })
  embed?: EmbedType;

  /**
   * Poll option templates passed to the editor.
   *
   * @internal
   */
  @property({ attribute: false })
  options?: PollOptionType[] = [];

  /**
   * Attached file references (ids/resolved) shown in the editor.
   *
   * @internal
   */
  @property({ attribute: false })
  attachments: FileType[] = [];

  /**
   * Text for the submit button.
   */
  @property()
  buttonText: string = "";

  /**
   * Whether typing indicators should be emitted.
   */
  @property({ type: Boolean })
  typing: boolean = true;

  /**
   * Whether this instance should persist drafts.
   */
  @property({ type: Boolean })
  draft: boolean = false;

  /**
   * Editor usage context, used to adjust behavior and styling.
   */
  @property()
  editorType: "messages" | "posts" | "comments" = "posts";

  /**
   * CSS class applied to the editor container.
   */
  @property()
  editorClass: string = "wy-post-editor";

  /**
   * Location context to use for file uploads and embeds.
   */
  @property()
  editorLocation: "messages" | "posts" | "apps" | "files" = "apps";

  /**
   * Select all content in the editor.
   *
   * @internal
   */
  selectAllContent() {
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
  setCursorLast() {
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
  focusInput() {
    this.editor?.focus();
  }

  /**
   * Meeting object attached to the editor (if any).
   *
   * @internal
   */
  @state()
  protected meeting?: MeetingType;

  /**
   * Whether the editor is in an error state.
   *
   * @internal
   */
  @state()
  protected editorError: boolean = false;

  /**
   * Whether poll UI is expanded.
   *
   * @internal
   */
  @state()
  protected showPolls: boolean = false;

  /**
   * Poll option values in the editor.
   *
   * @internal
   */
  @state()
  protected pollOptions: PollOptionType[] = [];

  /**
   * Internal embeds array derived from `embed` or discovered content.
   *
   * @internal
   */
  protected _embeds: EmbedType[] = [];

  @state()
  set embeds(embeds: EmbedType[]) {
    // Filter out "empty" embeds
    const filteredEmbeds = embeds.filter((embed) => embed.type !== "link" || embed.title || embed.description);
    this._embeds = [...filteredEmbeds];
  }
  get embeds() {
    return this._embeds;
  }

  @state()
  protected draftKey: string = "";

  @state()
  protected mutationAppId?: number;

  /**
   * Mutation controller for uploading blobs.
   *
   * @internal
   */
  protected uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>(
    this
  );
  /**
   * Tracks state of file mutation uploads.
   *
   * @internal
   */
  protected mutatingFiles = new MutationStateController<
    BlobType | FileType,
    Error,
    MutateFileProps,
    FileMutationContextType
  >(this);
  /**
   * External blob mutation handler (e.g. importing external files).
   *
   * @internal
   */
  protected externalBlobMutation?: ExternalBlobMutationType;

  /**
   * File input element reference.
   *
   * @internal
   */
  protected fileInputRef: Ref<HTMLInputElement> = createRef();
  /**
   * Cloud files picker reference.
   *
   * @internal
   */
  protected cloudFilesRef: Ref<WyCloudFiles> = createRef();
  /**
   * Drop zone controller for drag & drop file handling.
   *
   * @internal
   */
  protected dropZone: DropZoneController = new DropZoneController(this);

  /**
   * Active key bindings for the editor instance.
   *
   * @internal
   */
  @state()
  protected keyMap: KeyBinding[] = [];

  /**
   * Programmatic editor view instance and extensions.
   *
   * @internal
   */
  @state()
  protected editorExtensions?: Extension[];

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
   * EditorView constructor reference (lazy loaded).
   *
   * @internal
   */
  protected EditorView?: typeof EditorView;

  /**
   * The active EditorView instance.
   *
   * @internal
   */
  @state()
  protected editor?: EditorView;

  /**
   * Reference to the editor DOM node wrapper.
   *
   * @internal
   */
  protected editorRef: Ref<HTMLElement> = createRef();
  protected editorInitialized: boolean = false;

  /**
   * Throttled typing indicator sender to reduce network traffic.
   *
   * @internal
   */
  private throttledTyping = throttle(
    async () => {
      if (this.weavy && this.app && !AgentAppTypeGuids.has(this.app.type)) {
        // TODO: Maybe not a new observer for every time?
        const mutation = typingMutation(this.weavy, this.app.id);
        await mutation.mutate();
      }
    },
    2000,
    { leading: true, trailing: false }
  );

  protected authWindow?: WindowProxy | null;

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
    { leading: true, trailing: true }
  );

  constructor() {
    super();

    this.addEventListener("drop-files", (e) => this.handleDropFiles(e as DropFilesEventType));
    this.addEventListener("keydown", inputBlurOnEscape);
    this.addEventListener("keyup", inputConsume);
  }

  override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("app")) {
      // clear mutationAppId when app changes - will be assigned later
      this.mutationAppId = undefined;
    }

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("user") ||
        changedProperties.has("parentId")) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      this.mutationAppId = this.mutationAppId ?? this.app?.id ?? Date.now() * -1;
      this.draftKey = `draft-${this.editorType}-${this.parentId || this.mutationAppId}`;

      void this.uploadBlobMutation.trackMutation(
        getUploadBlobMutationOptions(
          this.weavy,
          this.user,
          this.mutationAppId,
          `${this.editorLocation}-${this.parentId || this.mutationAppId}`
        )
      );

      void this.mutatingFiles.trackMutationState(
        {
          filters: {
            mutationKey: [
              "apps",
              this.mutationAppId,
              "blobs",
              `${this.editorLocation}-${this.parentId || this.mutationAppId}`,
            ],
            exact: true,
          },
        },
        this.weavy.queryClient
      );
      this.externalBlobMutation = getExternalBlobMutation(
        this.weavy,
        this.user,
        this.mutationAppId,
        `${this.editorLocation}-${this.parentId || this.mutationAppId}`
      );

      if (this.draft && this.storage) {
        const draftString = this.storage.getItem(this.draftKey);
        if (draftString) {
          const draft = JSON.parse(draftString) as EditorDraftType;

          this.text = draft.text;
          this.embeds = draft.embeds;
          this.meeting = draft.meeting;
          if (draft.pollOptions?.length > 0) {
            this.showPolls = true;
            this.pollOptions = draft.pollOptions;
          }

          initEmbeds(this.embeds.map((embed) => embed.url).filter((url): url is string => typeof url === "string"));
        } else {
          // clear editor
          this.clearEditor();
        }
      }

      // set other editor content properties
      if (this.embed) {
        this.embeds = [this.embed];
        initEmbeds(this.embeds.map((embed) => embed.url).filter((url): url is string => typeof url === "string"));
      }

      if (this.options && this.options.length > 0) {
        this.pollOptions = this.options;
        this.showPolls = true;
      }
    }

    // set editor text if text property is update (from saved draft)
    if (changedProperties.has("text") && this.editor && this.editor.state.doc.toString() !== this.text) {
      this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: this.text } });
    }
  }

  protected override updated(changedProperties: PropertyValueMap<this>): void {
    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("user") ||
        changedProperties.has("parentId")) &&
      this.weavy &&
      this.user &&
      this.editorRef.value
    ) {
      void this.weavy.whenUrl().then(() => {
        void import("../utils/editor/editor").then(
          ({
            weavyHighlighter,
            syntaxHighlighting,
            history,
            dropCursor,
            mentions,
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
            weavyEnterSendKeymap,
            weavyModifierEnterSendKeymap,
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
              weavyEnterSendKeymap,
              weavyModifierEnterSendKeymap,
              weavyKeymap,
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
                    for (let i = 0; i < files.length; i++) {
                      void this.handleUploadFiles(files);
                    }
                    return true;
                  }
                },
                keyup: (evt: KeyboardEvent, _view: EditorView) => {
                  this.text = _view.state.doc.toString();

                  if (
                    this.componentFeatures?.allowsFeature(Feature.Typing) &&
                    this.typing &&
                    _view.state.doc.toString() !== ""
                  ) {
                    void this.throttledTyping();
                  }

                  if (this.draft) {
                    this.throttledDrafting();
                  }

                  if (this.componentFeatures?.allowsFeature(Feature.Embeds) && _view.state.doc.toString() !== "") {
                    void this.handleEmbeds(_view.state.doc.toString());
                  }
                },
              }),
              // Compartments
              this.editorEditable.of(EditorView.editable.of(!this.disabled)),
              this.editorPlaceholder.of(this.placeholderExtension(this.placeholder)),
              this.editorKeymap.of(this.keymapFacet.of(this.getKeymaps())),
              EditorView.updateListener.of((_v: ViewUpdate) => {
                // HACK because placeholder extension doesn't allow change
                this.setPlaceHolderText();

                // HACK to fix compartment references, order must be same as initial config
                const compartments = Array.from(
                  (
                    this.editor?.state as unknown as { config: { compartments: Map<Compartment, unknown> } }
                  ).config.compartments.keys()
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

              // listen for custom event (ctrl+enter)
              this.editorRef.value?.addEventListener("wy-submit", this.submit.bind(this));
            }
          }
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
      this.setPlaceHolderText();
    }

    if (changedProperties.has("settings") && this.editor && this.editorKeymap && this.keymapFacet) {
      this.editor.dispatch({
        // Update readonly state
        effects: this.editorKeymap.reconfigure(this.keymapFacet.of(this.getKeymaps())),
      });

      // HACK to update the enterkeyhint
      this.setEnterKeyHint();
    }
  }

  /**
   * Update the visible placeholder text within the fallback DOM copy.
   *
   * @internal
   */
  setPlaceHolderText() {
    const cmPlaceholder = this.renderRoot.querySelector<HTMLElement>(".cm-placeholder");

    if (cmPlaceholder && this.editor) {
      cmPlaceholder.setAttribute("aria-label", `placeholder ${this.placeholder}`);
      cmPlaceholder.innerText = this.placeholder;
    }
  }

  /**
   * Update contentEditable attribute on the fallback editor.
   *
   * @internal
   */
  setEditable() {
    const cmContent = this.renderRoot.querySelector<HTMLElement>(".cm-content");

    if (cmContent && this.editor) {
      cmContent.contentEditable = String(!this.disabled);
    }
  }

  /**
   * Update enter key hint on the content element.
   *
   * @internal
   */
  setEnterKeyHint() {
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
  getKeymaps() {
    if (!this.keymaps) {
      return [];
    }

    const { weavyEnterSendKeymap, weavyModifierEnterSendKeymap, weavyKeymap, defaultKeymap, historyKeymap } =
      this.keymaps;

    /**
     * Enter-to-send keymap:
     * - never - No keymap
     * - modifier - Mod+Enter
     * - auto - Mod+Enter for all. Enter for "messages" on desktop.
     * - always - Mod+Enter and Enter for all.
     */

    let enterKeyMap = this.settings?.enterToSend === "never" ? [] : [...weavyModifierEnterSendKeymap];

    if (
      ((!this.settings?.enterToSend || this.settings?.enterToSend === "auto") &&
        this.editorType === "messages" &&
        desktop) ||
      this.settings?.enterToSend === "always"
    ) {
      enterKeyMap = [...weavyEnterSendKeymap, ...enterKeyMap];
    }
    return [...enterKeyMap, ...weavyKeymap, ...defaultKeymap, ...historyKeymap];
  }

  override connectedCallback() {
    super.connectedCallback();

    // add meetings event listener
    window.addEventListener("message", this.createMeeting);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // remove meetings event listener
    window.removeEventListener("message", this.createMeeting);
  }

  protected handleRemoveMeeting() {
    this.meeting = undefined;
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
    const result = (await response.json()) as UsersResultType;

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
   * Open native file picker.
   *
   * @internal
   */
  protected openFileInput = () => {
    this.fileInputRef.value?.click();
  };

  /**
   * Open cloud files picker overlay.
   *
   * @internal
   */
  protected openCloudFiles = () => {
    this.cloudFilesRef.value?.open();
  };

  /**
   * Handle files dropped on the editor.
   *
   * @internal
   * @param e - Drop files event
   */
  protected handleDropFiles(e: DropFilesEventType) {
    const eventDetail = e.detail;
    if (eventDetail.files) {
      void this.handleUploadFiles(eventDetail.files);
    }
  }

  /**
   * Upload array of File objects via the upload blob mutation controller.
   *
   * Preserves input value if provided and saves draft after each upload.
   *
   * @internal
   * @param files - FileList or array of File objects to upload
   * @param input - Optional input element to reset after upload
   */
  protected async handleUploadFiles(files: File[] | FileList | null, input?: HTMLInputElement) {
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProps = { file: file };
        await this.uploadBlobMutation.mutate(fileProps);
        this.saveDraft();
      }
      if (input) {
        input.value = "";
      }
    }
  }

  /**
   * Handle external blob imports (cloud/external sources).
   *
   * @internal
   * @param externalBlobs - Array of external blob descriptors
   */
  protected handleExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    if (externalBlobs) {
      for (let i = 0; i < externalBlobs.length; i++) {
        const externalBlob = externalBlobs[i];
        void this.externalBlobMutation?.mutate({ externalBlob });
      }
    }
  }

  /**
   * Handle removal/abortion of an upload mutation and clean cache state.
   *
   * @internal
   * @param mutation - Mutation state object to remove
   */
  protected handleRemoveUpload(mutation: MutationState<BlobType, Error, MutateFileProps, FileMutationContextType>) {
    if (!this.weavy || !this.mutationAppId) {
      return;
    }

    if (mutation.status === "pending" && hasAbort(mutation.variables)) {
      // Abort any ongoing upload
      mutation.variables.abort?.();
    }

    removeMutation(
      this.weavy.queryClient,
      ["apps", this.mutationAppId, "blobs", `${this.editorLocation}-${this.parentId || this.mutationAppId}`],
      (m) =>
        (m as Mutation<BlobType, Error, MutateFileProps, FileMutationContextType>).state.data?.id === mutation.data?.id
    );
  }

  /**
   * Persist draft to storage if draft mode is enabled.
   *
   * Saves editor text, embeds, poll options and ongoing file uploads to localStorage.
   *
   * @internal
   */
  protected saveDraft() {
    if (!this.draft || !this.storage) return;

    const files = this.mutatingFiles.result;

    // get editor text
    let text = this.editor?.state.doc.toString();
    if (text === undefined) {
      text = this.text;
    }

    if (
      (!files || !files.length) &&
      !this.meeting &&
      !this.embeds.length &&
      (!this.pollOptions.length || this.pollOptions.filter((option) => option.text.trim() !== "").length === 0) &&
      text === ""
    ) {
      this.storage.removeItem(this.draftKey);
    } else {
      const draft: EditorDraftType = {
        meeting: this.meeting,
        text: text,
        pollOptions: this.pollOptions.filter((option) => option.text.trim() !== ""),
        embeds: this.embeds,
      };
      this.storage.setItem(this.draftKey, JSON.stringify(draft));
    }
  }

  /**
   * Handle removal of an attachment reference from the editor state.
   *
   * @internal
   * @param attachment - Attachment to remove
   */
  protected handleRemoveAttachment(attachment: FileType) {
    this.attachments = this.attachments.filter((a) => a.id !== attachment.id);
  }

  /**
   * Submit the editor content by dispatching a `submit` event.
   *
   * Validates that there is content to submit and that no uploads/embeds are still processing.
   *
   * @internal
   */
  protected submit() {
    const fileMutationResults = this.mutatingFiles.result;

    const currentlyUploadingFiles = fileMutationResults?.some((upload) => upload.status === "pending");

    const text = this.editor?.state.doc.toString().trim() ?? "";
    const meetingId = this.meeting?.id;
    const blobs = fileMutationResults?.map((mutation) => mutation.data?.id).filter((x) => x) as number[] | undefined;
    const attachments = this.attachments?.map((attachment) => attachment.id) || [];
    const pollOptions = this.pollOptions.filter((p) => p.text.trim() !== "");

    if (
      isFetchingEmbeds() ||
      currentlyUploadingFiles ||
      !this.contextDataBlobs ||
      (!text &&
        !meetingId &&
        blobs?.length == 0 &&
        pollOptions.length == 0 &&
        attachments.length == 0 &&
        this.embeds.length == 0)
    ) {
      return;
    }

    const contextData = this.contextDataBlobs.length ? this.contextDataBlobs : undefined;

    const submitEvent: EditorSubmitEventType = new (CustomEvent as NamedEvent)("submit", {
      detail: { text, meetingId, blobs, attachments, pollOptions, embedId: this.embeds[0]?.id, contextData },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(submitEvent);

    this.resetEditor();
  }

  /**
   * Reset the editor state after a successful submit.
   *
   * Clears editor content, removes pending uploads from the query cache and deletes the stored draft.
   *
   * @internal
   */
  protected resetEditor() {
    this.clearEditor();

    if (this.weavy && this.mutationAppId) {
      removeMutations(this.weavy.queryClient, [
        "apps",
        this.mutationAppId,
        "blobs",
        `${this.editorLocation}-${this.parentId || this.mutationAppId}`,
      ]);
    }

    this.storage?.removeItem(this.draftKey);
  }

  /**
   * Clear the editor UI and internal state (text, embeds, attachments, metadata).
   *
   * @internal
   */
  protected clearEditor() {
    this.editor?.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: "" } });
    this.text = "";
    this.meeting = undefined;
    this.pollOptions = [];
    this.showPolls = false;
    this.embeds = [];
    this.metadata = {};
    clearEmbeds();
  }

  /**
   * Message event handler for meeting OAuth responses.
   *
   * Listens for postMessage responses from the meeting auth window and completes meeting creation.
   *
   * @internal
   * @param e - MessageEvent containing meeting authorization payload (e.data.name).
   */
  private createMeeting = async (e: MessageEvent<{ name: string }>) => {
    if (!this.weavy) {
      return;
    }

    if (
      e.source === this.authWindow &&
      (this.weavy.url as URL).origin === e.origin &&
      e.data &&
      e.data.name &&
      e.data.name.endsWith("-authorized")
    ) {
      const name = e.data.name.slice(0, -"-authorized".length);
      const mutation = addMeetingMutation(this.weavy, name);
      const meeting = await mutation.mutate();

      if (!meeting.auth_url) {
        this.meeting = meeting;
      }
    }
  };

  /**
   * Create or initiate a meeting for the current user.
   *
   * If the meeting requires third-party auth, opens an auth popup; otherwise stores the created meeting.
   *
   * @internal
   * @param name - Provider key for the meeting (e.g. "zoom", "google", "microsoft")
   */
  protected async handleMeetingClick(name: string) {
    if (!this.weavy || !this.user) {
      return;
    }

    const mutation = addMeetingMutation(this.weavy, name);
    const meeting = await mutation.mutate();

    if (meeting.auth_url) {
      this.authWindow = window.open(meeting.auth_url, "oauthwin", "height=640,width=480");
    } else {
      this.meeting = meeting;
    }
  }

  /**
   * Add a discovered embed to the editor and persist draft.
   *
   * @internal
   * @param embed - Embed object to add.
   */
  protected setEmbeds(embed: EmbedType) {
    this.embeds = [embed, ...this.embeds];
    this.saveDraft();
  }

  /**
   * Scan content for embeds and add them via setEmbeds callback.
   *
   * @internal
   * @param content - Text content to scan for embed links.
   */
  protected handleEmbeds(content: string) {
    if (!this.weavy) {
      return;
    }

    getEmbeds(content, this.setEmbeds.bind(this), this.weavy);
  }

  /**
   * Remove an embed by id from the editor embeds list and persist draft.
   *
   * @internal
   * @param e - Embed remove event containing embed id.
   */
  protected removeEmbed(e: EmbedRemoveEventType) {
    this.embeds = this.embeds.filter((embed: EmbedType) => embed.id !== e.detail.id);
    this.saveDraft();
  }

  /**
   * Cycle the primary embed (move first to the end) and persist draft.
   *
   * @internal
   */
  protected swapEmbed() {
    const first = this.embeds.shift();
    if (first) {
      this.embeds = [...this.embeds, first];
    }
    this.saveDraft();
  }

  /**
   * Toggle the poll UI in the editor and initialize default options when opened.
   *
   * @internal
   */
  protected openPolls() {
    if (!this.showPolls) {
      if (this.pollOptions.length === 0) {
        this.pollOptions = Array.from({ length: 3 }, () => ({ id: null, text: "" }));
      }
      this.showPolls = true;
    } else {
      this.showPolls = false;
    }
  }

  /**
   * Handle change to a poll option input and persist draft.
   *
   * @internal
   * @param e - Input event
   * @param index - Index of the poll option changed
   */
  protected handlePollOptionChange(e: Event, index: number) {
    const newValues = [...this.pollOptions];
    newValues[index].text = (e.target as HTMLInputElement).value;
    this.pollOptions = newValues;

    this.saveDraft();
  }

  /**
   * Add a new poll option when focus reaches the last option (limit 5).
   *
   * @internal
   * @param e - Focus/keyboard event
   * @param index - Index of the poll option that triggered the add
   */
  protected handlePollOptionAdd(e: Event, index: number) {
    // NOTE: only allow 5 options for now
    if (index === this.pollOptions.length - 1 && this.pollOptions.length < 5) {
      const option = { id: null, text: "" };
      this.pollOptions = [...this.pollOptions, option];
      this.saveDraft();
    }
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
                  ><img class="cm-widgetBuffer" aria-hidden="true" /><span class="cm-placeholder"
                    >${this.placeholder}</span
                  ><br
                /></div>
              </div>
            </div>
          </div>
        `
      : nothing;
  }

  protected renderTopSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return nothing;
  }

  protected renderMiddleSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return html`
      <!-- Input -->
      <div part=${partMap({ "wy-post-editor-text": true, "wy-is-invalid": this.editorError })} ${ref(this.editorRef)}>
        ${this.renderEditorDummy()}
      </div>

      <div part="wy-post-editor-inputs">
        <div part="wy-post-editor-buttons">
          ${this.componentFeatures?.allowsFeature(Feature.Attachments)
            ? html`<wy-button
                  kind="icon"
                  @click=${this.openFileInput}
                  title=${msg("From device")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon name="attachment"></wy-icon>
                </wy-button>
                <input
                  type="file"
                  ${ref(this.fileInputRef)}
                  @click=${(e: Event) => e.stopPropagation()}
                  @change=${(e: Event) =>
                    this.handleUploadFiles(
                      Array.from((e.target as HTMLInputElement).files || []),
                      e.target as HTMLInputElement
                    )}
                  multiple
                  hidden
                  tabindex="-1"
                  ?disabled=${this.disabled}
                />`
            : nothing}
          ${this.componentFeatures?.allowsFeature(Feature.CloudFiles)
            ? html`<wy-button
                kind="icon"
                @click=${this.openCloudFiles}
                title=${msg("From cloud")}
                ?disabled=${this.disabled}
              >
                <wy-icon name="cloud"></wy-icon>
              </wy-button>`
            : nothing}
          ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.ZoomMeetings)
            ? html`
                <wy-button
                  kind="icon"
                  @click=${() => this.handleMeetingClick("zoom")}
                  title=${msg("Zoom meeting")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon svg="zoom-meetings"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.GoogleMeet)
            ? html`
                <wy-button
                  kind="icon"
                  @click=${() => this.handleMeetingClick("google")}
                  title=${msg("Google Meet")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon svg="google-meet"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.MicrosoftTeams)
            ? html`
                <wy-button
                  kind="icon"
                  @click=${() => this.handleMeetingClick("microsoft")}
                  title=${msg("Microsoft Teams")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon svg="microsoft-teams"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.componentFeatures?.allowsFeature(Feature.Polls)
            ? html`<wy-button
                kind="icon"
                @click=${() => this.openPolls()}
                title=${msg("Poll")}
                ?disabled=${this.disabled}
              >
                <wy-icon name="poll"></wy-icon>
              </wy-button>`
            : nothing}
        </div>

        <!-- Button -->
        <wy-button @click="${() => this.submit()}" color="primary" title=${this.buttonText} ?disabled=${this.disabled}>
          ${this.buttonText}
        </wy-button>
      </div>
    `;
  }

  /**
   * Render the bottom slot which aggregates lists (polls, meetings, file uploads, attachments, embeds).
   *
   * @internal
   */
  protected renderBottomSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return [this.renderLists()];
  }

  /**
   * Render the lists section (poll options, meetings, file uploads, attachments, embeds).
   *
   * @internal
   */
  protected renderLists(): TemplateResult | typeof nothing {
    const fileMutationResults = this.mutatingFiles.result;

    const hasPolls =
      (this.componentFeatures?.allowsFeature(Feature.Polls) && this.showPolls && this.pollOptions.length > 0) || false;
    const hasMeetings =
      (this.meeting?.provider === "zoom" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.ZoomMeetings)) ||
      (this.meeting?.provider === "google" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.GoogleMeet)) ||
      (this.meeting?.provider === "microsoft" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.MicrosoftTeams)) ||
      false;
    const hasFileMutations = (fileMutationResults && fileMutationResults.length > 0) || false;
    const hasAttachments = this.attachments && this.attachments.length > 0;
    const hasEmbeds = (this.componentFeatures?.allowsFeature(Feature.Embeds) && this.embeds.length > 0) || false;

    if (this.disabled || !(hasPolls || hasMeetings || hasFileMutations || hasAttachments || hasEmbeds)) {
      return nothing;
    }

    return html` <div part="wy-editor-parts">
      <!-- polls -->
      ${hasPolls
        ? html`
            <div part="wy-poll-form">
              ${this.pollOptions.map((p: PollOptionType, index: number) => {
                const optionNumber = index + 1;
                return html`<input
                  value="${p.text}"
                  part="wy-input"
                  type="text"
                  placeholder=${msg(str`Option ${optionNumber}`)}
                  @change=${(e: Event) => this.handlePollOptionChange(e, index)}
                  @keyup=${inputConsume}
                  @focus=${(e: Event) => this.handlePollOptionAdd(e, index)}
                />`;
              })}
            </div>
          `
        : nothing}

      <!-- meetings -->
      ${hasMeetings && this.meeting
        ? html`
            <wy-item size="sm">
              <wy-icon slot="image" svg="${getMeetingIconName(this.meeting.provider)}"></wy-icon>
              <span slot="title">${getMeetingTitle(this.meeting.provider)}</span>
              <wy-button slot="actions" kind="icon" @click=${() => this.handleRemoveMeeting()}>
                <wy-icon name="close"></wy-icon>
              </wy-button>
            </wy-item>
          `
        : nothing}

      <!-- blobs -->
      ${hasFileMutations && fileMutationResults
        ? html`<div>
            ${repeat(
              fileMutationResults,
              (mutation) => "mutation" + mutation.submittedAt,
              (mutation) => {
                if (mutation.context?.file) {
                  const file = mutation.context.file;
                  const fileStatus: FileStatusType = {
                    ...mutation.context.status,
                  };
                  return html`
                    <wy-file-item
                      .file=${mutation.context.file}
                      .status=${fileStatus}
                      title="${toUpperCaseFirst(mutation.context.type)}: ${file.name +
                      (fileStatus.text ? `: ${fileStatus.text}` : "")}"
                    >
                      <span slot="title"
                        ><strong></strong> ${file.name}
                        ${fileStatus.text ? html`: <em>${fileStatus.text}</em>` : nothing}</span
                      >
                      ${fileStatus.state === "pending"
                        ? html`
                            <wy-progress-circular
                              slot="actions"
                              padded
                              ?indeterminate=${Boolean(!fileStatus.progress)}
                              .max=${100}
                              .value=${fileStatus.progress || 0}
                            ></wy-progress-circular>
                          `
                        : nothing}
                      <wy-button
                        slot="actions"
                        kind="icon"
                        @click=${() => {
                          this.handleRemoveUpload(mutation);
                        }}
                        title=${msg("Discard", { desc: "Button action to discard" })}
                      >
                        <wy-icon name="close"></wy-icon>
                      </wy-button>
                    </wy-file-item>
                  `;
                }

                return nothing;
              }
            )}
          </div>`
        : nothing}

      <!-- attachments -->
      ${hasAttachments
        ? this.attachments.map(
            (attachment) => html`<wy-file-item .file=${attachment} title="${attachment.name}">
              <span slot="title">${attachment.name}</span>
              <wy-button
                slot="actions"
                kind="icon"
                @click=${() => this.handleRemoveAttachment(attachment)}
                title=${msg("Remove", { desc: "Button action to remove" })}
              >
                <wy-icon name="close"></wy-icon>
              </wy-button>
            </wy-file-item>`
          )
        : nothing}

      <!-- embeds -->
      ${hasEmbeds
        ? html`
            <wy-embed-select
              .embeds=${this.embeds}
              @embed-remove=${(e: EmbedRemoveEventType) => this.removeEmbed(e)}
              @embed-swap=${() => this.swapEmbed()}
            ></wy-embed-select>
          `
        : nothing}
    </div>`;
  }

  /**
   * Render the cloud files picker if cloud files feature is enabled.
   *
   * @internal
   */
  protected renderCloudFiles(): TemplateResult | typeof nothing {
    if (this.disabled) {
      return nothing;
    }

    return html`
      <wy-cloud-files
        ${ref(this.cloudFilesRef)}
        @external-blobs=${(e: ExternalBlobsEventType) => this.handleExternalBlobs(e.detail.externalBlobs)}
      ></wy-cloud-files>
    `;
  }

  protected override render() {
    const isDragActive = this.dropZone.isDragActive;

    return html`
      <div
        part=${partMap({
          "wy-editor": true,
          [this.editorClass]: true,
          "wy-dragging": isDragActive,
        })}
        data-drag-title=${msg("Drop files here")}
      >
        ${this.renderTopSlot()} ${this.renderMiddleSlot()} ${this.renderBottomSlot()}
      </div>
      ${this.renderCloudFiles()}
    `;
  }
}
