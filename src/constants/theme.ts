/**
 * Design system constants for Niti Mitra.
 * White surfaces with one brand accent — the orange from the logo (#F8921F). Flat fills only: no
 * gradients or coloured glows, and screens avoid decorative motion.
 */

export const Colors = {
  // ── Background layers ──
  background: "#FFFFFF",
  backgroundSubtle: "#FAF8F5",
  surfacePrimary: "#FFFFFF",
  surfaceSecondary: "#F5F3F0",
  surfaceElevated: "#FFFFFF",

  // ── Brand (logo orange) ──
  // `primary` is for fills, icons and borders. Orange text on white is too faint at the brand
  // shade, so text in the accent colour uses `primaryText` instead.
  primary: "#F8921F",
  primaryStrong: "#E07A0B",
  primaryText: "#B45309",
  primarySoft: "#FFF4E6",
  primaryBorder: "#FCD9AE",

  // ── Semantic ──
  success: "#047857",
  successMuted: "#ECFDF5",
  warning: "#B45309",
  warningMuted: "#FFFBEB",
  danger: "#DC2626",
  dangerMuted: "#FEF2F2",
  info: "#1D4ED8",
  infoMuted: "#EFF6FF",

  // ── Text ──
  // textMuted stays at 4.8:1 on white — this app is used outdoors on cheap
  // screens, so the usual #9CA3AF placeholder grey is too faint.
  textPrimary: "#1C1917",
  textSecondary: "#57534E",
  textMuted: "#6B6560",
  textInverse: "#FFFFFF",

  // ── Borders ──
  border: "#ECE8E3",
  borderStrong: "#D6D0C8",
  borderFocused: "#F8921F",

  // ── Tab bar ──
  tabBarBackground: "#FFFFFF",
  tabBarActive: "#B45309",
  tabBarInactive: "#6B6560",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 40,
};

export const Shadows = {
  card: {
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
};
