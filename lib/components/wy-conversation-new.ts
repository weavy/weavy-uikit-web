import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, queryAssignedElements, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { MemberSearchSubmitEventType } from "../types/members.events";
import { NamedEvent } from "../types/generic.types";
import { MemberIdType, MemberType } from "../types/members.types";
import { CreateConversationEventType } from "../types/conversation.events";
import { consume } from "@lit/context";
import { FeaturePolicyContext, type ComponentFeaturePolicy } from "../contexts/features-context";
import { Feature } from "../types/features.types";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-overlay";
import "./ui/wy-titlebar";
import "./wy-users-search";
import type { OverlayAppearanceType } from "../types/ui.types";
import { ActionType } from "../types/action.types";

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
   * The feature policy of the host component, used to tell the picker whether blocking is available.
   *
   * @internal
   */
  @consume({ context: FeaturePolicyContext, subscribe: true })
  @state()
  componentFeatures: ComponentFeaturePolicy | undefined;

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
  protected _rejectMembers?: (reason?: string) => void;

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
    return whenMembers;
  }

  /**
   * Overlay appearance used for the create conversation dialog.
   *
   * @type {"modal" | "sheet" | "drawer" | "full" | "none"}
   * @default "modal"
   */
  @property({ type: String })
  overlay: OverlayAppearanceType = "modal";

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
      this._rejectMembers?.("Selection aborted by user; no members selected");
    }

    void this.createMembersPromise();
  }

  /**
   * Handle a member selection from the picker.
   *
   * Picking exactly one blocked person opens their profile card instead of starting a conversation: a blocked 1:1 is
   * not openable, so creating one would drop the user straight into a muted conversation with no way forward. The card
   * is where unblock lives. Any other selection -- including a group that happens to contain a blocked person -- is
   * created as usual, since group participation is unrestricted.
   *
   * @internal
   * @param members - The members chosen in the picker.
   */
  private async handleSubmit(members: MemberType[]) {
    const blocked = members.length === 1 && members[0].is_blocked ? members[0] : undefined;

    if (blocked) {
      this.close();
      this.dispatchAction({ action: ActionType.Preview, user: blocked });
      return;
    }

    await this.submit(members.map((m) => m.id));
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
              @click=${async () => {
                try {
                  await this.selectMembers();
                } catch {
                  /* No members selected, no worries */
                }
              }}
            >
              <wy-icon name="plus"></wy-icon>
            </wy-button>
          `}
      <slot></slot>

      ${this.weavy && this.user
        ? html`<wy-overlay
            part="wy-conversation-new-dialog"
            .type=${this.overlay}
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
                    .canBlock=${Boolean(this.componentFeatures?.allowsFeature(Feature.Block))}
                    @submit=${(e: MemberSearchSubmitEventType) => this.handleSubmit(e.detail.members)}
                  ></wy-users-search>
                `
              : nothing}
          </wy-overlay>`
        : nothing}
    `;
  }
}
