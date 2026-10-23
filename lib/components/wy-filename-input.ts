import { css, html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { keyed } from "lit/directives/keyed.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { localized, msg } from "@lit/localize";
import { customElement } from "../utils/decorators/custom-element";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { partMap } from "../utils/directives/shadow-part-map";

import hostContentsCss from "../scss/host-contents.scss";
import inputCss from "../scss/components/input.scss";

import "./ui/wy-overlay";
import "./ui/wy-container";
import "./ui/wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-filename-input": WyFilenameInput;
  }
}

/**
 * Handles a submitted filename while the prompt stays open.
 *
 * Return an error message to reject the name and keep the prompt open with the message shown inline.
 * Return nothing to accept the name and close the prompt. A thrown error closes the prompt and rejects the pending `open()` call.
 */
export type FilenameSubmitHandler = (filename: string) => Promise<string | undefined | void> | string | undefined | void;

/**
 * Internal filename prompt shared by file creation components.
 */
@customElement("wy-filename-input")
@localized()
export class WyFilenameInput extends LitElement {
  static override styles = [
    hostContentsCss,
    inputCss,
    css`
      /* The input and button keep their single padded row. An error message wraps onto a full-width second row
         inside the same row, separated by the regular gap, so the padding is identical with and without an error.
         The input gets a zero flex basis so that a long name grows into the free space instead of pushing the button
         down onto the second row. */
      wy-container::part(wy-container-horizontal) {
        flex-wrap: wrap;
      }

      [part~="wy-input"] {
        flex-basis: 0;
      }

      [part~="wy-invalid-feedback"] {
        flex-basis: 100%;
        margin-top: 0;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @state()
  private show = false;

  /** A submit handler is running; input and button are disabled until it settles. */
  @state()
  private pending = false;

  /** Message from the last rejected submission, shown inline until the input changes. */
  @state()
  private error?: string;

  private inputRef = createRef<HTMLInputElement>();
  private resolveFilename?: (filename: string | undefined) => void;
  private rejectFilename?: (reason: unknown) => void;
  private submitHandler?: FilenameSubmitHandler;
  private initialFilename = "untitled";

  /**
   * Prompt for a filename, replacing any previous pending prompt.
   *
   * @param ext - Suggested initial extension, not a restriction.
   * @param submit - Optional handler run on submit while the prompt stays open, e.g. to create the file and report a taken name.
   * @returns The accepted filename unchanged, or undefined on cancellation. Rejects when the submit handler throws.
   */
  async open(ext?: string, submit?: FilenameSubmitHandler): Promise<string | undefined> {
    this.close();
    this.initialFilename = ext ? `untitled.${ext.replace(/^\./, "")}` : "untitled";
    this.submitHandler = submit;
    this.error = undefined;
    this.pending = false;
    const result = new Promise<string | undefined>((resolve, reject) => {
      this.resolveFilename = resolve;
      this.rejectFilename = reject;
    });
    const resolve = this.resolveFilename;
    this.show = true;
    await this.updateComplete;

    // A newer call may have replaced this prompt while its first render was pending.
    if (this.resolveFilename === resolve && this.inputRef.value) {
      this.focusInput();
    }

    return await result;
  }

  /**
   * Focus and select the basename, leaving the extension editable.
   * Dotfiles such as `.env` have no basename to select, so the whole name is selected instead.
   */
  private focusInput() {
    const input = this.inputRef.value;
    if (!input) {
      return;
    }
    const dot = input.value.lastIndexOf(".");
    input.focus();
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  }

  /**
   * Settle the pending prompt and hide the modal.
   * @param filename - Accepted filename, or undefined to cancel.
   */
  private close(filename?: string) {
    this.show = false;
    this.resolveFilename?.(filename);
    this.resolveFilename = undefined;
    this.rejectFilename = undefined;
    this.submitHandler = undefined;
  }

  /**
   * Hide the modal and reject the pending prompt with the submit handler's error.
   * @param reason - The thrown error.
   */
  private fail(reason: unknown) {
    this.show = false;
    this.rejectFilename?.(reason);
    this.resolveFilename = undefined;
    this.rejectFilename = undefined;
    this.submitHandler = undefined;
  }

  /**
   * Run the submit handler, keeping the prompt open with an inline error when the name is rejected.
   */
  private async handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const input = this.inputRef.value;
    const resolve = this.resolveFilename;
    if (this.pending || !resolve || !input?.reportValidity()) {
      return;
    }

    const filename = input.value;
    if (!this.submitHandler) {
      this.close(filename);
      return;
    }

    this.pending = true;
    let error: string | undefined | void;
    try {
      error = await this.submitHandler(filename);
    } catch (reason) {
      // The handler failed for another reason than the name; let the caller handle it.
      if (this.resolveFilename === resolve) {
        this.fail(reason);
      }
      return;
    } finally {
      this.pending = false;
    }

    // A newer prompt may have replaced this one while the handler was running.
    if (this.resolveFilename !== resolve) {
      return;
    }

    if (error && this.show) {
      this.error = error;
      await this.updateComplete;
      this.focusInput();
    } else {
      // The handler accepted the name, or the user dismissed the prompt while it ran.
      // A file created in the meantime is still reported, a rejected name is treated as a cancellation.
      this.close(error ? undefined : filename);
    }
  }

  /** Cancel pending input when the prompt is removed. */
  override disconnectedCallback(): void {
    this.close();
    super.disconnectedCallback();
  }

  /** Render the filename modal without performing any network operations. */
  protected override render() {
    if (!this.show) {
      return nothing;
    }

    const resolve = this.resolveFilename;

    // Give each prompt its own dialog so a delayed native close event from an old
    // dialog cannot cancel a newly opened prompt.
    return keyed(
      resolve,
      html`
        <wy-overlay
          type="modal-input"
          @shown=${() => {
            if (this.resolveFilename === resolve) {
              this.focusInput();
            }
          }}
          @close=${() => {
            if (this.resolveFilename === resolve) {
              if (this.pending) {
                // Hide only; the running submit handler settles the prompt when it finishes.
                this.show = false;
              } else {
                this.close();
              }
            }
          }}
        >
          <span slot="title">${msg("New file")}</span>
          <form @submit=${(e: SubmitEvent) => void this.handleSubmit(e)}>
            <wy-container padded direction="horizontal">
              <input
                ${ref(this.inputRef)}
                type="text"
                name="filename"
                aria-label=${msg("Filename")}
                aria-invalid=${ifDefined(this.error ? "true" : undefined)}
                aria-describedby=${ifDefined(this.error ? "filename-error" : undefined)}
                part=${partMap({ "wy-input": true, "wy-is-invalid": Boolean(this.error) })}
                .value=${this.initialFilename}
                ?disabled=${this.pending}
                required
                pattern=${".*\\S.*"}
                @input=${() => {
                  this.error = undefined;
                }}
              />
              <wy-button
                kind="filled"
                color="primary"
                ?disabled=${this.pending}
                @click=${() => this.inputRef.value?.form?.requestSubmit()}
                >${msg("Create")}</wy-button
              >
              ${this.error
                ? html`<div id="filename-error" part="wy-invalid-feedback" role="alert">${this.error}</div>`
                : nothing}
            </wy-container>
          </form>
        </wy-overlay>
      `,
    );
  }
}
