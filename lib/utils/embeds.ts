import { type WeavyType } from "../client/weavy";
import { EmbedType } from "../types/embeds.types";
import { throwOnDomNotAvailable } from "./dom";

const regexp = /(((https?|ftp):\/\/|(www|ftp)\.)[\w]+(.[\w]+)([\w\-.,@?^=%&amp;:/~+#]*[\w\-@?^=%&amp;/~+#]))/gim;

let latest: string[] = [];
let embeds: string[] = [];
let failed: string[] = [];
let rejected: string[] = [];
let candidates: { [string: string]: number } = {};

const arrayEquals = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function isFetchingEmbeds() {
  return Boolean(Object.keys(candidates).length);
}

async function fetchEmbed(url: string, weavy: WeavyType) {
  const data = new FormData();
  data.append("url", url);

  let embed: EmbedType | undefined = undefined;

  try {
    const response = await weavy.fetch("/api/embeds", { method: "POST", body: JSON.stringify({ url: url }) });

    if (!response.ok) {
      throw new Error();
    }

    embed = await response.json() as EmbedType;
    delete candidates[url];
    embeds = [...embeds, url];
  } catch {
    // error, add to failed so that we don't fetch again
    failed = [...failed, url];
    delete candidates[url];
  }

  return embed;
}

export const clearEmbeds = () => {
  latest = [];
  embeds = [];
  failed = [];
  rejected = [];
  candidates = {};
};

export const initEmbeds = (urls: string[]) => {
  embeds = urls;
};

export const getEmbeds = (content: string, callback: (embed: EmbedType) => void, weavy: WeavyType) => {
  let matches = content.match(regexp)?.map((match) => match) || null;

  if (matches !== null) {
    matches = matches.map((url) => {
      if (url.startsWith("//")) {
        return "http:" + url;
      } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return "http://" + url;
      } else {
        return url;
      }
    });
  }

  // REVIEW: Make use of tanstack instead?

  if (matches === null || matches.length === 0) {
    // no matches
    //console.log(latest, embeds, failed, candidates, rejected)
  } else if (matches.length !== latest.length || !arrayEquals(matches, latest)) {
    // matches has changed{
    // keep matches for comparing next time the doc is updated
    latest = matches;

    matches.forEach((match: string) => {
      // add match if not already an embed, not failed or rejected before and not already a candidate
      if (
        !embeds.includes(match) &&
        !failed.includes(match) &&
        !rejected.includes(match) &&
        typeof candidates[match] === "undefined"
      ) {
        throwOnDomNotAvailable();

        candidates[match] = window.setTimeout(async () => {
          const embed = await fetchEmbed(match, weavy);
          if (embed) {
            callback(embed);
          }
        }, 500);
        // setCandidates((prev) => {
        //     prev[match] = setTimeout(() => { fetchEmbed(match); }, 500);
        //     return prev;
        // });
      }
    });

    // remove from rejected
    rejected = rejected.filter((rejected) => latest.includes(rejected));

    // remove candidates
    for (const candidate in candidates) {
      if (!latest.includes(candidate)) {
        throwOnDomNotAvailable();

        window.clearTimeout(candidates[candidate]);
        delete candidates[candidate];
      }
    }
  }
};
