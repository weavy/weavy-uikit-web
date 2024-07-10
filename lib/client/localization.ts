// LOCALIZATION
import { LocaleModule, configureLocalization } from "@lit/localize";
import { WeavyContextBase } from "./weavy";
import { DestroyError } from "../utils/errors";
import { Constructor } from "../types/generic.types";

/**
 * The locale used in the source files.
 */
export const SOURCE_LOCALE = "en";

export interface WeavyLocalizationProps {
  locales: [string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)][];
  localization?: ReturnType<typeof configureLocalization>;
  locale: string;
}


// WeavyLocalization mixin/decorator
export const WeavyLocalizationMixin = <TBase extends Constructor<WeavyContextBase>>(Base: TBase) => {
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

    //#locales = WeavyContext.defaults.locales;

    _locales: Map<string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)> = new Map([
      ["sv-SE", () => import("../../locales/sv-SE")],
    ]);

    get locales() {
      return Array.from(this._locales.entries());
    }

    set locales(locales) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this.localization) {
        throw new Error("Locales may only be configured once");
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
    localization?: ReturnType<typeof configureLocalization>;

    /**
     * Selected locale. The locale must be pre configured in `.locales`.
     */
    get locale() {
      return this._locale;
    }

    set locale(newLocale) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (!this.locale && !newLocale) {
        return;
      }

      newLocale ||=  WeavyLocalization.sourceLocale;

      this._locale = newLocale;
      if (this.localization) {
        this.localization.setLocale(this.locale);
      } else {
        queueMicrotask(() => {
          if (this.localization) {
            this.localization.setLocale(this.locale);
          } else if (this.locale !== WeavyLocalization.sourceLocale) {
            if (this._locales.has(this.locale)) {
              this.configureLocalization();
            }
            if (this.localization) {
              (this.localization as ReturnType<typeof configureLocalization>).setLocale(this.locale);
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
        console.log(
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
          console.log(this.weavyId, "Configuring locales", targetLocales);

          const { getLocale, setLocale } = configureLocalization({
            sourceLocale: WeavyLocalization.sourceLocale,
            targetLocales,
            loadLocale: (newLocale) => this.loadLocale(newLocale),
          });

          this.localization = {
            getLocale,
            setLocale,
          };
        }
      }
    }
  };
};
