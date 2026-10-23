import { expect } from "@open-wc/testing";
import type { InfiniteData, QueryKey } from "@tanstack/query-core";

import "../utils/version";
import { Weavy, type WeavyType } from "../../lib/client/weavy";
import { WyCommentList } from "../../lib/components/wy-comment-list";
import { getCommentsOptions } from "../../lib/data/comments";
import { reactionMutation } from "../../lib/data/reactions";
import { EntityTypeString } from "../../lib/types/app.types";
import type { CommentsResultType } from "../../lib/types/comments.types";
import type { MsgType } from "../../lib/types/msg.types";
import type { RealtimeReactionEventType } from "../../lib/types/realtime.types";

describe("reaction cache updates", () => {
  let weavy: WeavyType;
  const user = { id: 1, name: "Test user" };
  const otherUser = { id: 2, name: "Other user" };
  const firstEmoji = "\u{1F44D}";
  const secondEmoji = "\u{1F389}";
  const comment: MsgType = {
    id: 100,
    text: "Comment",
    html: "Comment",
    plain: "Comment",
    created_at: "2026-10-15T10:00:00Z",
    created_by: user,
    is_starred: false,
    is_subscribed: false,
    is_trashed: false,
    reactions: { count: 1, data: [{ content: firstEmoji, created_by: otherUser }] },
  };

  beforeEach(() => {
    weavy = new Weavy();
    weavy.fetch = async () => new Response(null, { status: 204 });
  });

  afterEach(() => {
    weavy.destroy();
  });

  /** Seeds a paged list with another item to verify that only the target entity changes. */
  function seed(queryKey: QueryKey) {
    weavy.queryClient.setQueryData<InfiniteData<CommentsResultType>>(queryKey, {
      pages: [
        { count: 2, data: [{ ...comment, id: 101 }] },
        { count: 2, data: [comment] },
      ],
      pageParams: [0, 1],
    });
  }

  /** Reads the target entity's rendered reaction data from its cached page. */
  function reactions(queryKey: QueryKey) {
    return weavy.queryClient.getQueryData<InfiniteData<CommentsResultType>>(queryKey)?.pages[1].data?.[0].reactions.data;
  }

  for (const parentType of ["apps", "posts", "files"] as const) {
    it(`adds, changes and removes reactions in every ${parentType} comment paging variant`, async () => {
      const keys = [undefined, comment.id].map(
        (around) => getCommentsOptions(weavy, parentType, 42, around).queryKey,
      );
      keys.forEach(seed);
      const unrelatedKey = getCommentsOptions(weavy, parentType, 43).queryKey;
      seed(unrelatedKey);

      for (const content of [firstEmoji, secondEmoji, undefined]) {
        await reactionMutation(weavy, 42, parentType, comment.id, "comments", content, user).mutate();

        for (const key of keys) {
          expect(reactions(key)).to.deep.equal([
            { content: firstEmoji, created_by: otherUser },
            ...(content ? [{ content, created_by: user }] : []),
          ]);
          expect(weavy.queryClient.getQueryData<InfiniteData<CommentsResultType>>(key)?.pages[0].data?.[0])
            .to.deep.equal({ ...comment, id: 101 });
        }
        expect(reactions(unrelatedKey)).to.deep.equal(comment.reactions.data);
      }
    });

    it(`applies realtime reaction additions and removals to every ${parentType} comment paging variant`, () => {
      const keys = [undefined, comment.id].map(
        (around) => getCommentsOptions(weavy, parentType, 42, around).queryKey,
      );
      keys.forEach(seed);
      const list = new WyCommentList();
      list.weavy = weavy;
      list.location = parentType;
      list.parentId = 42;
      const event: RealtimeReactionEventType = {
        id: 1,
        action: "reaction_added",
        entity: { id: comment.id, type: EntityTypeString.Comment },
        reaction: secondEmoji,
        actor: user,
      };

      list.handleRealtimeReactionAdded(event);
      keys.forEach((key) => expect(reactions(key)).to.deep.equal([
        { content: firstEmoji, created_by: otherUser },
        { content: secondEmoji, created_by: user },
      ]));

      list.handleRealtimeReactionDeleted(event);
      keys.forEach((key) => expect(reactions(key)).to.deep.equal(comment.reactions.data));
    });
  }

  it("updates app posts, filtered feeds and messages using their existing query keys", async () => {
    const postKeys = [["posts", 42, {}], ["posts", 42, { tag: "test" }], ["posts", "feed", {}]];
    postKeys.forEach(seed);
    const messageKey = ["messages", 42];
    seed(messageKey);

    await reactionMutation(weavy, 42, "apps", comment.id, "posts", secondEmoji, user).mutate();
    postKeys.forEach((key) => expect(reactions(key)?.find((r) => r.created_by?.id === user.id)?.content)
      .to.equal(secondEmoji));
    expect(reactions(messageKey)).to.deep.equal(comment.reactions.data);

    await reactionMutation(weavy, 42, "apps", comment.id, "messages", secondEmoji, user).mutate();
    expect(reactions(messageKey)?.find((r) => r.created_by?.id === user.id)?.content).to.equal(secondEmoji);
  });
});
