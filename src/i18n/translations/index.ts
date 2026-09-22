import type { LanguageCode } from "../languages";
import { en, Translations } from "./en";
import { hi } from "./hi";
import { bn } from "./bn";
import { mr } from "./mr";
import { ta } from "./ta";
import { te } from "./te";

export const TRANSLATIONS: Record<LanguageCode, Translations> = { en, hi, bn, mr, ta, te };
