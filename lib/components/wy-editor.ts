import { LitElement, html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { MentionsCompletion } from "../types/codemirror.types";
import { ConversationTypeGuid } from "../types/conversations.types";
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
import { AccessTypes } from "../types/app.types";
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
import { WeavyProps } from "../types/weavy.types";
import type { EditorView, KeyBinding, ViewUpdate } from "@codemirror/view";
import type { EditorState, Extension } from "@codemirror/state";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { desktop } from "../utils/browser";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import WeavyAvatar from "./wy-avatar";
import "./wy-embed";
import "./wy-dropdown";
import "./wy-file-item";
import "./wy-confluence";

import chatCss from "../scss/all.scss";

@customElement("wy-editor")
@localized()
export default class WyEditor extends BlockConsumerMixin(LitElement) {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

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

  @state()
  protected editor?: EditorView;

  protected editorRef: Ref<HTMLElement> = createRef();

  private throttledTyping = throttle(
    async () => {
      if (
        this.weavy &&
        this.app &&
        (this.app.type === ConversationTypeGuid.ChatRoom || this.app.type === ConversationTypeGuid.PrivateChat)
      ) {
        const mutation = await typingMutation(this.weavy, this.app.id);
        await mutation.mutate();
      }
    },
    2000,
    { leading: true, trailing: false }
  );

  protected authWindow?: WindowProxy | null;

  private throttledDrafting = throttle(
    async () => {
      this.saveDraft();
    },
    500,
    { leading: true, trailing: true }
  );

  constructor() {
    super();

    this.addEventListener("drop-files", this.handleDropFiles);
    this.addEventListener("keydown", inputBlurOnEscape);
    this.addEventListener("keyup", inputConsume);
  }

  override willUpdate(changedProperties: PropertyValues<this & WeavyProps>) {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("user") ||
        changedProperties.has("parentId")) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      this.draftKey = `draft-${this.editorType}-${this.parentId || this.app.id}`;
      this.uploadBlobMutation.trackMutation(
        getUploadBlobMutationOptions(
          this.weavy,
          this.user,
          this.app,
          `${this.editorLocation}-${this.parentId || this.app.id}`
        )
      );

      const mutateFileTrackKey = [
        "apps",
        this.app.id,
        "blobs",
        `${this.editorLocation}-${this.parentId || this.app.id}`,
      ];

      this.mutatingFiles.trackMutationState(
        { filters: { mutationKey: mutateFileTrackKey, exact: true } },
        this.weavy.queryClient
      );
      this.externalBlobMutation = getExternalBlobMutation(
        this.weavy,
        this.user,
        this.app,
        `${this.editorLocation}-${this.parentId || this.app.id}`
      );

      if (this.draft) {
        const draft = localStorage.getItem(this.draftKey);
        if (draft) {
          const values = JSON.parse(draft);

          this.text = values.text;
          this.embeds = values.embeds;
          this.meeting = values.meeting;
          if (values.pollOptions?.length > 0) {
            this.showPolls = true;
            this.pollOptions = values.pollOptions;
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
        this.pollOptions = [...this.options, { id: null, text: "" }];
        this.showPolls = true;
      }
    }

    // set editor text if text property is update (from saved draft)
    if (changedProperties.has("text") && this.editor) {
      this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: this.text } });
    }
  }

  protected override updated(changedProperties: PropertyValues<this & WeavyProps>): void {
    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("user") ||
        changedProperties.has("parentId")) &&
      this.weavy &&
      this.app &&
      this.user &&
      this.editorRef.value
    ) {
      this.weavy.whenUrl().then(() => {
        import("../utils/editor/editor").then(
          ({
            defaultHighlightStyle,
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
          }) => {
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
                override: this.hasFeatures?.mentions
                  ? [(context: CompletionContext) => this.autocomplete(context)]
                  : null, //showMention
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

                      if (!completion.item?.access || completion.item.access === AccessTypes.None) {
                        div.classList.add("wy-disabled");
                      }

                      const avatar = document.createElement("wy-avatar") as WeavyAvatar;
                      avatar.src = completion.item?.avatar_url || "";
                      avatar.name = completion.item?.display_name || "";

                      const name = document.createElement("div");
                      name.classList.add("wy-item-body");
                      name.innerText = completion.item?.display_name || "";

                      div.appendChild(avatar);
                      div.appendChild(name);
                      return div;
                    },
                    position: 10,
                  },
                ],
              }),
              placeholder(this.placeholder),
              syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
              EditorView.lineWrapping,
              keymap.of([...extraKeyMap, ...weavyKeymap, ...defaultKeymap, ...historyKeymap]),
              markdown({ codeLanguages: languages }),
              EditorView.domEventHandlers({
                paste: (evt: ClipboardEvent, _view: EditorView): boolean | void => {
                  let files: File[] = [];
                  const items = evt.clipboardData?.items || [];

                  for (const index in items) {
                    const item = items[index];
                    if (item.kind === "file") {
                      const file = item.getAsFile();
                      if (file) {
                        files = [...files, file];
                      }
                    }
                  }

                  if (files.length > 0 && this.hasFeatures?.attachments) {
                    for (let i = 0; i < files.length; i++) {
                      this.handleUploadFiles(files);
                    }
                    return true;
                  }
                },
                keyup: (evt: KeyboardEvent, _view: EditorView) => {
                  if (this.typing && _view.state.doc.toString() !== "" && this.hasFeatures?.typing) {
                    this.throttledTyping();
                  }

                  if (this.draft) {
                    this.throttledDrafting();
                  }

                  if (this.hasFeatures?.embeds && _view.state.doc.toString() !== "") {
                    this.handleEmbeds(_view.state.doc.toString());
                  }
                },
              }),
              EditorView.updateListener.of((_v: ViewUpdate) => {}),
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
              this.editorRef.value
                ?.querySelector(".cm-editor")
                ?.addEventListener("Weavy-SoftSubmit", this.submit.bind(this));
            }
          }
        );
      });
    }

    if (changedProperties.has("placeholder")) {
      const cmPlaceholder = this.renderRoot.querySelector<HTMLElement>(".cm-placeholder");

      if (cmPlaceholder) {
        cmPlaceholder.setAttribute("aria-label", `placeholder ${this.placeholder}`);
        cmPlaceholder.innerText = this.placeholder;
      }
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
    const result: UsersResultType = await response?.json();

    let completions: {
      item: UserType;
      label: string;
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => void;
    }[] = [];

    if (result.data) {
      completions = result.data
        .filter((item) => typeof item.display_name !== "undefined")
        .map((item) => {
          return {
            item: item,
            label: item.display_name,
            apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
              const toInsert = "[" + item.display_name + "](@u" + item.id.toString() + ")";
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

  protected handleDropFiles(e: Event) {
    const eventDetail = (e as CustomEvent).detail;
    if (eventDetail.files) {
      this.handleUploadFiles(eventDetail.files);
    }
  }

  protected async handleUploadFiles(files: File[] | null, input?: HTMLInputElement) {
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
        this.externalBlobMutation?.mutate({ externalBlob });
      }
    }
  }

  protected handleRemoveUpload(mutation: MutationState<BlobType, Error, MutateFileProps, FileMutationContextType>) {
    if (!this.weavy || !this.app) {
      return;
    }

    removeMutation(
      this.weavy.queryClient,
      ["apps", this.app.id, "blobs", `${this.editorLocation}-${this.parentId || this.app.id}`],
      (m) =>
        (m as Mutation<BlobType, Error, MutateFileProps, FileMutationContextType>).state.data?.id === mutation.data?.id
    );
  }

  protected saveDraft() {
    if (!this.draft) return;

    const files = this.mutatingFiles.result;

    // get editor text
    let text = this.editor?.state.doc.toString();
    if (text === undefined) {
      text = this.text;
    }

    if ((!files || !files.length) && !this.meeting && !this.embeds.length && !this.pollOptions.length && text === "") {
      localStorage.removeItem(this.draftKey);
    } else {
      localStorage.setItem(
        this.draftKey,
        JSON.stringify({
          meeting: this.meeting,
          text: text,
          pollOptions: this.pollOptions,
          embeds: this.embeds,
        })
      );
    }
  }

  protected handleRemoveAttachment(attachment: FileType) {
    this.attachments = this.attachments.filter((a) => a.id !== attachment.id);
  }

  protected async submit() {
    const fileMutationResults = this.mutatingFiles.result;

    const currentlyUploading = fileMutationResults?.some((upload) => upload.status === "pending");

    const text = this.editor?.state.doc.toString().trim();
    const meetingId = this.meeting?.id;
    const blobs = fileMutationResults?.map((mutation) => mutation.data?.id);
    const attachments = this.attachments?.map((attachment) => attachment.id) || [];
    const pollOptions = this.pollOptions.filter((p) => p.text.trim() !== "");

    if (
      isFetchingEmbeds() ||
      currentlyUploading ||
      (!text &&
        !meetingId &&
        blobs?.length == 0 &&
        pollOptions.length == 0 &&
        attachments.length == 0 &&
        this.embeds.length == 0)
    ) {
      return;
    }

    const options = {
      detail: { text, meetingId, blobs, attachments, pollOptions, embed: this.embeds[0]?.id },
      bubbles: true,
      composed: true,
    };
    this.dispatchEvent(new CustomEvent("submit", options));

    this.resetEditor();
  }

  protected resetEditor() {
    this.clearEditor();

    if (this.weavy && this.app) {
      removeMutations(this.weavy.queryClient, [
        "apps",
        this.app.id,
        "blobs",
        `${this.editorLocation}-${this.parentId || this.app.id}`,
      ]);
    }

    localStorage.removeItem(this.draftKey);
  }

  protected clearEditor() {
    this.editor?.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: "" } });
    this.text = "";
    this.meeting = undefined;
    this.pollOptions = [];
    this.showPolls = false;
    this.embeds = [];
    clearEmbeds();
  }

  private createMeeting = async (e: MessageEvent) => {
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

  protected async handleEmbeds(content: string) {
    if (!this.weavy) {
      return;
    }

    await getEmbeds(content, this.setEmbeds.bind(this), this.weavy);
  }

  protected removeEmbed(e: CustomEvent) {
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
    if (index === this.pollOptions.length - 1) {
      const option = { id: null, text: "" };
      this.pollOptions = [...this.pollOptions, option];
      this.saveDraft();
    }
  }

  protected renderTopSlot(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected renderMiddleSlot(): TemplateResult | typeof nothing {
    return html`
      <!-- Input -->
      <div
        class=${classMap({ "wy-post-editor-text": true, "wy-is-invalid": this.editorError })}
        ${ref(this.editorRef)}
      ></div>
      <div class="wy-post-editor-inputs">
        <div class="wy-post-editor-buttons">
          ${this.hasFeatures?.attachments
            ? html`<wy-button kind="icon" @click=${this.openFileInput} title=${msg("From device")}>
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
                />`
            : nothing}
          ${this.hasFeatures?.cloudFiles
            ? html`<wy-button kind="icon" @click=${this.openCloudFiles} title=${msg("From cloud")}>
                <wy-icon name="cloud"></wy-icon>
              </wy-button>`
            : nothing}
          ${this.hasFeatures?.confluence && this.weavy?.confluenceAuthenticationUrl
            ? html`<wy-confluence
                @external-blobs=${(e: CustomEvent) => this.handleExternalBlobs(e.detail.externalBlobs)}
              ></wy-confluence>`
            : nothing}
          ${this.hasFeatures?.zoomMeetings
            ? html`
                <wy-button kind="icon" @click=${() => this.handleMeetingClick("zoom")} title=${msg("Zoom meeting")}>
                  <wy-icon svg="zoom-meetings"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.hasFeatures?.googleMeet
            ? html`
                <wy-button kind="icon" @click=${() => this.handleMeetingClick("google")} title=${msg("Google Meet")}>
                  <wy-icon svg="google-meet"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.hasFeatures?.microsoftTeams
            ? html`
                <wy-button
                  kind="icon"
                  @click=${() => this.handleMeetingClick("microsoft")}
                  title=${msg("Microsoft Teams")}
                >
                  <wy-icon svg="microsoft-teams"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.hasFeatures?.polls
            ? html`<wy-button kind="icon" @click=${this.openPolls} title=${msg("Poll")}>
                <wy-icon name="poll"></wy-icon>
              </wy-button>`
            : nothing}
        </div>

        <!-- Button -->
        <wy-button @click="${this.submit}" color="primary" title=${this.buttonText}> ${this.buttonText} </wy-button>
      </div>
    `;
  }

  protected renderBottomSlot(): TemplateResult | typeof nothing {
    return this.renderLists();
  }

  protected renderLists(): TemplateResult | typeof nothing {
    const fileMutationResults = this.mutatingFiles.result;

    return html`
      <!-- polls -->
      ${this.hasFeatures?.polls && this.showPolls && this.pollOptions.length > 0
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
      ${(this.meeting?.provider === "zoom" && this.hasFeatures?.zoomMeetings) ||
      (this.meeting?.provider === "google" && this.hasFeatures?.googleMeet) ||
      (this.meeting?.provider === "microsoft" && this.hasFeatures?.microsoftTeams)
        ? html`
            <div class="wy-item wy-list-item">
              <wy-icon svg="${getMeetingIconName(this.meeting.provider)}"></wy-icon>
              <div class="wy-item-body">${getMeetingTitle(this.meeting.provider)}</div>
              <wy-button kind="icon" @click=${this.handleRemoveMeeting}>
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
                    .file=${mutation.context?.file}
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
      ${this.hasFeatures?.embeds && this.embeds.length > 0
        ? html`<div class="wy-embed-preview">
            ${this.embeds.map(
              (embed: EmbedType) => html`
                <wy-embed
                  class="wy-embed"
                  .embed=${embed}
                  @embed-remove=${this.removeEmbed}
                  @embed-swap=${this.swapEmbed}
                  .enableSwap=${this.embeds.length > 1}
                ></wy-embed>
              `
            )}
          </div> `
        : nothing}
    `;
  }

  protected renderCloudFiles(): TemplateResult | typeof nothing {
    return html`
      <wy-cloud-files
        ${ref(this.cloudFilesRef)}
        @external-blobs=${(e: CustomEvent) => this.handleExternalBlobs(e.detail.externalBlobs)}
      ></wy-cloud-files>
    `;
  }

  protected override render() {
    const isDragActive = this.dropZone.isDragActive;

    return html`
      <div
        class=${classMap({
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
