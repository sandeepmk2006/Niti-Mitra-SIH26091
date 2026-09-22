/**
 * Module 1 output: market reach, opportunities, SWOT, threats, competitor mapping, pricing.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Pill } from "./badges";
import { Bullets, Note, Section, Tile, TileRow } from "./sections";
import { useI18n } from "../i18n/I18nContext";
import type { TranslationKey } from "../i18n/translations/en";
import type { Severity, Study } from "../types/study";
import { formatINR, formatNumber } from "../utils/format";
import { BorderRadius, Colors, FontSize } from "../constants/theme";

const SEVERITY: Record<Severity, { color: string; tint: string }> = {
  high: { color: Colors.danger, tint: Colors.dangerMuted },
  medium: { color: Colors.warning, tint: Colors.warningMuted },
  low: { color: Colors.success, tint: Colors.successMuted },
};

const SATURATION: Record<string, { key: TranslationKey; color: string; tint: string }> = {
  low: { key: "report.satLow", color: Colors.success, tint: Colors.successMuted },
  medium: { key: "report.satMedium", color: Colors.warning, tint: Colors.warningMuted },
  high: { key: "report.satHigh", color: Colors.danger, tint: Colors.dangerMuted },
};

export function MarketReportView({ study }: { study: Study }) {
  const { t } = useI18n();
  const { report, local } = study;
  const reach = report.marketReach;
  const sat = SATURATION[report.competition.saturation] ?? SATURATION.medium;
  const estimateBadge = <Pill label={t("report.estimate")} color={Colors.info} tint={Colors.infoMuted} icon="sparkles-outline" />;

  return (
    <View style={{ gap: 12 }}>
      {/* 1. Market reach */}
      <Section title={t("report.marketReach")} icon="people-outline" badge={estimateBadge}>
        <TileRow>
          <Tile label={t("report.pop5")} value={formatNumber(reach.population5km)} />
          <Tile label={t("report.pop10")} value={formatNumber(reach.population10km)} />
          <Tile label={t("report.households")} value={formatNumber(reach.households5km)} />
          <Tile label={t("report.dailyCustomers")} value={formatNumber(reach.dailyCustomers)} emphasis />
        </TileRow>
        {local ? (
          <Note
            icon="map-outline"
            text={t("report.villagesNearby", { count5: local.settlementCount5km, count10: local.settlementCount10km })}
          />
        ) : null}
        {local && local.settlements.length > 0 ? (
          <View style={styles.chips}>
            {local.settlements.slice(0, 10).map((s) => (
              <View key={`${s.name}-${s.distanceKm}`} style={styles.chip}>
                <Text style={styles.chipText}>
                  {s.name} · {s.distanceKm} km
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {reach.targetCustomers ? (
          <View style={{ gap: 4 }}>
            <Text style={styles.subhead}>{t("report.targetCustomers")}</Text>
            <Text style={styles.body}>{reach.targetCustomers}</Text>
          </View>
        ) : null}
        {reach.channels.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.subhead}>{t("report.channels")}</Text>
            {reach.channels.map((c, i) => (
              <View key={i} style={styles.item}>
                <Ionicons name="navigate-circle-outline" size={18} color={Colors.primaryText} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{c.name}</Text>
                  {c.detail ? <Text style={styles.itemBody}>{c.detail}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </Section>

      {/* 2. Opportunities */}
      {report.opportunities.length > 0 ? (
        <Section title={t("report.opportunities")} icon="bulb-outline">
          {report.opportunities.map((o, i) => (
            <View key={i} style={styles.item}>
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{o.title}</Text>
                {o.detail ? <Text style={styles.itemBody}>{o.detail}</Text> : null}
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {/* 3. SWOT */}
      <Section title={t("report.swot")} icon="grid-outline">
        <View style={styles.swot}>
          <SwotBox title={t("report.strengths")} items={report.swot.strengths} color={Colors.success} tint={Colors.successMuted} />
          <SwotBox title={t("report.weaknesses")} items={report.swot.weaknesses} color={Colors.warning} tint={Colors.warningMuted} />
          <SwotBox title={t("report.swotOpportunities")} items={report.swot.opportunities} color={Colors.info} tint={Colors.infoMuted} />
          <SwotBox title={t("report.swotThreats")} items={report.swot.threats} color={Colors.danger} tint={Colors.dangerMuted} />
        </View>
      </Section>

      {/* 4. Threats */}
      {report.threats.length > 0 ? (
        <Section title={t("report.threats")} icon="warning-outline">
          {report.threats.map((th, i) => {
            const sev = SEVERITY[th.severity] ?? SEVERITY.medium;
            return (
              <View key={i} style={[styles.threat, { borderLeftColor: sev.color }]}>
                <View style={styles.threatHead}>
                  <Pill label={t(`report.threat.${th.type}` as TranslationKey)} color={Colors.textSecondary} tint={Colors.surfaceSecondary} />
                  <Pill label={t(`report.severity.${th.severity}` as TranslationKey)} color={sev.color} tint={sev.tint} />
                </View>
                <Text style={styles.itemTitle}>{th.title}</Text>
                {th.detail ? <Text style={styles.itemBody}>{th.detail}</Text> : null}
                {th.mitigation ? (
                  <View style={styles.mitigation}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.mitigationText}>
                      <Text style={{ fontWeight: "700" }}>{t("report.whatToDo")}: </Text>
                      {th.mitigation}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Section>
      ) : null}

      {/* 5. Competitor mapping */}
      <Section title={t("report.competition")} icon="storefront-outline">
        <View style={[styles.saturation, { backgroundColor: sat.tint }]}>
          <Text style={[styles.subhead, { color: sat.color }]}>{t("report.saturation")}</Text>
          <Text style={[styles.saturationText, { color: sat.color }]}>{t(sat.key)}</Text>
        </View>
        <TileRow>
          <Tile label={t("report.estimatedCompetitors")} value={formatNumber(report.competition.estimatedCount5km)} />
          {local ? (
            <Tile
              label={t("report.mappedCompetitors")}
              value={formatNumber(local.competitorCount5km)}
              caption={local.nearestCompetitorKm !== null ? t("report.nearest", { distance: local.nearestCompetitorKm }) : undefined}
            />
          ) : null}
        </TileRow>
        {report.competition.competitorTypes.length > 0 ? (
          <View style={styles.chips}>
            {report.competition.competitorTypes.map((c, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {local && local.competitorNames.length > 0 ? (
          <Text style={styles.itemBody}>{local.competitorNames.join(" · ")}</Text>
        ) : null}
        {report.competition.note ? <Text style={styles.body}>{report.competition.note}</Text> : null}
      </Section>

      {/* 6. Pricing */}
      <Section title={t("report.pricing")} icon="pricetags-outline">
        {report.pricing.products.length > 0 ? (
          <View style={styles.table}>
            <View style={[styles.tr, styles.th]}>
              <Text style={[styles.tdName, styles.thText]}>{t("report.product")}</Text>
              <Text style={[styles.td, styles.thText]}>{t("report.localPrice")}</Text>
              <Text style={[styles.td, styles.thText]}>{t("report.suggested")}</Text>
            </View>
            {report.pricing.products.map((p, i) => (
              <View key={i} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                <View style={styles.tdName}>
                  <Text style={styles.itemTitle}>{p.name}</Text>
                  {p.unit ? <Text style={styles.unit}>/ {p.unit}</Text> : null}
                </View>
                <Text style={styles.td}>
                  {formatINR(p.minPrice)}–{formatINR(p.maxPrice)}
                </Text>
                <Text style={[styles.td, styles.tdStrong]}>{formatINR(p.suggestedPrice)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {report.pricing.strategy ? <Text style={styles.body}>{report.pricing.strategy}</Text> : null}
        {report.pricing.purchasingPower ? (
          <Note icon="wallet-outline" text={`${t("report.purchasingPower")}: ${report.pricing.purchasingPower}`} />
        ) : null}
      </Section>

      {report.nextSteps.length > 0 ? (
        <Section title={t("report.nextSteps")} icon="footsteps-outline">
          <Bullets numbered items={report.nextSteps} />
        </Section>
      ) : null}

      <Text style={styles.source}>{local ? t("report.dataSource") : t("report.noMapData")}</Text>
    </View>
  );
}

function SwotBox({ title, items, color, tint }: { title: string; items: string[]; color: string; tint: string }) {
  return (
    <View style={[styles.swotBox, { backgroundColor: tint }]}>
      <Text style={[styles.swotTitle, { color }]}>{title}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.swotItem}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  subhead: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  body: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  itemTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, lineHeight: 20 },
  itemBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  swot: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swotBox: { flexGrow: 1, flexBasis: "46%", borderRadius: BorderRadius.md, padding: 10, gap: 4 },
  swotTitle: { fontSize: FontSize.sm, fontWeight: "800", marginBottom: 2 },
  swotItem: { fontSize: FontSize.xs, color: Colors.textPrimary, lineHeight: 17 },

  threat: {
    borderLeftWidth: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.backgroundSubtle,
    padding: 10,
    gap: 6,
  },
  threatHead: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  mitigation: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  mitigationText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 19 },

  saturation: { borderRadius: BorderRadius.md, padding: 12, gap: 2 },
  saturationText: { fontSize: FontSize.md, fontWeight: "800" },

  table: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, gap: 6 },
  trAlt: { backgroundColor: Colors.backgroundSubtle },
  th: { backgroundColor: Colors.surfaceSecondary },
  thText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary },
  tdName: { flex: 1.4 },
  td: { flex: 1, fontSize: FontSize.xs, color: Colors.textPrimary, textAlign: "right" },
  tdStrong: { fontWeight: "800", color: Colors.primaryText, fontSize: FontSize.sm },
  unit: { fontSize: 10, color: Colors.textMuted },
  source: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", lineHeight: 17, paddingHorizontal: 12 },
});
