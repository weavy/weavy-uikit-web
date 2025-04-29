// LOCALIZATION
import { LocaleModule, configureLocalization } from "@lit/localize";
import { WeavyClient } from "./weavy";
import { DestroyError } from "../utils/errors";
import { Constructor } from "../types/generic.types";

/**
 * The locale used in the source files.
 */
export const SOURCE_LOCALE = "en";

export interface WeavyLocalizationProps {
  locales: [string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)][];
  readonly localization?: ReturnType<typeof configureLocalization>;
  locale: string;
}


// WeavyLocalization mixin/decorator
export const WeavyLocalizationMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyLocalization extends Base implements WeavyLocalizationProps {
    /**
     * The locale used in the Weavy source.
     */
    static get sourceLocale() {
      try {
        return SOURCE_LOCALE;
      } catch {
        return "";
      }
    }

    //#locales = WeavyClient.defaults.locales;

    _locales: Map<string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)> = new Map([
      ["sv-SE", () => import("../../locales/sv-SE")],
    ]);

    get locales(): WeavyLocalizationProps["locales"] {
      return Array.from(this._locales.entries());
    }

    set locales(locales: WeavyLocalizationProps["locales"] | null | undefined) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this.localization) {
        throw new Error("Locales may only be configured once");
      }

      if (!locales) {
        return
      }

      if (!Array.isArray(locales)) {
        throw new TypeError("Provided locales have invalid format.");
      }

      locales.forEach((locale) => {
        if (!Array.isArray(locale) || locale.length !== 2 || typeof locale[0] !== "string") {
          throw new TypeError("Invalid locale provided: " + locale[0]);
        }
        this._locales.set(...locale);
      });
      this.configureLocalization();
    }

    _locale = WeavyLocalization.sourceLocale;
    _localization?: ReturnType<typeof configureLocalization>;
    
    get localization() {
      return this._localization
    }

    /**
     * Selected locale. The locale must be pre configured in `.locales`.
     */
    get locale(): string {
      return this._locale;
    }

    set locale(newLocale: string | null | undefined) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (!this._locale && !newLocale) {
        return;
      }

      newLocale ||=  WeavyLocalization.sourceLocale;

      this._locale = newLocale;
      if (this.localization) {
        void this.localization.setLocale(this._locale);
      } else {
        queueMicrotask(() => {
          if (this.localization) {
            void this.localization.setLocale(this._locale);
          } else if (this._locale !== WeavyLocalization.sourceLocale) {
            if (this._locales.has(this._locale)) {
              this.configureLocalization();
            }
            if (this.localization) {
              void (this.localization as ReturnType<typeof configureLocalization>).setLocale(this._locale);
            } else {
              console.error(
                this.weavyId,
                `You need to configure additional languages in config to use '${newLocale}'.`
              );
            }
          }
        });
      }
    }

    async loadLocale(newLocale: string) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this._locales?.has(newLocale)) {
        const localizedTemplate = this._locales.get(newLocale);
        console.info(
          this.weavyId,
          typeof localizedTemplate === "function" ? "loading locale" : "preloaded locale",
          newLocale
        );
        return await ((typeof localizedTemplate === "function"
          ? localizedTemplate()
          : localizedTemplate) as Promise<LocaleModule>);
      } else {
        throw new Error("The requested locale is not configured");
      }
    }

    configureLocalization() {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this._locales?.size) {
        if (!this.localization) {
          const targetLocales = this._locales.keys();
          console.info(this.weavyId, "Configuring locales", targetLocales);

          const { getLocale, setLocale } = configureLocalization({
            sourceLocale: WeavyLocalization.sourceLocale,
            targetLocales,
            loadLocale: (newLocale) => this.loadLocale(newLocale),
          });

          this._localization = {
            getLocale,
            setLocale,
          };
        }
      }
    }
  };
};
