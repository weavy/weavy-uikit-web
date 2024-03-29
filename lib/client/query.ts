import { WeavyContext } from "./weavy-context";
import { QueryClient, type Mutation } from "@tanstack/query-core";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  type Persister,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core";
import { DestroyError } from "../utils/errors";
import { observeConnected } from "../utils/dom";
import type { FileMutationContextType } from "../types/files.types";
import { type WeavyContextOptionsType } from "../types/weavy.types";

export interface WeavyQueryProps {
  queryClient: QueryClient;
  createQueryClient: () => Promise<void>;
  disconnectQueryClient: () => Promise<void>;
}

// WeavyQuery mixin/decorator
export const WeavyQuery = (base: typeof WeavyContext) => {
  return class WeavyQuery extends base implements WeavyQueryProps {
    // QUERY CLIENT

    constructor(options: WeavyContextOptionsType) {
      super(options);

      this.createQueryClient();

      if (this.host.isConnected) {
        this.#queryClient.mount();
      }

      this.#hostIsConnectedObserver = observeConnected(this.host, (isConnected) => {
        if (this.isDestroyed) {
          return;
        }

        if (isConnected) {
          console.log(this.weavyId, "Query client mounted");
          this.#queryClient.mount();
        } else {
          console.log(this.weavyId, "Query client unmounted");
          this.#queryClient.unmount();
        }
      });
    }

    #hostIsConnectedObserver: ResizeObserver;

    #queryClient!: QueryClient;
    #unsubscribeQueryClient?: () => void;
    #sessionStoragePersister?: Persister;

    get queryClient() {
      return this.#queryClient;
    }

    async createQueryClient() {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      this.#queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: this.staleTime,
            gcTime: this.gcTime,
          },
        },
      });

      //const localStoragePersister = createSyncStoragePersister({ storage: window.localStorage })
      try {
        this.#sessionStoragePersister = createSyncStoragePersister({
          key: "WEAVY_QUERY_OFFLINE_CACHE",
          storage: window.sessionStorage,
          throttleTime: this.staleTime,
        });

        // TODO: Move to "modern" persistQueryClient?
        const persistQueryClientOptions = {
          queryClient: this.#queryClient,
          persister: this.#sessionStoragePersister,
          maxAge: this.gcTime, // 24h - should match gcTime
          buster: WeavyContext.version, // Cache busting parameter (build hash or similar)
          hydrateOptions: undefined,
          dehydrateOptions: {
            shouldDehydrateMutation: (mutation: Mutation) => {
              const isPendingUpload = (mutation.state.context as FileMutationContextType)?.status?.state === "pending";
              return Boolean((mutation.state.context && !isPendingUpload) || mutation.state.isPaused);
            },
          },
        };

        await persistQueryClientRestore(persistQueryClientOptions);
        this.#unsubscribeQueryClient = persistQueryClientSubscribe(persistQueryClientOptions);
      } catch (e) {
        console.warn(this.weavyId, "Query cache persister not available.");
      }

      //console.log(this.weavyId, "Query cache restored from session", this.#queryClient.getMutationCache())
    }

    async disconnectQueryClient() {
      console.log(this.weavyId, "Query client disconnected");
      await this.#queryClient.cancelQueries();
      this.queryClient.setQueriesData({}, undefined);
      this.queryClient.resetQueries();
      this.#sessionStoragePersister?.removeClient();
      this.#unsubscribeQueryClient?.();
      this.#queryClient.unmount();
      this.#queryClient.clear();
    }

    override destroy() {
      super.destroy();

      this.#hostIsConnectedObserver.disconnect();
      this.disconnectQueryClient();
    }
  };
};
