"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Language Configuration
 */
export interface Language {
  code: string;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  flag: string;
}

// Supported languages
export const LANGUAGES: Language[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: "ltr",
    flag: "🇺🇸",
  },
  {
    code: "id",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    direction: "ltr",
    flag: "🇮🇩",
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    direction: "ltr",
    flag: "🇧🇩",
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    direction: "ltr",
    flag: "🇪🇸",
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    direction: "ltr",
    flag: "🇫🇷",
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    direction: "ltr",
    flag: "🇩🇪",
  },
  {
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    direction: "ltr",
    flag: "🇹🇷",
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    direction: "rtl",
    flag: "🇸🇦",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    direction: "ltr",
    flag: "🇮🇳",
  },
  {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    direction: "ltr",
    flag: "🇨🇳",
  },
  {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    direction: "ltr",
    flag: "🇯🇵",
  },
  {
    code: "zu",
    name: "Zulu",
    nativeName: "isiZulu",
    direction: "ltr",
    flag: "🇿🇦",
  },
  {
    code: "xh",
    name: "Xhosa",
    nativeName: "isiXhosa",
    direction: "ltr",
    flag: "🇿🇦",
  },
  {
    code: "af",
    name: "Afrikaans",
    nativeName: "Afrikaans",
    direction: "ltr",
    flag: "🇿🇦",
  },
  {
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
    direction: "ltr",
    flag: "🇰🇪",
  },
  {
    code: "ha",
    name: "Hausa",
    nativeName: "Hausa",
    direction: "ltr",
    flag: "🇳🇬",
  },
  {
    code: "yo",
    name: "Yoruba",
    nativeName: "Yorùbá",
    direction: "ltr",
    flag: "🇳🇬",
  },
  {
    code: "ig",
    name: "Igbo",
    nativeName: "Igbo",
    direction: "ltr",
    flag: "🇳🇬",
  },
];

interface LanguageState {
  language: Language;
  setLanguage: (code: string) => void;
}

/**
 * Language Store with Zustand
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: LANGUAGES[0], // Default English

      setLanguage: (code: string) => {
        const language = LANGUAGES.find((l) => l.code === code);
        if (language) {
          set({ language });
          // Update document direction for RTL languages
          document.documentElement.dir = language.direction;
          document.documentElement.lang = language.code;
        }
      },
    }),
    {
      name: "minimart-language",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Hook to access language functions
 */
export function useLanguage() {
  const { language, setLanguage } = useLanguageStore();

  return {
    language,
    languages: LANGUAGES,
    setLanguage,
    isRTL: language.direction === "rtl",
  };
}

// Simple translation function (can be replaced with next-intl for full i18n)
type TranslationKey = string;
type Translations = Record<string, Record<string, string>>;

