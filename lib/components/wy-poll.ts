import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import type { PollOptionType } from "../types/polls.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { PollVoteEventType } from "../types/polls.events";
import { NamedEvent } from "../types/generic.types";
import { QueryController } from "../controllers/query-controller";
import { getVotesOptions } from "../data/poll";
import { localized, msg, str } from "@lit/localize";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { WeavySubComponent } from "../classes/weavy-sub-component";

import pollCss from "../scss/components/poll.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-avatar";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./ui/wy-overlay";
import "./ui/wy-container";

declare global {
  interface HTMLElementTagNameMap {
    "wy-poll": WyPoll;
    "wy-poll-option": WyPollOption;
  }
}

/**
 * Poll container rendering a list of poll options.
 *
 * **Used sub components:**
 *
 * - [`<wy-poll-option>`](./wy-poll.ts)
 *
 * @csspart wy-poll - Root poll container.
 *
 * @fires {PollVoteEventType} vote - Emitted when a poll option is voted.
 */
@customElement("wy-poll")
export class WyPoll extends LitElement {
  static override styles = [
    pollCss,
    hostContentsCss
  ];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Poll options displayed in the list.
   */
  @property({ type: Array, attribute: false })
  pollOptions: PollOptionType[] = [];

  /**
   * Dispatch a `vote` event for the specified option.
   *
   * @param optionId - Identifier of the option to vote for.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", { detail: { optionId } });
    return this.dispatchEvent(event);
  }

  override render() {
    const totalVotes = this.pollOptions.reduce((prev, curr) => prev + (curr.votes?.count || 0), 0);

    return html`
      <div part="wy-poll">
        ${this.pollOptions.map(
          (option: PollOptionType) =>
            html`<wy-poll-option
              @vote=${(e: PollVoteEventType) => this.dispatchVote(e.detail.optionId)}
              .option=${option}
              .totalVotes=${totalVotes}
            ></wy-poll-option>`
        )}
      </div>
    `;
  }
}

/**
 * Poll option item showing vote meter, label and optional voter list sheet.
 *
 * **Used sub components:**
 *
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 *
 * @csspart wy-poll-option - Root poll option container.
 * @csspart wy-poll-meter - Visual meter showing vote ratio.
 * @csspart wy-poll-image - Icon/indicator area.
 * @csspart wy-poll-title - Option label.
 * @csspart wy-poll-amount - Percentage/amount element (clickable to open voter sheet).
 *
 * @fires {PollVoteEventType} vote - Emitted when this option is voted.
 */
@customElement("wy-poll-option")
@localized()
export class WyPollOption extends WeavySubComponent {
  static override styles = [pollCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Total number of votes across all options.
   */
  @property({ type: Number, attribute: false })
  totalVotes: number = 0;

  /**
   * Poll option rendered by this card.
   */
  @property({ attribute: false })
  option?: PollOptionType;

  /**
   * Whether the voter sheet dialog is visible.
   *
   * @internal
   */
  @state()
  private showSheet: boolean = false;

  /**
   * Query controller fetching voters for the option.
   *
   * @internal
   */
  getVotesQuery = new QueryController<PollOptionType>(this);

  protected override async updated(changedProperties: PropertyValueMap<this>): Promise<void> {
    if (changedProperties.has("weavy") && this.weavy && this.option && this.option.id) {
      await this.getVotesQuery.trackQuery(getVotesOptions(this.weavy, this.option.id));
    }
  }

  /**
   * Dispatch a `vote` event for the provided option id.
   *
   * @internal
   * @param optionId - Identifier of the option to vote for.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchVote(optionId?: number | null) {
    if (!optionId) {
      return;
    }

    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", { detail: { optionId } });
    return this.dispatchEvent(event);
  }

  /**
   * Toggle the voter sheet and refresh vote data.
   *
   * @internal
   * @param e - Triggering user event.
   */
  private openSheet(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    void this.getVotesQuery.observer?.refetch();
    this.showSheet = !this.showSheet;
  }

  override render() {
    if (!this.option || !this.option.id) {
      return nothing;
    }

    const { data, isLoading } = this.getVotesQuery.result ?? {};
    const ratio = this.totalVotes > 0 ? Math.round(((this.option.votes?.count || 0) / this.totalVotes) * 100) : 0;

    return html`
      <div
        part="wy-poll-option"
        tabindex="0"
        @click=${() => this.dispatchVote(this.option?.id)}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        <div part="wy-poll-meter" style="width: ${ratio + "%"}"></div>
        <div part="wy-poll-image">
          ${this.option.has_voted
            ? html`<wy-icon name="check-circle"></wy-icon>`
            : html`<wy-icon name="circle-outline"></wy-icon>`}
        </div>
        <div part="wy-poll-title">${this.option.text}</div>
        ${ratio > 0
          ? html`<span
              part="wy-poll-amount"
              tabindex="0"
              @click=${(e: Event) => this.openSheet(e)}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnSpace}
            >
              ${ratio + "%"}
            </span>`
          : html`<span part="wy-poll-amount"></span>`}
      </div>

      ${this.weavy
        ? html`
            <wy-overlay type="sheet" .show=${this.showSheet} @close=${() => (this.showSheet = false)}>
              <span slot="title">${msg(str`Votes on ${this.option.text}`)}</span>
              <wy-container scrollY padded>
                ${this.showSheet && data && !isLoading
                  ? html`
                      ${data.votes?.data
                        ? data.votes.data.map(
                            (vote) => html`
                              <wy-item>
                                <wy-avatar
                                  slot="image"
                                  .size=${32}
                                  .src=${vote.avatar_url}
                                  .name=${vote.name}
                                ></wy-avatar>
                                <span slot="title">${vote.name}</span>
                              </wy-item>
                            `
                          )
                        : nothing}
                    `
                  : nothing}
              </wy-container>
            </wy-overlay>
          `
        : nothing}
    `;
  }
}
