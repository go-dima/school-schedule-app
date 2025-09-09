/**
 * i18n configuration
 * Provides internationalization setup for Hebrew and English
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import heTranslations from "../locales/he.json";

const resources = {
  he: {
    translation: heTranslations,
  },
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: "he", // default language (Hebrew for RTL)
    fallbackLng: "he",

    interpolation: {
      escapeValue: false, // React already does escaping
      // Remove the custom format function as it might be interfering
    },

    // Enable debug mode in development
    debug: import.meta.env.MODE === "development",

    // Add cache settings to ensure fresh load
    cache: {
      enabled: false,
    },
  });

export default i18n;
