import { Platform } from 'react-native';

const nativeBodyFontFamily =
  Platform.select({ android: 'sans-serif', default: 'System', ios: 'System' }) ?? 'System';
const nativeDisplayFontFamily =
  Platform.select({ android: 'sans-serif-medium', default: 'System', ios: 'System' }) ?? 'System';

export const mobileColors = {
  primary: '#ff5e3a',
  secondary: '#ff9500',
  charcoal: '#1a1a1a',
  lightBackground: '#f9f7f4',
  accent: '#ff3333',
  gold: '#ffc83d',
  card: '#ffffff',
  muted: '#8a8580',
  border: '#ece8e2',
  success: '#3fbf38',
  dangerSurface: '#fff0ec',
  successSurface: '#eef9eb',
  warningSurface: '#fff8e8',
} as const;

export const mobileTypography = {
  bodyFontFamily: nativeBodyFontFamily,
  bodyTypeface: 'Inter',
  displayFontFamily: nativeDisplayFontFamily,
  displayTypeface: 'Montserrat',
  bodySize: 15,
  captionSize: 12,
  sectionTitleSize: 18,
  displayTitleSize: 24,
} as const;

export const mobileSpacing = {
  screen: 16,
  section: 18,
  card: 16,
  control: 14,
  compact: 8,
} as const;

export const mobileRadii = {
  chip: 14,
  control: 12,
  card: 18,
  hero: 22,
  pill: 30,
} as const;

export const mobileShadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  fire: {
    shadowColor: mobileColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 4,
  },
} as const;
