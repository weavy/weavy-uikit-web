import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import chatCss from "../scss/all";
import { getInitials } from "../utils/strings";
import { type MembersResultType } from "../types/members.types";
import { type UserType } from "../types/users.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { type PresenceType } from "../types/presence.types";

import "./wy-presence";
import "./wy-icon";

@customElement("wy-avatar")
export default class WyAvatar extends LitElement {
  static override styles = [chatCss];

  @property({ type: Number })
  size: number = 32;

  @property()
  src?: string = "";

  @property()
  name?: string = "";

  @property({ type: Boolean })
  isBot?: boolean = false;

  @property()
  avatarClass: string = "";

  @property()
  presence?: PresenceType;

  override render() {
    const remSize = this.size / 16;

    let initials;

    if (!this.src && this.name) {
      initials = getInitials(this.name);
    }

    return html`<div class=${classMap({ "wy-avatar-presence": this.isBot ? false : true, [this.avatarClass]: true })}>
      ${this.src
        ? html`
            <img
              alt=""
              title="${ifDefined(this.title || this.name)}"
              class="wy-avatar wy-avatar-img"
              style="--wy-component-avatar-size: calc(${remSize} * var(--wy-rem, 1rem));"
              height="${this.size}"
              width="${this.size}"
              src="${this.src}"
              decoding="async"
              loading="lazy"
            />
          `
        : html`
            <div
              class="wy-avatar wy-avatar-initials"
              style="--wy-component-avatar-size: calc(${remSize} * var(--wy-rem, 1rem));"
              title="${ifDefined(this.title || this.name)}"
            >
              <span>${initials}</span>
            </div>
          `}
      ${this.isBot ? html`<wy-icon class="wy-avatar-type" name="bot" size="${this.size / 3 * 1.25}"></wy-icon>` : nothing}
      ${this.presence && !this.isBot
        ? html`<wy-presence .status=${this.presence} id=${this.id}></wy-presence>`
        : nothing}
    </div>`;
  }
}

@customElement("wy-avatar-group")
export class WyAvatarGroup extends LitElement {
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property({ type: Number })
  size: number = 32;

  @property({ type: Object })
  user!: UserType;

  @property({
    type: Object,
    attribute: false,
  })
  members?: MembersResultType;

  @property()
  name: string = "";

  override render() {
    const remSize = this.size / 16;
    const otherMembers = (this.members?.data || [])
      .filter((member) => member.id !== this.user.id)
      .slice(0, 2)
      .reverse();

    const frontMember: UserType | undefined = otherMembers?.shift() || this.user;
    const backMember: UserType | undefined =
      otherMembers?.shift() || (frontMember !== this.user ? this.user : undefined);

    return html`
      <div
        class="wy-avatar-group"
        title=${this.name}
        style="--wy-component-avatar-size: calc(${remSize} * var(--wy-rem, 1rem));"
      >
        <wy-avatar
          .src=${backMember?.avatar_url}
          .name=${backMember?.display_name}
          size=${(this.size * 2) / 3}
        ></wy-avatar>
        <wy-avatar
          .src=${frontMember.avatar_url}
          .name=${frontMember.display_name}
          .isBot=${frontMember.is_bot}
          size=${(this.size * 2) / 3}
        ></wy-avatar>
      </div>
    `;
  }
}
