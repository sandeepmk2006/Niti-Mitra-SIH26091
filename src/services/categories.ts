/**
 * Business categories offered in a new study, with the OpenStreetMap tags used to find similar
 * existing businesses nearby (competitor mapping).
 */

import type { Ionicons } from "@expo/vector-icons";

import type { TranslationKey } from "../i18n/translations/en";

export type CategoryId =
  | "dairy"
  | "retail"
  | "textiles"
  | "food"
  | "poultry"
  | "agri"
  | "beauty"
  | "repair"
  | "handicraft"
  | "foodProcessing"
  | "other";

export interface BusinessCategory {
  id: CategoryId;
  label: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  /** English name used in prompts. */
  englishName: string;
  /** Overpass tag filters, e.g. `["shop"="dairy"]`. */
  osmFilters: string[];
}

export const CATEGORIES: BusinessCategory[] = [
  {
    id: "dairy",
    label: "cat.dairy",
    icon: "water-outline",
    englishName: "dairy (milk, curd, paneer, milk collection)",
    osmFilters: ['["shop"="dairy"]', '["amenity"="milk_collection"]', '["shop"="farm"]'],
  },
  {
    id: "retail",
    label: "cat.retail",
    icon: "storefront-outline",
    englishName: "kirana / general retail shop",
    osmFilters: ['["shop"="convenience"]', '["shop"="supermarket"]', '["shop"="general"]', '["shop"="grocery"]'],
  },
  {
    id: "textiles",
    label: "cat.textiles",
    icon: "shirt-outline",
    englishName: "textiles, tailoring and garments",
    osmFilters: ['["shop"="clothes"]', '["shop"="tailor"]', '["craft"="tailor"]', '["shop"="fabric"]'],
  },
  {
    id: "food",
    label: "cat.food",
    icon: "cafe-outline",
    englishName: "tea / food stall or small eatery",
    osmFilters: ['["amenity"="restaurant"]', '["amenity"="fast_food"]', '["amenity"="cafe"]'],
  },
  {
    id: "poultry",
    label: "cat.poultry",
    icon: "egg-outline",
    englishName: "poultry and goat farming",
    osmFilters: ['["shop"="butcher"]', '["landuse"="animal_keeping"]', '["shop"="farm"]'],
  },
  {
    id: "agri",
    label: "cat.agri",
    icon: "leaf-outline",
    englishName: "agri inputs (seeds, fertiliser) and farm services",
    osmFilters: ['["shop"="agrarian"]', '["shop"="garden_centre"]', '["shop"="hardware"]'],
  },
  {
    id: "beauty",
    label: "cat.beauty",
    icon: "cut-outline",
    englishName: "beauty parlour and salon",
    osmFilters: ['["shop"="beauty"]', '["shop"="hairdresser"]'],
  },
  {
    id: "repair",
    label: "cat.repair",
    icon: "phone-portrait-outline",
    englishName: "mobile phone and electronics repair",
    osmFilters: ['["shop"="mobile_phone"]', '["shop"="electronics"]', '["craft"="electronics_repair"]'],
  },
  {
    id: "handicraft",
    label: "cat.handicraft",
    icon: "color-palette-outline",
    englishName: "handicrafts and artisan products",
    osmFilters: ['["shop"="craft"]', '["shop"="gift"]', '["craft"]'],
  },
  {
    id: "foodProcessing",
    label: "cat.foodProcessing",
    icon: "nutrition-outline",
    englishName: "small food processing (pickles, papad, flour milling, spices)",
    osmFilters: ['["craft"="mill"]', '["shop"="bakery"]', '["shop"="spices"]'],
  },
];

export const OTHER_CATEGORY: BusinessCategory = {
  id: "other",
  label: "study.categoryOther",
  icon: "ellipsis-horizontal-circle-outline",
  englishName: "other",
  osmFilters: [],
};

export function getCategory(id: CategoryId): BusinessCategory {
  return CATEGORIES.find((c) => c.id === id) ?? OTHER_CATEGORY;
}
