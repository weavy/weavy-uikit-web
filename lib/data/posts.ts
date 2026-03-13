import type {
  InfiniteQueryObserverOptions,
  MutationKey,
  MutationObserverOptions,
  InfiniteData,
  QueryObserverOptions,
  Query,
} from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { addCacheItems, updateCacheItems } from "../utils/query-cache";
import {
  MutatePostProps,
  PostQueryFilterType,
  PostType,
  PostsResultType,
  MutatePostTempData,
} from "../types/posts.types";
import { PollOptionType } from "../types/polls.types";
import { cleanFalsyProperties, flattenToSearchParams } from "../utils/objects";
import { getApiOptions } from "./api";
import { isQueryFilter } from "../types/query.types";
import {
  RealtimeCommentEventType,
  RealtimeGroupType,
  RealtimeOptionsType,
  RealtimeReactionEventType,
} from "../types/realtime.types";
import { ComponentFeaturePolicy, Feature, UserType } from "../contexts";
import { AppType, EntityTypeString } from "../types/app.types";
import { MsgType } from "../types/msg.types";
import { updateReaction } from "./reactions";

export function getPostsOptions(
  weavy: WeavyType,
  appId: number | "feed",
  postFilter: PostQueryFilterType = {
    app: undefined,
    q: "",
    tag: "",
    trashed: false,
    following: false,
    order_by: "id desc",
  },
  countOnly: boolean = false,
): InfiniteQueryObserverOptions<PostsResultType, Error, InfiniteData<PostsResultType>> {
  const cleanedFilter = cleanFalsyProperties({ ...postFilter, count_only: countOnly });
  const filterParams = new URLSearchParams(flattenToSearchParams(cleanedFilter));

  return {
    initialPageParam: 0,
    queryKey: ["posts", appId, cleanedFilter],
    queryFn: async (opt) => {
      const skip = opt.pageParam as number;

      const queryParams = new URLSearchParams(filterParams);
      queryParams.append("out", "details");
      queryParams.append("skip", skip.toString());

      const url =
        appId === "feed"
          ? `/api/posts?${queryParams.toString()}`
          : `/api/apps/${appId}/posts?${queryParams.toString()}`;

      const response = await weavy.fetch(url);
      const result = (await response.json()) as PostsResultType;
      result.data = result.data || [];
      return result;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.end && lastPage.end < lastPage.count) {
        return lastPage.end;
      }
      return undefined;
    },
  };
}

export function getUpdatePostMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const queryClient = weavy.queryClient;

  const options = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavy.fetch("/api/posts/" + variables.id, {
        method: "PATCH",
        body: JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          attachments: variables.attachments,
          meeting_id: variables.meeting_id,
          options: variables.poll_options
            .filter((o: PollOptionType) => o.text.trim() !== "")
            .map((o: PollOptionType) => {
              return { id: o.id, text: o.text };
            }),
          embed_id: variables.embed_id || null,
        }),
      });
      return (await response.json()) as PostType;
    },
    mutationKey: mutationKey,
    onMutate: (variables: MutatePostProps) => {
      updateCacheItems<PostType>(
        queryClient,
        [
          { queryKey: ["posts", variables.app_id], exact: false },
          { queryKey: ["posts", "feed"], exact: false },
        ],
        variables.id,
        (item) => ({
          ...item,
          text: variables.text,
          html: variables.text,
        }),
      );
    },
    onSuccess: (data: PostType, variables: MutatePostProps) => {
      if (variables.id) {
        updateCacheItems<PostType>(
          queryClient,
          [
            { queryKey: ["posts", variables.app_id], exact: false },
            { queryKey: ["posts", "feed"], exact: false },
          ],
          variables.id,
          () => data,
        );
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"], exact: false });
    },
  };

  return options;
}

export function getAddPostMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const queryClient = weavy.queryClient;

  const options: MutationObserverOptions<PostType, Error, MutatePostProps, MutatePostTempData> = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavy.fetch("/api/apps/" + variables.app_id + "/posts", {
        method: "POST",
        body: JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          meeting_id: variables.meeting_id,
          options: variables.poll_options
            .filter((o: PollOptionType) => o.text.trim() !== "")
            .map((o: PollOptionType) => {
              return { text: o.text };
            }),
          embed_id: variables.embed_id,
          context: variables.context,
        }),
      });
      return (await response.json()) as PostType;
    },
    mutationKey: mutationKey,
    onMutate: async (variables: MutatePostProps) => {
      const queryKey = ["posts", variables.app_id];

      await queryClient.cancelQueries({ queryKey: queryKey });

      const tempId = -1 * Date.now();

      const tempPost: PostType = {
        id: tempId,
        app: { id: variables.app_id },
        is_subscribed: true,
        is_trashed: false,
        text: variables.text,
        html: variables.text,
        plain: variables.text,
        created_by: variables.user,
        created_at: new Date().toUTCString(),
        attachments: { count: 0 },
        reactions: { count: 0 },
        is_starred: false,
        comments: { count: 0 },
      };

      addCacheItems(
        queryClient,
        [
          { queryKey: ["posts", variables.app_id], exact: false, predicate: (query) => permitsOptimisticPost(query) },
          { queryKey: ["posts", "feed"], exact: false, predicate: (query) => permitsOptimisticPost(query) },
        ],
        tempPost,
      );

      return { tempPost };
    },
    onSuccess: (post, variables, onMutateResult) => {
      addCacheItems(
        queryClient,
        [
          { queryKey: ["posts", variables.app_id], exact: false, predicate: (query) => permitsOptimisticPost(query) },
          { queryKey: ["posts", "feed"], exact: false, predicate: (query) => permitsOptimisticPost(query) },
        ],
        post,
        onMutateResult.tempPost.id,
      );

      // Cache must be invalidated, since new posts might not have been fetched yet, which would cause an invalid list state
      // It's also important to invalidate all count queries to keep count in sync
      void queryClient.invalidateQueries({ queryKey: ["posts", variables.app_id], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"], exact: false });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"], exact: false });
    },
  };

  return options;
}

