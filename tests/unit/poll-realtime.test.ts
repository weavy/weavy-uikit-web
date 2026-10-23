import { expect } from "@open-wc/testing";
import type { InfiniteData } from "@tanstack/query-core";

import "../utils/version";
import { Weavy, type WeavyType } from "../../lib/client/weavy";
import { getRealtimeVoteOptions, handleRealtimeVote, refreshPollOptions } from "../../lib/data/poll";
import type { MsgType } from "../../lib/types/msg.types";
import type { PostsResultType } from "../../lib/types/posts.types";
import type { RealtimeVoteEventType } from "../../lib/types/realtime.types";

describe("poll vote realtime updates", () => {
  let weavy: WeavyType;
  let requests: string[];
  const user = { id: 1, name: "Test user" };
  const otherUser = { id: 2, name: "Other user" };
  const poll = {
    id: 757,
    text: "Which day?",
    html: "Which day?",
    plain: "Which day?",
    created_at: "2026-10-21T10:00:00Z",
    created_by: user,
    options: {
      count: 2,
      data: [
        { id: 76, text: "Monday", votes: { count: 1 }, has_voted: true },
        { id: 77, text: "Tuesday" },
      ],
    },
  } as unknown as MsgType;
  const serverOptions = {
    count: 2,
    data: [
      { id: 76, text: "Monday", votes: { count: 1 }, has_voted: true },
      { id: 77, text: "Tuesday", votes: { count: 1 } },
    ],
  };
  const voteEvent = (pollId: number): RealtimeVoteEventType => ({
    id: 1,
    action: "vote_added",
    actor: otherUser,
    poll: { ...poll, id: pollId, options: { count: 2 } } as unknown as MsgType,
    option: { id: 77, text: "Tuesday", votes: { count: 1 } },
  });

  beforeEach(() => {
    weavy = new Weavy();
    requests = [];
    weavy.fetch = async (url) => {
      requests.push(url.toString());
      return Response.json({ ...poll, options: serverOptions });
    };
    // The posts list query key carries filters after the list id, so the lookup must match on the prefix.
    weavy.queryClient.setQueryData<InfiniteData<PostsResultType>>(["posts", 7, { orderBy: "id desc" }], {
      pages: [{ data: [poll as PostsResultType["data"][number]], count: 1 }],
      pageParams: [{}],
    });
  });

  afterEach(() => {
    weavy.destroy();
  });

  const cachedOptions = () =>
    weavy.queryClient.getQueryData<InfiniteData<PostsResultType>>(["posts", 7, { orderBy: "id desc" }])?.pages[0]
      .data[0].options;

  it("refetches the poll and replaces the cached options when a vote on a cached poll arrives", async () => {
    await handleRealtimeVote(weavy, "posts", ["posts", 7], voteEvent(757));

    expect(requests).to.deep.equal(["/api/posts/757"]);
    expect(cachedOptions()).to.deep.equal(serverOptions);
  });

  it("shares an in-flight fetch between the mutation refetch and the realtime event for the same vote", async () => {
    // The voter's client gets the vote event it caused while the mutation's own refetch is in flight.
    await Promise.all([
      refreshPollOptions(weavy, "posts", 757, ["posts", 7]),
      handleRealtimeVote(weavy, "posts", ["posts", 7], voteEvent(757)),
    ]);

    expect(requests).to.deep.equal(["/api/posts/757"]);
    expect(cachedOptions()).to.deep.equal(serverOptions);
  });

  it("fetches again for a vote that arrives after the previous fetch completed", async () => {
    // A fast second click, or someone else's vote right after, must not be answered with the previous counts.
    await refreshPollOptions(weavy, "posts", 757, ["posts", 7]);
    const switched = {
      count: 2,
      data: [
        { id: 76, text: "Monday" },
        { id: 77, text: "Tuesday", votes: { count: 2 }, has_voted: true },
      ],
    };
    weavy.fetch = async (url) => {
      requests.push(url.toString());
      return Response.json({ ...poll, options: switched });
    };

    await handleRealtimeVote(weavy, "posts", ["posts", 7], voteEvent(757));

    expect(requests).to.deep.equal(["/api/posts/757", "/api/posts/757"]);
    expect(cachedOptions()).to.deep.equal(switched);
  });

  it("ignores votes on polls that are not in the cache", async () => {
    await handleRealtimeVote(weavy, "posts", ["posts", 7], voteEvent(999));

    expect(requests).to.deep.equal([]);
    expect(cachedOptions()).to.equal(poll.options);
  });

  it("keeps the cached options when the fetch fails", async () => {
    weavy.fetch = async () => new Response(null, { status: 404 });

    await handleRealtimeVote(weavy, "posts", ["posts", 7], voteEvent(757));

    expect(cachedOptions()).to.equal(poll.options);
  });

  it("subscribes the same handler to added and removed votes", async () => {
    const options = getRealtimeVoteOptions(weavy, "a7", "posts", ["posts", 7]);

    expect(options.map((o) => [o.group, o.event])).to.deep.equal([
      ["a7", "vote_added"],
      ["a7", "vote_removed"],
    ]);

    await options[1].onMessage({ ...voteEvent(757), action: "vote_removed" });
    expect(requests).to.deep.equal(["/api/posts/757"]);
    expect(cachedOptions()).to.deep.equal(serverOptions);
  });
});
