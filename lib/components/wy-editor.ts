import { html, nothing, type TemplateResult, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { MentionsCompletion } from "../types/codemirror.types";
import { AppTypeGuid, AccessType } from "../types/app.types";
import throttle from "lodash.throttle";
import { typingMutation } from "../data/typing";
import { type MeetingType } from "../types/meetings.types";
import { addMeetingMutation } from "../data/meetings";
import { MutationController } from "../controllers/mutation-controller";
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
import WeavyCloudFiles from "./wy-cloud-files";
import { ExternalBlobMutationType, getExternalBlobMutation } from "../data/blob-external";
import { PollOptionType } from "../types/polls.types";
import { clearEmbeds, getEmbeds, initEmbeds, isFetchingEmbeds } from "../utils/embeds";
import type { EmbedType } from "../types/embeds.types";
import { DropZoneController } from "../controllers/dropzone-controller";
import { getMeetingIconName, getMeetingTitle } from "../utils/meetings";
import { inputBlurOnEscape, inputConsume } from "../utils/keyboard";
import type { EditorView, KeyBinding, ViewUpdate } from "@codemirror/view";
import type { Compartment, EditorState, Extension } from "@codemirror/state";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { desktop } from "../utils/browser";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { Feature } from "../types/features.types";
import type { MetadataType } from "../types/lists.types";
import { EditorDraftType } from "../types/editor.types";
import { DropFilesEventType, ExternalBlobsEventType } from "../types/files.events";
import type { EditorSubmitEventType } from "../types/editor.events";
import type { NamedEvent } from "../types/generic.types";
import type { EmbedRemoveEventType } from "../types/embeds.events";
import { getStorage } from "../utils/data";

import chatCss from "../scss/all.scss";

import WeavyAvatar from "./base/wy-avatar";
import "./wy-embed";
import "./base/wy-dropdown";
import "./wy-file-item";
import "./base/wy-progress-linear";

@customElement("wy-editor")
@localized()
export default class WyEditor extends WeavySubComponent {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);
  protected storage = getStorage("localStorage");

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ attribute: false })
  parentId?: number;

  private _placeholder: string = "";

  @property()
  get placeholder() {
    return this._placeholder;
  }

  set placeholder(placeholder) {
    this._placeholder = placeholder;
  }

  @property()
  text?: string = "";

  @property({ type: Object })
  metadata?: MetadataType = {};

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ attribute: false })
  options?: PollOptionType[] = [];

  @property({ attribute: false })
  attachments: FileType[] = [];

  @property()
  buttonText: string = "";

  @property({ type: Boolean })
  typing: boolean = true;

  @property({ type: Boolean })
  draft: boolean = false;

  @property()
  editorType: "messages" | "posts" | "comments" = "posts";

  @property()
  editorClass: string = "wy-post-editor";

  @property()
  editorLocation: "messages" | "posts" | "apps" | "files" = "apps";

  selectAllContent() {
    this.editor?.dispatch({
      selection: {
        anchor: 0,
        head: this.editor.state.doc.length,
      },
    });
  }

  setCursorLast() {
    this.editor?.dispatch({
      selection: {
        anchor: this.editor.state.doc.length,
        head: this.editor.state.doc.length,
      },
    });
  }

  focusInput() {
    this.editor?.focus();
  }

  @state()
  protected meeting?: MeetingType;

  @state()
  protected editorError: boolean = false;

  @state()
  protected showPolls: boolean = false;

  @state()
  protected pollOptions: PollOptionType[] = [];

  @state()
  protected embeds: EmbedType[] = [];

  @state()
  protected draftKey: string = "";

  @state()
  protected mutationAppId?: number;

  protected uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>(
    this
  );
  protected mutatingFiles = new MutationStateController<
    BlobType | FileType,
    Error,
    MutateFileProps,
    FileMutationContextType
  >(this);
  protected externalBlobMutation?: ExternalBlobMutationType;

  protected fileInputRef: Ref<HTMLInputElement> = createRef();
  protected cloudFilesRef: Ref<WeavyCloudFiles> = createRef();
  protected dropZone: DropZoneController = new DropZoneController(this);

  @state()
  protected keyMap: KeyBinding[] = [];

  @state()
  protected editorExtensions?: Extension[];

  // For modifying readonly state
  protected editorEditable?: Compartment;

  // For modifying placeholder
  protected editorPlaceholder?: Compartment;
  protected placeholderExtension?: (content: string | HTMLElement | ((view: EditorView) => HTMLElement)) => Extension;

  protected EditorView?: typeof EditorView;

  @state()
  protected editor?: EditorView;

  protected editorRef: Ref<HTMLElement> = createRef();
  protected editorInitialized: boolean = false;

  private throttledTyping = throttle(
    async () => {
      if (
        this.weavy &&
        this.app &&
        (this.app.type === AppTypeGuid.ChatRoom || this.app.type === AppTypeGuid.PrivateChat)
      ) {
        // TODO: Maybe not a new observer for every time?
        const mutation = typingMutation(this.weavy, this.app.id);
        await mutation.mutate();
      }
    },
    2000,
    { leading: true, trailing: false }
  );

  protected authWindow?: WindowProxy | null;

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

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("user") ||
        changedProperties.has("parentId")) &&
      this.weavy &&
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

          initEmbeds(this.embeds.map((embed) => embed.original_url));
        } else {
          // clear editor
          this.clearEditor();
        }
      }

      // set other editor content properties
      if (this.embed) {
        this.embeds = [this.embed];
        initEmbeds(this.embeds.map((embed) => embed.original_url));
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
            weavyDesktopMessageKeymap,
            Compartment,
          }) => {
            this.editorInitialized = true;

            // Clear the fallback dummy
            if (this.editorRef.value && !this.editor) {
              this.editorRef.value.innerHTML = "";
            }

            this.editorEditable = new Compartment();
            this.editorPlaceholder = new Compartment();
            this.EditorView = EditorView;
            this.placeholderExtension = placeholder;

            const extraKeyMap =
              this.editorType === "messages" && desktop && weavyDesktopMessageKeymap
                ? [...weavyDesktopMessageKeymap]
                : [];

            this.editorExtensions = [
              EditorView.contentAttributes.of({
                spellcheck: "true",
                autocorrect: "on",
                autocapitalize: "on",
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
                      const div = document.createElement("div");
                      div.classList.add("wy-item");
                      div.classList.add("wy-list-item");
                      div.classList.add("wy-item-hover");

                      if (!completion.item?.access || completion.item.access === AccessType.None) {
                        div.classList.add("wy-disabled");
                      }

                      const avatar = document.createElement("wy-avatar") as WeavyAvatar;
                      avatar.src = completion.item?.avatar_url || "";
                      avatar.name = completion.item?.name || "";

                      const name = document.createElement("div");
                      name.classList.add("wy-item-body");
                      name.innerText = completion.item?.name || "";

                      div.appendChild(avatar);
                      div.appendChild(name);
                      return div;
                    },
                    position: 10,
                  },
                ],
              }),
              syntaxHighlighting(weavyHighlighter, { fallback: true }),
              EditorView.lineWrapping,
              keymap.of([...extraKeyMap, ...weavyKeymap, ...defaultKeymap, ...historyKeymap]),
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
              EditorView.updateListener.of((_v: ViewUpdate) => {
                // HACK because placeholder extension doesn't allow change
                this.setPlaceHolderText();
              }),
              this.editorEditable.of(EditorView.editable.of(!this.disabled)),
              this.editorPlaceholder.of(this.placeholderExtension(this.placeholder)),
            ];

            if (this.editor) {
              this.editor.dispatch({
                // Update readonly state
                effects: this.editorEditable.reconfigure(EditorView.editable.of(!this.disabled)),
              });

              this.editor.dispatch({
                // Update placeholder state
                effects: this.editorPlaceholder.reconfigure(this.placeholderExtension(this.placeholder)),
              });

              // HACK because the placeholder update above might not work
              this.setPlaceHolderText();
            } else {
              this.editor = new EditorView({
                state: EditorState.create({
                  doc: this.text,
                  extensions: this.editorExtensions,
                }),
                parent: this.editorRef.value,
              });

              // listen for custom event (ctrl+enter)
              this.editorRef.value
                ?.querySelector(".cm-editor")
                ?.addEventListener("Weavy-SoftSubmit", this.submit.bind(this));
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
      const placeholder = this.placeholderExtension(this.placeholder)
      this.editor.dispatch({
        // Update placeholder state
        effects: this.editorPlaceholder.reconfigure(placeholder),
      });

      // HACK because the update above might not work
      this.setPlaceHolderText();
    }
  }

  setPlaceHolderText() {
    const cmPlaceholder = this.renderRoot.querySelector<HTMLElement>(".cm-placeholder");

      if (cmPlaceholder && this.editor) {
        cmPlaceholder.setAttribute("aria-label", `placeholder ${this.placeholder}`);
        cmPlaceholder.innerText = this.placeholder;
      }
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

  protected async autocomplete(context: CompletionContext): Promise<CompletionResult | null> {
    if (!this.weavy || !this.app) {
      return null;
    }

    // match @mention except when preceded by ](
    // regex lookbehind is unfortunately not supported in safari
    // let before = context.matchBefore(/(?<!\]\()@[^@]+/);
    let before = context.matchBefore(/(?!\]\(@)(^[^@]{0,1}|[^@]{2})@([^@]+)/);

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

  protected openFileInput = () => {
    this.fileInputRef.value?.click();
  };

  protected openCloudFiles = () => {
    this.cloudFilesRef.value?.open();
  };

  protected handleDropFiles(e: DropFilesEventType) {
    const eventDetail = e.detail;
    if (eventDetail.files) {
      void this.handleUploadFiles(eventDetail.files);
    }
  }

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

  protected handleExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    if (externalBlobs) {
      for (let i = 0; i < externalBlobs.length; i++) {
        const externalBlob = externalBlobs[i];
        void this.externalBlobMutation?.mutate({ externalBlob });
      }
    }
  }

  protected handleRemoveUpload(mutation: MutationState<BlobType, Error, MutateFileProps, FileMutationContextType>) {
    if (!this.weavy || !this.mutationAppId) {
      return;
    }

    removeMutation(
      this.weavy.queryClient,
      ["apps", this.mutationAppId, "blobs", `${this.editorLocation}-${this.parentId || this.mutationAppId}`],
      (m) =>
        (m as Mutation<BlobType, Error, MutateFileProps, FileMutationContextType>).state.data?.id === mutation.data?.id
    );
  }

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

  protected handleRemoveAttachment(attachment: FileType) {
    this.attachments = this.attachments.filter((a) => a.id !== attachment.id);
  }

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
      detail: { text, meetingId, blobs, attachments, pollOptions, embed: this.embeds[0]?.id, contextData },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(submitEvent);

    this.resetEditor();
  }

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

  protected setEmbeds(embed: EmbedType) {
    this.embeds = [embed, ...this.embeds];
    this.saveDraft();
  }

  protected handleEmbeds(content: string) {
    if (!this.weavy) {
      return;
    }

    getEmbeds(content, this.setEmbeds.bind(this), this.weavy);
  }

  protected removeEmbed(e: EmbedRemoveEventType) {
    this.embeds = this.embeds.filter((embed: EmbedType) => embed.id !== e.detail.id);
    this.saveDraft();
  }

  protected swapEmbed() {
    const first = this.embeds.shift();
    if (first) {
      this.embeds = [...this.embeds, first];
    }
    this.saveDraft();
  }

  protected openPolls() {
    if (!this.showPolls) {
      if (this.pollOptions.length === 0) {
        const option = { id: null, text: "" };
        this.pollOptions = [...this.pollOptions, option];
      }
      this.showPolls = true;
    } else {
      this.showPolls = false;
    }
  }

  protected handlePollOptionChange(e: Event, index: number) {
    const newValues = [...this.pollOptions];
    newValues[index].text = (e.target as HTMLInputElement).value;
    this.pollOptions = newValues;

    this.saveDraft();
  }

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
      <div class=${classMap({ "wy-post-editor-text": true, "wy-is-invalid": this.editorError })} ${ref(this.editorRef)}>
        ${this.renderEditorDummy()}
      </div>

      <div class="wy-post-editor-inputs">
        <div class="wy-post-editor-buttons">
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

  protected renderBottomSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return [this.renderLists()];
  }

  protected renderLists(): TemplateResult | typeof nothing {
    const fileMutationResults = this.mutatingFiles.result;

    if (this.disabled) {
      return nothing;
    }

    return html`
      <!-- polls -->
      ${this.componentFeatures?.allowsFeature(Feature.Polls) && this.showPolls && this.pollOptions.length > 0
        ? html`
            <div class="wy-poll-form">
              ${this.pollOptions.map((p: PollOptionType, index: number) => {
                return html`<input
                  value=${p.text}
                  @change=${(e: Event) => this.handlePollOptionChange(e, index)}
                  @keyup=${inputConsume}
                  class="wy-input"
                  type="text"
                  placeholder=${msg("+ add an option")}
                  @focus=${(e: Event) => this.handlePollOptionAdd(e, index)}
                />`;
              })}
            </div>
          `
        : nothing}

      <!-- meetings -->
      ${(this.meeting?.provider === "zoom" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.ZoomMeetings)) ||
      (this.meeting?.provider === "google" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.GoogleMeet)) ||
      (this.meeting?.provider === "microsoft" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.MicrosoftTeams))
        ? html`
            <div class="wy-item wy-list-item">
              <wy-icon svg="${getMeetingIconName(this.meeting.provider)}"></wy-icon>
              <div class="wy-item-body">${getMeetingTitle(this.meeting.provider)}</div>
              <wy-button kind="icon" @click=${() => this.handleRemoveMeeting()}>
                <wy-icon name="close-circle"></wy-icon>
              </wy-button>
            </div>
          `
        : nothing}

      <!-- blobs -->
      ${fileMutationResults && fileMutationResults.length
        ? repeat(
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
                    <wy-button
                      slot="actions"
                      kind="icon"
                      @click=${() => this.handleRemoveUpload(mutation)}
                      title=${msg("Discard", { desc: "Button action to discard" })}
                    >
                      <wy-icon name="close"></wy-icon>
                    </wy-button>
                  </wy-file-item>
                `;
              }

              return nothing;
            }
          )
        : nothing}

      <!-- attachments -->
      ${this.attachments &&
      this.attachments.map(
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
      )}

      <!-- embeds -->
      ${this.componentFeatures?.allowsFeature(Feature.Embeds) && this.embeds.length > 0
        ? html`<div class="wy-embed-preview">
            ${this.embeds.map(
              (embed: EmbedType) => html`
                <wy-embed
                  class="wy-embed"
                  .embed=${embed}
                  @embed-remove=${(e: EmbedRemoveEventType) => this.removeEmbed(e)}
                  @embed-swap=${() => this.swapEmbed()}
                  .enableSwap=${this.embeds.length > 1}
                ></wy-embed>
              `
            )}
          </div> `
        : nothing}
    `;
  }

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
        class=${classMap({
          "wy-editor": true,
          [this.editorClass]: true,
          "wy-dragging": isDragActive,
        })}
        data-drag-title=${msg("Drop files here to upload.")}
      >
        ${this.renderTopSlot()} ${this.renderMiddleSlot()} ${this.renderBottomSlot()}
      </div>
      ${this.renderCloudFiles()}
    `;
  }
}
