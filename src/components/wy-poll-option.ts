import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { portal } from "lit-modal-portal";
import chatCss from "../scss/all.scss";
import type { PollOptionType } from "../types/polls.types";
import { QueryController } from "../controllers/query-controller";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { getVotesOptions } from "../data/poll";
import { UserType } from "../types/users.types";
import { localized, msg, str } from "@lit/localize";

import "./wy-sheet";
import "./wy-avatar";
import "./wy-icon";
import { WeavyContextProps } from "../types/weavy.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "src/utils/keyboard";

@customElement("wy-poll-option")
@localized()
export default class WyPollOption extends LitElement {
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ type: Number, attribute: false })
  totalVotes!: number;

  @property({ attribute: false })
  option!: PollOptionType;

  @state()
  private showSheet: boolean = false;

  @state()
  private sheetId: string = "";

  getVotesQuery = new QueryController<UserType[]>(this);

  protected override updated(changedProperties: PropertyValues<this & WeavyContextProps>): void {
    if (changedProperties.has("weavyContext") && this.weavyContext && this.option) {
      this.getVotesQuery.trackQuery(getVotesOptions(this.weavyContext, this.option.id!));
      this.sheetId = "sheet-post-" + this.option.id;
    }
  }

  private dispatchVote(id: number) {
    const event = new CustomEvent("vote", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private openSheet(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(
      new CustomEvent("wy-global-sheets-remove", {
        bubbles: true,
        composed: true,
        detail: { originSheetId: this.sheetId },
      })
    );
    this.getVotesQuery.observer?.refetch();
    this.showSheet = !this.showSheet;
  }

  override render() {
    const { data, isLoading } = this.getVotesQuery.result ?? {};
    const ratio = this.totalVotes > 0 ? Math.round(((this.option.vote_count || 0) / this.totalVotes) * 100) : 0;
    return html`
      <div
        class="wy-item wy-poll-option"
        tabindex="0"
        @click=${() => this.dispatchVote(this.option.id!)}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        <div class="wy-progress" style="width: ${ratio + "%"}"></div>
        ${this.option.has_voted
          ? html`<wy-icon name="check-circle"></wy-icon>`
          : html`<wy-icon name="circle-outline"></wy-icon>`}
        <div class="wy-item-body">${this.option.text}</div>
        ${ratio > 0
          ? html`<span
              class="wy-facepile"
              tabindex="0"
              @click=${(e: Event) => this.openSheet(e)}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnSpace}
            >
              ${ratio + "%"}
            </span>`
          : nothing}
      </div>

      ${portal(
        this.showSheet,
        html`
          <wy-sheet
            .show=${this.showSheet}
            .sheetId="${this.sheetId}"
            @release-focus=${() =>
              this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
          >
            <span slot="appbar-text">${msg(str`Votes on ${this.option.text}`)}</span>
            <!-- <wy-spinner></wy-spinner> -->
            ${data && !isLoading
              ? html`
                  ${data.map(
                    (vote) => html`
                      <div class="wy-item">
                        <wy-avatar .size=${32} .src=${vote.avatar_url} .name=${vote.display_name}></wy-avatar>
                        <div class="wy-item-body">${vote.display_name}</div>
                      </div>
                    `
                  )}
                `
              : nothing}
          </wy-sheet>
        `,
        () => (this.showSheet = false)
      )}
    `;
  }
}