const translations: Translations = {
  en: {
    "common.home": "Home",
    "common.products": "Products",
    "common.cart": "Cart",
    "common.login": "Login",
    "common.register": "Register",
    "common.logout": "Logout",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.success": "Success",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.confirm": "Confirm",
    "common.yes": "Yes",
    "common.no": "No",
  },
  id: {
    "common.home": "Beranda",
    "common.products": "Produk",
    "common.cart": "Keranjang",
    "common.login": "Masuk",
    "common.register": "Daftar",
    "common.logout": "Keluar",
    "common.search": "Cari",
    "common.loading": "Memuat...",
    "common.error": "Terjadi kesalahan",
    "common.success": "Berhasil",
    "common.save": "Simpan",
    "common.cancel": "Batal",
    "common.delete": "Hapus",
    "common.edit": "Ubah",
    "common.confirm": "Konfirmasi",
    "common.yes": "Ya",
    "common.no": "Tidak",
  },
  bn: {
    "common.home": "হোম",
    "common.products": "পণ্য",
    "common.cart": "কার্ট",
    "common.login": "লগইন",
    "common.register": "নিবন্ধন",
    "common.logout": "লগআউট",
    "common.search": "অনুসন্ধান",
    "common.loading": "লোড হচ্ছে...",
    "common.error": "একটি ত্রুটি ঘটেছে",
    "common.success": "সফল",
    "common.save": "সংরক্ষণ",
    "common.cancel": "বাতিল",
    "common.delete": "মুছুন",
    "common.edit": "সম্পাদনা",
    "common.confirm": "নিশ্চিত করুন",
    "common.yes": "হ্যাঁ",
    "common.no": "না",
  },
  tr: {
    "common.home": "Ana Sayfa",
    "common.products": "Ürünler",
    "common.cart": "Sepet",
    "common.login": "Giriş Yap",
    "common.register": "Kayıt Ol",
    "common.logout": "Çıkış Yap",
    "common.search": "Ara",
    "common.loading": "Yükleniyor...",
    "common.error": "Bir hata oluştu",
    "common.success": "Başarılı",
    "common.save": "Kaydet",
    "common.cancel": "İptal",
    "common.delete": "Sil",
    "common.edit": "Düzenle",
    "common.confirm": "Onayla",
    "common.yes": "Evet",
    "common.no": "Hayır",
  },
  zu: {
    "common.home": "Ikhayoni",
    "common.products": "Amaphroducts",
    "common.cart": "Indwangu",
    "common.login": "Ngena ngemvume",
    "common.register": "Bhalisa",
    "common.logout": "Phuma",
    "common.search": "Sesha",
    "common.loading": "Iyalayisha...",
    "common.error": "Kumenye iphutha",
    "common.success": "Impumelelo",
    "common.save": "Landa",
    "common.cancel": "Khansela",
    "common.delete": "Susa",
    "common.edit": "Lungisa",
    "common.confirm": "Qinisekisa",
    "common.yes": "Yebo",
    "common.no": "Cha",
  },
  xh: {
    "common.home": "Ikhaya",
    "common.products": "Iimveliso",
    "common.cart": "Indwangu",
    "common.login": "Ngena ngemvume",
    "common.register": "Bhalisa",
    "common.logout": "Phuma",
    "common.search": "Sesha",
    "common.loading": "Iyalayisha...",
    "common.error": "Kumenye iphutha",
    "common.success": "Impumelelo",
    "common.save": "Landa",
    "common.cancel": "Khansela",
    "common.delete": "Susa",
    "common.edit": "Lungisa",
    "common.confirm": "Qinisekisa",
    "common.yes": "Ewe",
    "common.no": "Hayi",
  },
  af: {
    "common.home": "Tuis",
    "common.products": "Produkte",
    "common.cart": "Mandjie",
    "common.login": "Teken in",
    "common.register": "Registreer",
    "common.logout": "Teken uit",
    "common.search": "Soek",
    "common.loading": "Laai tans...",
    "common.error": "Daar het 'n fout opgeduik",
    "common.success": "Sukses",
    "common.save": "Stoor",
    "common.cancel": "Kanselleer",
    "common.delete": "Skrap",
    "common.edit": "Wysig",
    "common.confirm": "Bevestig",
    "common.yes": "Ja",
    "common.no": "Nee",
  },
  sw: {
    "common.home": "Nyumbani",
    "common.products": "Bidhaa",
    "common.cart": "Cart",
    "common.login": "Ingia",
    "common.register": "Sajili",
    "common.logout": "Toka",
    "common.search": "Tafuta",
    "common.loading": "Inapakia...",
    "common.error": "Hitilafu imetokea",
    "common.success": "Mafanikio",
    "common.save": "Hifadhi",
    "common.cancel": "Ghairi",
    "common.delete": "Futa",
    "common.edit": "Hariri",
    "common.confirm": "Thibitisha",
    "common.yes": "Ndiyo",
    "common.no": "Hapana",
  },
  ha: {
    "common.home": "Gida",
    "common.products": "Kayayyaki",
    "common.cart": "Cart",
    "common.login": "Shiga",
    "common.register": "Yi rijista",
    "common.logout": "Fita",
    "common.search": "Bincika",
    "common.loading": "Ana lodawa...",
    "common.error": "An samu kuskure",
    "common.success": "Nasara",
    "common.save": "Ajiye",
    "common.cancel": "Soke",
    "common.delete": "Goge",
    "common.edit": "Shirya",
    "common.confirm": "Tabbatar da",
    "common.yes": "Ii",
    "common.no": "A'a",
  },
  yo: {
    "common.home": "Ile",
    "common.products": "Awọn oja",
    "common.cart": "Keketi",
    "common.login": "Wọle",
    "common.register": "Forukọsilẹ",
    "common.logout": "Jade",
    "common.search": "Ṣayẹwo",
    "common.loading": "N ṣe wiwa...",
    "common.error": "A ti ṣe aṣiṣe kan",
    "common.success": "Aṣeyọri",
    "common.save": "Fipamọ",
    "common.cancel": "Fagilee",
    "common.delete": "Paarẹ",
    "common.edit": "Ṣatunṣe",
    "common.confirm": "Ṣe idempidi",
    "common.yes": "Bẹẹni",
    "common.no": "Rii",
  },
  ig: {
    "common.home": "Ụlọ",
    "common.products": "Ngwaahịa",
    "common.cart": "Keketi",
    "common.login": "Banye",
    "common.register": "Dee akaụntụ",
    "common.logout": "Meezi",
    "common.search": "Chọọ",
    "common.loading": "Na-ebu ụzọ...",
    "common.error": "Mmegharịrị ahụrụ",
    "common.success": "Success",
    "common.save": "Chekwa",
    "common.cancel": "Kagbuo",
    "common.delete": "Hichapụ",
    "common.edit": "Mepụta",
    "common.confirm": "Nyochaa",
    "common.yes": "Maa",
    "common.no": "Mba",
  },
};

/**
 * Translation hook
 */
export function useTranslation() {
  const { language } = useLanguageStore();

  const t = (key: TranslationKey, fallback?: string): string => {
    const langTranslations = translations[language.code] || translations.en;
    return langTranslations[key] || translations.en[key] || fallback || key;
  };

  return { t, language };
}
