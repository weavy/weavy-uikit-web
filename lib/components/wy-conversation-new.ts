import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, queryAssignedElements, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { MemberSearchSubmitEventType } from "../types/members.events";
import { NamedEvent } from "../types/generic.types";
import { MemberIdType } from "../types/members.types";
import { CreateConversationEventType } from "../types/conversation.events";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-overlay";
import "./ui/wy-titlebar";
import "./wy-users-search";

declare global {
  interface HTMLElementTagNameMap {
    "wy-conversation-new": WyConversationNew;
  }
}

/**
 * Button and dialog for creating new conversations.
 *
 * **Used sub components**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-titlebar>`](./ui/wy-titlebar.ts)
 * - [`<wy-users-search>`](./wy-users-search.ts)
 *
 * @slot - Anything to replace the default button.
 *
 * @csspart wy-conversation-new-button - The button for creating a new conversation.
 * @csspart wy-conversation-new-dialog - The dialog overlay for creating a conversation.
 *
 * @fires {CreateConversationEventType} create - Emitted when a conversation should be created.
 */
@customElement("wy-conversation-new")
@localized()
export class WyConversationNew extends WeavySubComponent {
  static override styles = [hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Internal resolver for the member selection promise.
   *
   * @internal
   */
  protected _resolveMembers?: (members: MemberIdType[]) => void;

  /**
   * Internal rejector for the member selection promise.
   *
   * @internal
   */
  protected _rejectMembers?: () => void;

  /**
   * Promise resolved when members are selected via the dialog.
   *
   * Consumers can await whenMembers() to get selected member ids.
   *
   * @internal
   */
  protected _whenMembers = this.createMembersPromise();

  /**
   * Resolves when members are selected from the modal.
   *
   * @returns Promise<MemberIdType[]>
   */
  async whenMembers() {
    return this._whenMembers;
  }

  /**
   * Create an internal members promise and store resolve/reject handlers.
   *
   * @internal
   */
  protected createMembersPromise() {
    const whenMembers = new Promise<MemberIdType[]>((resolve, reject) => {
      this._resolveMembers = resolve;
      this._rejectMembers = reject;
    });
    this._whenMembers = whenMembers;
    return whenMembers
  }

  /**
   * Any agent uid
   *
   * When set, the component can create agent conversations directly.
   */
  @property()
  agent?: string;

  /**
   * Whether the new conversation dialog is shown.
   *
   * @internal
   */
  @state()
  private show = false;

  /**
   * Any elements in the general slot.
   *
   * @internal
   */
  @queryAssignedElements({ flatten: true, selector: ":not(slot)" })
  private slotElements!: Array<HTMLElement>;

  /**
   * Open the new conversation dialog and return selected members.
   *
   * @returns Promise<MemberIdType[]>
   */
  async selectMembers() {
    this.show = true;
    return await this.whenMembers();
  }

  /**
   * Close the new conversation dialog and resolve or reject the selection promise.
   *
   * @internal
   * @param members - Optional selected member ids to resolve the promise with.
   */
  private close(members?: MemberIdType[]) {
    this.show = false;

    if (members) {
      this._resolveMembers?.(members);
    } else {
      this._rejectMembers?.();
    }
  }

  /**
   * Create a conversation by dispatching a `create` event and closing the dialog.
   *
   * @param members - Array of members by id/uid for a new conversation.
   */
  private async submit(members: MemberIdType[] = []) {
    // Cannot submit without a valid user.
    await this.whenUser();

    // close modal and resolve
    this.close(members);

    // dispatch create conversation

    const event: CreateConversationEventType = new (CustomEvent as NamedEvent)("create", {
      detail: { members },
    });
    this.dispatchEvent(event);

    // Create new promise
    void this.createMembersPromise();
  }

  override render() {
    return html`
      ${this.slotElements.length
        ? nothing
        : html`
            <wy-button
              part="wy-conversation-new-button"
              kind="icon"
              @click=${() => (this.agent ? this.submit() : this.selectMembers())}
            >
              <wy-icon name="plus"></wy-icon>
            </wy-button>
          `}
      <slot></slot>

      ${!this.agent && this.weavy && this.user
        ? html`<wy-overlay
            part="wy-conversation-new-dialog"
            .show=${this.show}
            @close=${() => {
              this.show = false;
            }}
          >
            <wy-titlebar header slot="header">
              <wy-button slot="icon" kind="icon" @click=${() => this.close()}>
                <wy-icon name="close"></wy-icon>
              </wy-button>
              <span slot="title">${msg("New conversation")}</span>
            </wy-titlebar>
            ${this.show
              ? html`
                  <wy-users-search
                    @submit=${(e: MemberSearchSubmitEventType) => this.submit(e.detail.members.map((m) => m.id))}
                  ></wy-users-search>
                `
              : nothing}
          </wy-overlay>`
        : nothing}
    `;
  }
}