/**
 * Return true if we can insert a
 */
export function permitsOptimisticPost(query: Query) {
  const lastKey = query.queryKey.at(-1);
  if (isQueryFilter(lastKey)) {
    // Only allow query if it doesn't use q, tag or trashed
    if (lastKey.q || lastKey.tag || lastKey.trashed) {
      return false;
    }
  }
  return true;
}

export function getPostsCountOptions(
  weavy: WeavyType,
  app: AppType | "feed",
  afterId?: number,
  postFilter: PostQueryFilterType = {
    app: undefined,
    q: "",
    tag: "",
    trashed: false,
    following: false,
    order_by: undefined,
  },
  options: Partial<QueryObserverOptions<PostsResultType>> = {},
) {
  const cleanedFilter = cleanFalsyProperties({ ...postFilter, count_only: true, after: afterId });

  const queryKey = ["posts", app === "feed" ? "feed" : app.id, "count", cleanedFilter];
  const queryParams = new URLSearchParams(flattenToSearchParams(cleanedFilter));

  const url =
    app === "feed" ? `/api/posts?${queryParams.toString()}` : `/api/apps/${app.id}/posts?${queryParams.toString()}`;

  return getApiOptions<PostsResultType>(weavy, queryKey, url, options);
}

export function getRealtimePostOptions(
  weavy: WeavyType,
  componentFeatures: ComponentFeaturePolicy,
  app: AppType,
  user: UserType,
  post?: PostType,
) {
  const group: RealtimeGroupType = `a${app.id}`;
  const listId: number | "feed" = post ? "feed" : app.id;

  return [
    <RealtimeOptionsType>{
      group,
      event: "comment_created",
      onMessage: (realtimeEvent: RealtimeCommentEventType) => {
        if (
          realtimeEvent.actor.id === user.id ||
          realtimeEvent.comment.parent?.type !== EntityTypeString.Post ||
          (post && post.id !== realtimeEvent.comment.parent.id)
        ) {
          return;
        }

        updateCacheItems<PostType>(
          weavy.queryClient,
          [{ queryKey: ["posts", listId], exact: false }],
          realtimeEvent.comment.parent.id,
          (item) => {
            if (item.comments) {
              item.comments.count += 1;
            } else {
              item.comments = { count: 1 };
            }
            return item;
          },
        );

        void weavy.queryClient.invalidateQueries({
          queryKey: ["posts", "comments", realtimeEvent.comment.parent.id],
        });
      },
    },
    componentFeatures.allowsFeature(Feature.Reactions)
      ? <RealtimeOptionsType>{
          group,
          event: "reaction_added",
          onMessage: (realtimeEvent: RealtimeReactionEventType) => {
            if (realtimeEvent.entity.type !== EntityTypeString.Post) {
              return;
            }

            updateCacheItems<MsgType>(
              weavy.queryClient,
              [{ queryKey: ["posts", listId], exact: false }],
              realtimeEvent.entity.id,
              (item) => updateReaction(item, realtimeEvent.reaction, realtimeEvent.actor),
            );

            // TODO: open sheet should also be updated in some way?
          },
        }
      : undefined,
    componentFeatures.allowsFeature(Feature.Reactions)
      ? <RealtimeOptionsType>{
          group,
          event: "reaction_removed",
          onMessage: (realtimeEvent: RealtimeReactionEventType) => {
            if (realtimeEvent.entity.type !== EntityTypeString.Post) {
              return;
            }

            updateCacheItems<MsgType>(
              weavy.queryClient,
              [{ queryKey: ["posts", listId], exact: false }],
              realtimeEvent.entity.id,
              (item) => updateReaction(item, undefined, realtimeEvent.actor),
            );

            // TODO: open sheet should also be updated in some way?
          },
        }
      : undefined,
  ];
}
