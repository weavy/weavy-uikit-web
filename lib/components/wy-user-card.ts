import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { MutationController } from "../controllers/mutation-controller";
import { getUserFollowMutationOptions, MutateUserFollowContextType, MutateUserFollowProps } from "../data/users";
import { getReportMutationOptions, MutateReportProps } from "../data/reports";
import { getUserBlockMutationOptions, MutateUserBlockContextType, MutateUserBlockProps } from "../data/blocks";
import type { UserOrAgentDetailType, UserOrAgentMinimalType } from "../types/users.types";
import { toIntOrString } from "../converters/string";
import { getApiOptions } from "../data/api";
import { QueryController } from "../controllers/query-controller";
import { WeavySubTypeComponent } from "../classes/weavy-sub-type-component";
import { isActionEvent } from "../types/action.events";
import { ActionType } from "../types/action.types";
import { Feature } from "../types/features.types";

import hostContentsCss from "../scss/host-contents.scss";
import userCardCss from "../scss/components/user-card.scss";

import "./ui/wy-overlay";
import "./ui/wy-container";
import "./ui/wy-avatar";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-progress-linear";

declare global {
  interface HTMLElementTagNameMap {
    "wy-user-card": WyUserCard;
  }
}

/**
 * Overlay profile card displaying detailed information about a user. The user can be followed/unfollowed, blocked and reported.
 *
 * **Used sub components:**
 *
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar-header>`](./ui/wy-avatar.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @slot toggle - Content to use in a toggle button for the overlay.
 */
