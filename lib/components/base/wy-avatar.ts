import { LitElement, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { getInitials } from "../../utils/strings";
import { type MemberType } from "../../types/members.types";
import { type UserType } from "../../types/users.types";
import { Presence, type PresenceType } from "../../types/presence.types";
import { consume } from "@lit/context";
import { UserContext } from "../../contexts/user-context";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";
import { S4 } from "../../utils/data";

import rebootCss from "../../scss/components/base/reboot.scss";
import avatarCss from "../../scss/components/avatar.scss";
import presenceCss from "../../scss/components/presence.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import "./wy-presence";
import "./wy-icon";

@customElement("wy-avatar")
export default class WyAvatar extends LitElement {
  static override styles = [rebootCss, avatarCss, presenceCss];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  size: number = 32;

  @property()
  src?: string = "";

  @property()
  name?: string = "";

  @property()
  description?: string = "";

  @property({ type: Boolean, reflect: true })
  isAgent?: boolean = false;

  @property()
  presence?: PresenceType;

  override render() {
    const remSize = this.size / 16;

    let initials;

    if (!this.src && this.name) {
      initials = getInitials(this.name);
    }

    const avatarParts = {
      "wy-avatar-shape": true,
      "wy-avatar-img": Boolean(this.src),
      "wy-avatar-initials": !this.src,
      "wy-presence-mask": this.presence === Presence.Active,
    };

    return html`
      ${this.src
        ? html`
            <img
              alt=""
              title="${this.name}${this.description ? ` • ${this.description}` : ''}"
              part=${partMap(avatarParts)}
              style="--wy-component-avatar-size: calc(${remSize} * var(--wy-size, 1rem));"
              height="${this.size}"
              width="${this.size}"
              src="${this.src}"
              decoding="async"
              loading="lazy"
            />
          `
        : html`
            <div
              part=${partMap(avatarParts)}
              style="--wy-component-avatar-size: calc(${remSize} * var(--wy-size, 1rem));"
              title="${this.name}${this.description ? ` • ${this.description}` : ''}"
            >
              <span part="wy-avatar-initials-text">${initials}</span>
            </div>
          `}
      ${this.isAgent
        ? html`<wy-icon part="wy-avatar-type" name="agent" size="${(this.size / 3) * 1.25}"></wy-icon>`
        : nothing}
      ${this.presence && !this.isAgent
        ? html`<wy-presence .status=${this.presence} id=${this.id}></wy-presence>`
        : nothing}
    `;
  }
}

@customElement("wy-avatar-group")
export class WyAvatarGroup extends LitElement {
  static override styles = [
    rebootCss,
    avatarCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  size: number = 32;

  @property({
    type: Array,
    attribute: false,
  })
  members?: MemberType[];

  @consume({ context: UserContext, subscribe: true })
  @state()
  user: UserType | undefined;

  protected uniqueId = `wy-avatar-${S4()}`;

  override render() {
    if (!this.user) {
      return nothing;
    }

    const remSize = this.size / 16;
    const otherMembers = (this.members|| [])
      .filter((member) => member.id !== this.user?.id)
      .slice(0, 2)
      .reverse();

    const frontMember: MemberType | undefined = otherMembers?.shift() || this.user;
    const backMember: MemberType | undefined =
      otherMembers?.shift() || (frontMember !== this.user ? this.user : undefined);

    return [
      html`
        <style>
          :host {
            --wy-component-avatar-size: calc(${remSize} * var(--wy-size, 1rem));
          }

          .avatar-mask-bg {
            width: calc(${(remSize * 2) / 3} * var(--wy-size, 1rem));
            height: calc(${(remSize * 2) / 3} * var(--wy-size, 1rem));
            fill: white;
          }

          .avatar-mask {
            width: calc(${(remSize * 2) / 3} * var(--wy-size, 1rem));
            height: calc(${(remSize * 2) / 3} * var(--wy-size, 1rem));
            ry: var(--wy-avatar-border-radius, var(--wy-border-radius-pill, var(--wy-border-radius, 50%)));
            x: calc(${remSize / 3} * var(--wy-size, 1rem));
            y: calc(${remSize / 3} * var(--wy-size, 1rem));
            stroke: black;
            stroke-width: 4px;
            fill: black;
          }
        </style>
      `,
      html`
        <svg>
          <defs>
            <mask id="${this.uniqueId}-mask">
              <rect class="avatar-mask-bg" />
              <rect class="avatar-mask" />
            </mask>
          </defs>
        </svg>
      `,
      html`
        <wy-avatar
          part="wy-avatar-back"
          style="mask-image: url(#${this.uniqueId}-mask); -webkit-mask-image: url(#${this.uniqueId}-mask);"
          .src=${backMember?.avatar_url}
          .name=${backMember?.name}
          size=${(this.size * 2) / 3}
        ></wy-avatar>
        <wy-avatar
          part="wy-avatar-front"
          .src=${frontMember.avatar_url}
          .name=${frontMember.name}
          .isAgent=${frontMember.is_agent}
          size=${(this.size * 2) / 3}
        ></wy-avatar>
      `,
    ];
  }
}

@customElement("wy-avatar-header")
export class WyAvatarHeader extends LitElement {
  static override styles = [rebootCss, avatarCss];

  protected exportParts = new ShadowPartsController(this);

  @property()
  description?: string;

  protected override render() {
    return html`
      <slot></slot>
      ${this.description ? html`
        <div part="wy-avatar-description">${this.description}</div>
          `: nothing}
      `;
  }
}
