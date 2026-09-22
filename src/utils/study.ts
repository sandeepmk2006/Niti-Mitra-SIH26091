import type { TranslateFn } from "../i18n/I18nContext";
import type { TranslationKey } from "../i18n/translations/en";
import { getCategory } from "../services/categories";
import { PreferenceAnswers, parseAnswer } from "../services/preferences";
import type { Study, StudyInput } from "../types/study";

/** Localised business name, e.g. "Dairy" or the user's own description for "Other". */
export function businessLabel(input: StudyInput, t: TranslateFn): string {
  if (input.categoryId === "other") return input.categoryDetail.trim() || t("study.categoryOther");
  return t(getCategory(input.categoryId).label);
}

/** "Dairy · Ormanjhi" */
export function studyTitle(study: Study, t: TranslateFn): string {
  const place = study.input.place.village || study.input.place.district;
  return [businessLabel(study.input, t), place].filter(Boolean).join(" · ");
}

export function placeLabel(input: StudyInput): string {
  const p = input.place;
  return [p.village, p.block, p.district, p.state].filter(Boolean).join(", ");
}

/** Which national corporation channels funds, from the user's saved social category. */
export function agencyKey(preferences: PreferenceAnswers | null | undefined): TranslationKey {
  const { optionId } = parseAnswer(preferences?.category);
  if (optionId === "sc") return "scheme.agencySC";
  if (optionId === "st") return "scheme.agencyST";
  if (optionId === "obc") return "scheme.agencyOBC";
  return "scheme.agencyOther";
}