@customElement("wy-user-card")
@localized()
export class WyUserCard extends WeavySubTypeComponent {
  static override styles = [hostContentsCss, userCardCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  #userFollowMutation = new MutationController<void, Error, MutateUserFollowProps, MutateUserFollowContextType>(this);

  #reportMutation = new MutationController<void, Error, MutateReportProps, void>(this);

  #userBlockMutation = new MutationController<void, Error, MutateUserBlockProps, MutateUserBlockContextType>(this);

  #profileQuery = new QueryController<UserOrAgentDetailType>(this);

  /** User identifier to get profile details for. */
  @property({
    converter: toIntOrString,
  })
  uid?: string | number | null;

  /** User profile data */
  @property({ attribute: false })
  profile?: UserOrAgentMinimalType;

  /** Whether the overlay should be shown */
  @property({ type: Boolean })
  show: boolean = false;

  /** Element to listen to `wy-user-profile` events on */
  @property({ attribute: false })
  listenTo?: EventTarget | null;

  /**
   * Follows the provided user/profile.
   * @param [follow=true] - Whether the user should be followed or not.
   */
  follow(follow: boolean = true) {
    if (this.user && this.uid !== this.user.id && this.uid !== this.user.uid) {
      void this.#userFollowMutation.mutate({ follow });
    }
  }

  /**
   * Confirm and report the profile for moderation.
   *
   * Uses the native confirm rather than an in-app dialog, matching how reporting a message works.
   * Reporting cannot be undone, so confirmation is required before submitting it.
   */
  async confirmReport() {
    if (!this.uid) {
      return;
    }

    const confirmed = window.confirm(
      msg("Report this profile for review? The user is not notified, and reporting cannot be undone."),
    );

    if (!confirmed) {
      return;
    }

    try {
      await this.#reportMutation.mutate({ entityType: "users", entityId: this.uid });
    } catch {
      // kept open on failure, so nothing suggests the report went through.
      return;
    }

    this.show = false;
  }

  /**
   * Blocks or unblocks the profile.
   *
   * Resolves when the server has it, so callers can act on the outcome; rejects the way the mutation does.
   *
   * @param [block=true] - Whether the user should be blocked or not.
   */
  block(block: boolean = true) {
    if (this.user && this.uid !== this.user.id && this.uid !== this.user.uid) {
      return this.#userBlockMutation.mutate({ block });
    }
    return Promise.resolve();
  }

  /**
   * Confirm and block the profile.
   *
   * The confirm carries the explanation, not a warning: blocking is reversible and unblock sits right here, so the
   * point is telling people what it actually does. That the blocked user is never told, and can still write to you, is
   * the part nobody expects.
   */
  async confirmBlock() {
    const confirmed = window.confirm(
      msg(
        "Block this user? You will stop seeing notifications and messages from them. They are not notified, and can still see and write to you.",
      ),
    );

    if (!confirmed) {
      return;
    }

    try {
      await this.block();
    } catch {
      // kept open on failure, so nothing suggests the block took effect.
      return;
    }

    // closing the card says it happened, the same way reporting does.
    this.show = false;
  }

  /**
   * Unblocks the profile and closes the card.
   *
   * Unconfirmed, unlike blocking -- it only restores what was there. Closes on the way out for the same reason block
   * does: the card looks the same either way, so the close is the only sign anything happened.
   */
  private async unblock() {
    try {
      await this.block(false);
    } catch {
      // kept open on failure, so nothing suggests the block was lifted.
      return;
    }

    this.show = false;
  }

  handleUserAction = (e: Event) => {
    if (isActionEvent(e) && !e.defaultPrevented && e.detail.user && e.detail.action === ActionType.Preview) {
      // Prevent further profile cards from consuming
      e.preventDefault();
      this.uid = e.detail.user.id;
      this.profile = e.detail.user;
      this.show = true;
    }
  };

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (changedProperties.has("listenTo") && this.listenTo) {
      try {
        changedProperties.get("listenTo")?.removeEventListener("wy-action", this.handleUserAction);
      } catch {
        /** No worries */
      }

      this.listenTo.addEventListener("wy-action", this.handleUserAction);
    }

    if (changedProperties.has("profile") && this.profile) {
      // set default uid if only profile is provided
      this.uid ??= this.profile.id;
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("uid") || changedProperties.has("show")) &&
      this.weavy &&
      this.uid &&
      this.show
    ) {
      await this.#profileQuery.trackQuery(
        getApiOptions<UserOrAgentDetailType>(this.weavy, ["users", this.uid], undefined, {
          initialData: this.profile,
        }),
      );
    }

    if ((changedProperties.has("weavy") || changedProperties.has("uid")) && this.weavy && this.uid) {
      await this.#userFollowMutation.trackMutation(getUserFollowMutationOptions(this.weavy, this.uid));
    }

    if ((changedProperties.has("weavy") || changedProperties.has("uid")) && this.weavy && this.uid) {
      await this.#userBlockMutation.trackMutation(getUserBlockMutationOptions(this.weavy, this.uid));
    }

    if (changedProperties.has("weavy") && this.weavy) {
      await this.#reportMutation.trackMutation(getReportMutationOptions(this.weavy));
    }
  }

  override render() {
    const { data: profile, isPending } = this.#profileQuery.result;

    // Actions apply to other real people only: not to yourself, and not to the system (0) or deleted (-1) users.
    // Agents are left in for follow, which is how the existing button behaved.
    const isOtherPerson = Boolean(this.user && profile && this.user.id !== profile.id && profile.id > 0);
    const canFollow =
      Boolean(this.componentFeatures?.allowsFeature(Feature.Follow)) && isOtherPerson && !profile?.is_blocked;
    // Reporting an agent has nobody to answer for it, so it is offered for people only.
    const canReport =
      Boolean(this.componentFeatures?.allowsFeature(Feature.Report)) && isOtherPerson && !profile?.is_agent;
    // Agents and the system user are not blockable -- the server rejects it -- so the action is not offered for them.
    // Feature.Block gates blocking only. Unblock stays available whenever a block exists, so turning the feature off
    // cannot strand someone with blocks they can no longer undo.
    const isBlockable = isOtherPerson && !profile?.is_agent;
    const canBlock = Boolean(this.componentFeatures?.allowsFeature(Feature.Block)) && isBlockable;
    const canUnblock = isBlockable && Boolean(profile?.is_blocked);

    return html`
      <slot
        name="toggle"
        @click=${(_e: MouseEvent) => {
          this.show = !this.show;
        }}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      ></slot>
      ${profile
        ? html`
            <wy-overlay type="sheet" .show=${this.show} @close=${() => (this.show = false)}>
              <span
                slot="title"
                style="display: inline-flex; align-items: center; gap: 0.5rem; max-width: 100%; vertical-align: middle"
              >
                ${profile.is_blocked ? html`<wy-icon name="cancel" aria-hidden="true"></wy-icon>` : nothing}
                <span style="overflow: hidden; text-overflow: ellipsis">${profile.name}</span>
                ${profile.is_reported ? html`<wy-icon name="flag" aria-label=${msg("Reported")}></wy-icon>` : nothing}
              </span>
              ${canFollow || canBlock || canUnblock || canReport
                ? html`
                    <wy-dropdown slot="actions" title=${msg("Profile actions")}>
                      ${canFollow
                        ? html`
                            <wy-dropdown-item @click=${() => this.follow(!profile?.is_followed)}>
                              ${profile?.is_followed
                                ? html`<wy-icon name="bell-off"></wy-icon>${msg("Unfollow")}`
                                : html`<wy-icon name="bell"></wy-icon>${msg("Follow")}`}
                            </wy-dropdown-item>
                          `
                        : nothing}
                      ${canReport
                        ? html`
                            <wy-dropdown-item @click=${() => void this.confirmReport()}>
                              <wy-icon name="flag"></wy-icon>
                              ${msg("Report")}
                            </wy-dropdown-item>
                          `
                        : nothing}
                      ${canUnblock
                        ? html`
                            <wy-dropdown-item @click=${() => void this.unblock()}>
                              <wy-icon name="cancel"></wy-icon>
                              ${msg("Unblock")}
                            </wy-dropdown-item>
                          `
                        : canBlock
                          ? html`
                              <wy-dropdown-item @click=${() => void this.confirmBlock()}>
                                <wy-icon name="cancel"></wy-icon>
                                ${msg("Block")}
                              </wy-dropdown-item>
                            `
                          : nothing}
                    </wy-dropdown>
                  `
                : nothing}
              <wy-container scrollY padded>
                <wy-avatar-header>
                  <wy-avatar
                    src=${ifDefined(profile?.avatar_url)}
                    name=${profile.name}
                    description=${ifDefined(profile?.comment)}
                    presence=${ifDefined(profile.is_blocked ? undefined : profile.presence)}
                    ?isAgent=${profile?.is_agent}
                    size=${96}
                  ></wy-avatar>
                </wy-avatar-header>

                ${profile.email || profile.phone_number
                  ? html`
                      <address part="wy-profile-details">
                        ${profile.name ? html`<div part="wy-profile-name">${profile.name}</div>` : nothing}
                        ${profile.email ? html`<a part="wy-profile-email" href="mailto:${profile.email}">${profile.email}</a>` : nothing}
                        ${profile.phone_number ? html`<a part="wy-profile-phone" href="tel:${profile.phone_number}">${profile.phone_number}</a>` : nothing}                        
                      </address>
                    `
                  : nothing}
                ${isPending ? html`<wy-progress-linear indeterminate reveal></wy-progress-linear>` : nothing}
              </wy-container>
            </wy-overlay>
          `
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.listenTo?.removeEventListener("wy-action", this.handleUserAction);
  }
}
