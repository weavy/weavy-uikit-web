import { WeavyClient } from "./weavy";
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
import { Constructor } from "../types/generic.types";

export interface WeavyQueryProps {
  queryClient: QueryClient;
  initQueryClient: () => void;
  disconnectQueryClient: () => Promise<void>;
}

// WeavyQuery mixin/decorator
export const WeavyQueryMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyQuery extends Base implements WeavyQueryProps {
    // QUERY CLIENT

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      this._queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: this.staleTime,
            gcTime: this.gcTime,
          },
        },
      });

      this.initQueryClient();
    }

    _hostIsConnectedObserver?: ResizeObserver;

    _queryClient: QueryClient;
    _unsubscribeQueryClient?: () => void;
    _sessionStoragePersister?: Persister;

    get queryClient() {
      return this._queryClient;
    }

    async initQueryClient() {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      await this.whenUrl()

      //const localStoragePersister = createSyncStoragePersister({ storage: window.localStorage })
      try {
        this._sessionStoragePersister = createSyncStoragePersister({
          key: "WEAVY_QUERY_OFFLINE_CACHE",
          storage: window.sessionStorage,
          throttleTime: this.staleTime,
        });

        // TODO: Move to "modern" persistQueryClient?
        const persistQueryClientOptions = {
          queryClient: this._queryClient,
          persister: this._sessionStoragePersister,
          maxAge: this.gcTime, // 24h - should match gcTime
          buster: this.cachePrefix, // Cache busting parameter (build hash or similar)
          hydrateOptions: undefined,
          dehydrateOptions: {
            shouldDehydrateMutation: (mutation: Mutation) => {
              const isPendingUpload = (mutation.state.context as FileMutationContextType)?.status?.state === "pending";
              return Boolean((mutation.state.context && !isPendingUpload) || mutation.state.isPaused);
            },
          },
        };
        
        await persistQueryClientRestore(persistQueryClientOptions);
        this._unsubscribeQueryClient = persistQueryClientSubscribe(persistQueryClientOptions);
      } catch {
        console.warn(this.weavyId, "Query cache persister not available.");
      }

      if (this.host.isConnected) {
        this._queryClient.mount();
      }

      this._hostIsConnectedObserver = observeConnected(this.host, (isConnected) => {
        if (this.isDestroyed) {
          return;
        }

        if (isConnected) {
          console.info(this.weavyId, "Query client mounted");
          this._queryClient.mount();
        } else {
          console.info(this.weavyId, "Query client unmounted");
          this._queryClient.unmount();
        }
      });

      //console.log(this.weavyId, "Query cache restored from session", this.#queryClient.getMutationCache())
    }

    async disconnectQueryClient() {
      console.info(this.weavyId, "Query client disconnected");
      await this._queryClient.cancelQueries();
      this.queryClient.setQueriesData({}, undefined);
      this.queryClient.resetQueries();
      this._sessionStoragePersister?.removeClient();
      this._unsubscribeQueryClient?.();
      this._queryClient.unmount();
      this._queryClient.clear();
    }

    override destroy() {
      super.destroy();

      this._hostIsConnectedObserver?.disconnect();
      this.disconnectQueryClient();
    }
  };
};
