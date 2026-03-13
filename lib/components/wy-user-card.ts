import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { MutationController } from "../controllers/mutation-controller";
import { getUserFollowMutationOptions, MutateUserFollowContextType, MutateUserFollowProps } from "../data/users";
import type { UserOrAgentDetailType, UserOrAgentMinimalType } from "../types/users.types";
import { toIntOrString } from "../converters/string";
import { getApiOptions } from "../data/api";
import { QueryController } from "../controllers/query-controller";
import { WeavySubTypeComponent } from "../classes/weavy-sub-type-component";
import { isActionEvent } from "../types/action.events";
import { ActionType } from "../types/action.types";
import { Feature } from "../types/features.types";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-overlay";
import "./ui/wy-container";
import "./ui/wy-avatar";
import "./ui/wy-progress-linear";

declare global {
  interface HTMLElementTagNameMap {
    "wy-user-card": WyUserCard;
  }
}

/**
 * Overlay profile card displaying detailed information about a user. The user can be followed/unfollowed.
 *
 * **Used sub components:**
 *
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar-header>`](./ui/wy-avatar.ts)
 *
 * @slot toggle - Content to use in a toggle button for the overlay.
 */
@customElement("wy-user-card")
@localized()
export class WyUserCard extends WeavySubTypeComponent {
  static override styles = [hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  #userFollowMutation = new MutationController<void, Error, MutateUserFollowProps, MutateUserFollowContextType>(this);

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
  }

  override render() {
    const { data: profile, isPending } = this.#profileQuery.result;

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
              <span slot="title">${profile?.name}</span>
              ${this.componentFeatures?.allowsFeature(Feature.Follow) && this.user && this.user.id !== profile.id && profile.id > 0
                ? html`
                    <wy-button
                      slot="actions"
                      kind="filled"
                      color="primary"
                      @click=${() => this.follow(!profile?.is_followed)}
                      >${profile?.is_followed ? msg("Unfollow") : msg("Follow")}</wy-button
                    >
                  `
                : nothing}
              <wy-container scrollY padded>
                <wy-avatar-header
                  description=${profile.id == 0
                    ? "(System user)"
                    : profile.id == -1
                      ? "(Deleted user)"
                      : `${profile?.nickname || profile?.name}${this.profile?.uid ? ` (@${profile.uid})` : ""}`}
                >
                  <wy-avatar
                    src=${ifDefined(profile?.avatar_url)}
                    name=${profile.name}
                    description=${ifDefined(profile?.comment)}
                    presence=${profile.presence}
                    ?isAgent=${profile?.is_agent}
                    size=${96}
                  ></wy-avatar>
                </wy-avatar-header>

                ${profile.email || profile.phone_number
                  ? html`
                      <table>
                        ${profile.email
                          ? html`<tr
                              ><td><strong>${msg("E-mail")}</strong></td
                              ><td>${profile.email}</td></tr
                            >`
                          : nothing}
                        ${profile.phone_number
                          ? html`<tr
                              ><td><strong>${msg("Phone")}</strong></td
                              ><td>${profile.phone_number}</td></tr
                            >`
                          : nothing}
                      </table>
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
