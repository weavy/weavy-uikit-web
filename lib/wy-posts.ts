import { html, nothing } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { AppTypeGuid, EntityTypeString, LinkType } from "./types/app.types";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";
import { getCacheItem } from "./utils/query-cache";
import type { PostQueryFilterType, PostType, PostQueryFilterProps } from "./types/posts.types";
import { SearchEventType } from "./types/search.events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { WeavyAppComponent } from "./classes/weavy-app-component";
import { cleanFalsyProperties } from "./utils/objects";

import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostFillCss from "./scss/host-fill.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-button";
import "./components/wy-post-form";
import "./components/wy-user-card";
import "./components/ui/wy-search";
import { WyPostList } from "./components/wy-post-list";

declare global {
  interface HTMLElementTagNameMap {
    "wy-posts": WyPosts;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyLinkEventType } from "./types/notifications.events"
 * @import { WyUnreadEventType } from "./types/ui.events"
 * @import { WyActionEventType } from "./types/action.events"
 */

/**
 * Weavy posts component to render a feed of posts and comments as seen on many social networks. This component _does not_ include a post editor, but can be used together with the [`<wy-post-editor>`](./wy-post-editor.ts) component to build a complete feed with post creation capabilities.
 *
 * The content of each post is built up from the posted text, images, polls, embeds, links, audio, video, file attachments, and cloud files. Each post can be commented on and reacted to with a set of emoji reactions. Images, audio, video, attached files, and cloud files can be previewed with the built-in previewer supporting 100+ file formats including PDF, Office and Google Drive.
 *
 * The posts component can be configured with or without app identifiers (`uid`) to show either an aggregated feed from _all_ post apps that are available to the user, or by configuring one or multiple post app identifiers using the `uid` attribute to show only specific post apps.
 *
 * Specifying only one `uid` allows automatic creation of a [corresponding post app](https://www.weavy.com/docs/concepts#app) on the server the first time it's accessed. When using multiple uid:s, all the specified post apps must exist prior to loading the feed.
 *
 * When using a single `uid`, it's also recommended to specify a readable `name` of the posts app, to get better readable listing and notifications from the app.
 *
 * > It's often useful to base the `uid` on something that identifies the location where the component is rendered.
 * > Typically you would use something like a product id, page id, or path.
 *
 * The list of posts can be refined to only show posts by other users that the current user follows using the `following` attribute.
 *
 * A search field can be enabled for users by adding the `search` attribute. Searching can also be handled programmatically using the `query` property, which also reflects the search field in the UI.
 *
 * This component is great if you want to decouple the feed from the editor, for instance to place [`<wy-post-editor>`](./wy-post-editor.ts) in a different part of the screen or to use the feed without an editor.
 *
 * **Component Layout**
 *
 * The component displays a list of posts with an optional search field in the top of the list. The feed is without a post editor, which can be used and configured separately by using the [`<wy-post-editor>`](./wy-post-editor.ts) component or in combination using the [`<wy-feed>`](./wy-feed) component.
 *
 * Each post had a header in the top with information about the user together with an avatar. Next comes any attached images or embedded content and then the right formatted text. This is followed by polls and file attachments. In the bottom of the post is reactions and an expandable rich comment section.
 *
 * The component is [block-level](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content) with pre-defined CSS styling to adapt to flex- and grid-layouts as well as traditional flow-layouts.
 * It's usually recommended to use a proper flex-layout for the container you are placing the component in for a smooth layout integration.
 *
 * The height grows with the content per default. Content is automatically loaded during scrolling when the last content becomes visible (aka infinite scrolling).
 * If placed in a flex- or grid-layout or if an explicit height is set, the component becomes scrollable.
 *
 * The content within the components is per default aligned to the edges of it's own _box_ and designed to not be placed next to a edge or border.
 * It's recommended to adjust the layout with your default padding. Setting the `--wy-padding-outer` to your default padding will allow the component to still fill the are where it's placed,
 * but with proper padding within the scrollable area of the component.
 * If you want to make the component go all the way to the edges without padding or any outermost roundness instead,
 * set `--wy-padding-outer: 0;` and `--wy-border-radius-outer: 0;` to make the component fit nicely with the edge.
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
 *
 * **Used sub components:**
 *
 * - [`<wy-buttons>`](./components/ui/wy-button.ts)
 * - [`<wy-container>`](./components/ui/wy-container.ts)
 * - [`<wy-search>`](./components/ui/wy-search.ts)
 * - [`<wy-post-list>`](./components/wy-post-list.ts)
 * - [`<wy-user-card>`](./components/wy-user-card.ts)
 *
 *
 * @tagname wy-posts
 * @slot actions - Floating buttons placed in the top right.
 * @csspart wy-posts - Root posts container.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an embed.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 *
 * @example <caption>All posts feed with a search field</caption>
 *
 * Display a post feed from all the posts app available to the user, together with a search field at the top.
 *
 * ```html
 * <wy-posts search></wy-posts>
 * ```
 *
 * @example <caption>Posts feed from followed people</caption>
 *
 * Display a feed with all posts from people the user follows.
 *
 * ```html
 * <wy-posts following></wy-posts>
 * ```
 *
 * @example <caption>Creating and showing a single app for posts</caption>
 *
 * Specifying a single app identifier (`uid`), automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized. It's recommended to specify a readable `name` of the posts app, to get better readable notifications from the app.
 *
 * ```html
 * <wy-posts uid="test-posts" name="Test feed"></wy-feed>
 * ```
 *
 * @example <caption>Multiple post apps feed with a search field</caption>
 *
 * Specifying multiple app identifiers (`uid`) separated by space, shows posts from several already created post apps. Here the search field is also enabled for the user.
 *
 * ```html
 * <wy-posts uid="test-posts test-news" search></wy-feed>
 * ```
 *
 * @example <caption>Multiple post apps feed from followed people</caption>
 *
 * A post feed from multiple post apps, displaying only posts made by people the user follows.
 *
 * ```html
 * <wy-posts uid="test-posts test-news" following></wy-feed>
 * ```
 */
@customElement("wy-posts")
export class WyPosts extends WeavyAppComponent implements PostQueryFilterProps {
  static override styles = [colorModesCss, hostFillCss, hostBlockCss, hostPaddedCss, hostScrollYCss, hostFontCss];

  /** @internal */
  override appType = AppTypeGuid.Posts;

  /** @internal */
  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.CloudFiles]: true,
    [Feature.Comments]: true,
    [Feature.Comment]: true,
    [Feature.ContextData]: true,
    [Feature.Embeds]: true,
    [Feature.Follow]: true,
    [Feature.GoogleMeet]: false,
    [Feature.Meetings]: false,
    [Feature.Mentions]: true,
    [Feature.MicrosoftTeams]: false,
    [Feature.Polls]: true,
    [Feature.Previews]: true,
    [Feature.Reactions]: true,
    [Feature.Typing]: false, // Has no effect currently
    [Feature.ZoomMeetings]: false,
  });

  /**
   * Matches apps and checks if the cache has the post.
   * @internal
   */
  override matchesLink(link?: LinkType): boolean {
    const appMatch =
      // Normal contextual app
      link &&
      link.app &&
      (this.uids.some(
        (uid) =>
          (typeof uid === "string" && link.app?.uid === uid) || // Normal app with app uid
          (typeof uid === "number" && link.app?.id === uid), // Normal app with app id
      ) ||
        this.apps?.some((app) => app.id === link.app?.id));

    const genericFeedMatch = link && !this.uids.length && !this.apps?.length;

    if (appMatch) {
      return true;
    } else if (this.weavy && genericFeedMatch) {
      // Match for any post in the feed
      const postId =
        link.type === EntityTypeString.Post
          ? link.id
          : link.type === EntityTypeString.Comment && link.parent?.type === EntityTypeString.Post
            ? link.parent.id
            : undefined;
      const cleanedFilter = cleanFalsyProperties({ ...this.#filter });
      return Boolean(
        postId && getCacheItem<PostType>(this.weavy.queryClient, ["posts", "feed", cleanedFilter], postId),
      );
    }
    return false;
  }

  /** @internal */
  protected theme = new ThemeController(this, WyPosts.styles);

  /**
   * Reference to the post list
   *
   * @internal
   */
  private postListRef: Ref<WyPostList> = createRef();

  /** Current unread posts count. */
  get unread(): number {
    return this.postListRef.value?.unread || 0;
  }

  /** Show search field. */
  @property({ type: Boolean })
  search: boolean = false;

  /** Only show posts by users followed by the current user. */
  @property({ type: Boolean })
  following: boolean = false;

  /** Show post by search query filter. */
  @property()
  query?: string | null;

  /* Show posts by tag filter. */
  @property()
  tag?: string | null;

  /**
   * Placeholder text for the post editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  /**
   * Combined query filter.
   * @internal
   */
  get #filter(): PostQueryFilterType {
    return {
      app: this.uids,
      q: this.query || undefined,
      tag: this.tag || undefined,
      trashed: false,
      following: this.following,
      order_by: "id desc",
    };
  }

  override render() {
    return html`
      ${!this.search
        ? html`<wy-buttons position="floating" reverse><slot name="actions"></slot></wy-buttons>`
        : nothing}
      <wy-container part="wy-posts" padded outer gap="xl">
        ${this.search
          ? html`
              <wy-buttons position="sticky">
                <wy-search
                  compact
                  query=${this.query || undefined}
                  @search=${(e: SearchEventType) => (this.query = e.detail.query)}
                ></wy-search>
                <slot name="actions"></slot>
              </wy-buttons>
            `
          : nothing}
        <wy-post-list
          .placeholder=${this.placeholder}
          ?feed=${this.uids.length !== 1 || (this.apps && this.apps.length > 1)}
          ${ref(this.postListRef)}
          .filter=${this.#filter}
        ></wy-post-list>
      </wy-container>
      <wy-user-card .listenTo=${this}></wy-user-card>
    `;
  }
}
