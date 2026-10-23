import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

type DevUser = {
  name: string;
  username: string;
  picture?: string;
  is_selected: boolean;
};

/**
 * Dev-only badge showing which user the auth server session is currently signed in as.
 * The user is switched on the index page (/), so the badge links there.
 *
 * Auto-appends itself to <body> when the module is loaded, so dev pages only need:
 *   <script type="module" src="/utils/dev-user.ts" async defer></script>
 */
@customElement("dev-current-user")
export default class DevCurrentUser extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      top: 0.5rem;
      right: 0.5rem;
      z-index: 100000;
      font-family: system-ui, sans-serif;
      font-size: 0.75rem;
    }

    :host([position="top-left"]),
    :host([position="bottom-left"]) {
      right: auto;
      left: 0.5rem;
    }

    /* Bottom corners are useful on pages where the top edge is taken by page chrome. */
    :host([position="bottom-right"]),
    :host([position="bottom-left"]) {
      top: auto;
      bottom: 0.5rem;
    }

    a {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem 0.25rem 0.25rem;
      border-radius: 1rem;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      text-decoration: none;
      opacity: 0.75;
    }

    a:hover {
      opacity: 1;
    }

    img {
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
    }
  `;

  /**
   * Corner of the viewport to pin the badge to. Pages that place the element manually can set this attribute;
   * the auto-appended badge uses the default.
   */
  @property({ reflect: true })
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" = "top-right";

  @state()
  user?: DevUser;

  override async connectedCallback() {
    super.connectedCallback();
    try {
      // same session-aware endpoint the index page uses to preselect the user dropdown
      const response = await fetch("/api/users", { credentials: "include" });
      const users = (await response.json()) as DevUser[];
      // the auth server falls back to the first user when the session has no selection
      this.user = users.find((u) => u.is_selected) ?? users[0];
    } catch {
      // auth server not running; render nothing
    }
  }

  override render() {
    if (!this.user) {
      return nothing;
    }

    return html`
      <a href="/" title="Signed in as ${this.user.username} — switch user on the index page">
        ${this.user.picture ? html`<img src=${this.user.picture} alt="" />` : nothing}
        <span>${this.user.name}</span>
      </a>
    `;
  }
}

// Auto-append so pages don't need any markup, only the script tag. Guarded so a page
// can also place the element manually with a specific position without getting a duplicate badge.
function appendBadge() {
  if (!document.querySelector("dev-current-user")) {
    document.body.append(document.createElement("dev-current-user"));
  }
}

// The script tag is async, so the module can run before the body is parsed; wait for the DOM so a manually
// placed element is found by the guard above.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", appendBadge);
} else {
  appendBadge();
}
