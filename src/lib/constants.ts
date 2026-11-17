export const PLATFORM_NAME = 'MANAM.in';
export const PLATFORM_DOMAIN = 'manam.in';
export const SUPER_ADMIN_EMAIL = 'jbackup025@gmail.com';

export const RESERVED_SLUGS = [
  'admin',
  'super',
  'wedding',
  'api',
  'privacy',
  'terms',
] as const;

export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export const MAX_ASSETS_PER_WEDDING = 15;
export const MAX_ADMINS_PER_WEDDING = 3;

export type ThemePresetId =
  | 'classic-gold'
  | 'royal-green'
  | 'rose-blush'
  | 'ivory-minimal'
  | 'midnight';

export type HeadingFontName =
  | 'Cormorant Garamond'
  | 'Playfair Display'
  | 'Fraunces'
  | 'Cinzel';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  headingFont: HeadingFontName;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic-gold',
    name: 'Classic Gold',
    primaryColor: '#7C5821',
    accentColor: '#C59B4F',
    backgroundColor: '#FAF7F2',
    headingFont: 'Cormorant Garamond',
  },
  {
    id: 'royal-green',
    name: 'Royal Green',
    primaryColor: '#1E4D3B',
    accentColor: '#B8934A',
    backgroundColor: '#F6F7F4',
    headingFont: 'Playfair Display',
  },
  {
    id: 'rose-blush',
    name: 'Rose Blush',
    primaryColor: '#863B4C',
    accentColor: '#C78590',
    backgroundColor: '#FDF7F8',
    headingFont: 'Fraunces',
  },
  {
    id: 'ivory-minimal',
    name: 'Ivory Minimal',
    primaryColor: '#2C2723',
    accentColor: '#9E8253',
    backgroundColor: '#FCFBF9',
    headingFont: 'Cormorant Garamond',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    primaryColor: '#D4AF6A',
    accentColor: '#E5CFA0',
    backgroundColor: '#14161A',
    headingFont: 'Cinzel',
  },
];

export const HEADING_FONTS: { label: string; value: HeadingFontName; cssFamily: string }[] = [
  { label: 'Cormorant Garamond', value: 'Cormorant Garamond', cssFamily: "'Cormorant Garamond', Georgia, serif" },
  { label: 'Playfair Display', value: 'Playfair Display', cssFamily: "'Playfair Display', Georgia, serif" },
  { label: 'Fraunces', value: 'Fraunces', cssFamily: "'Fraunces', Georgia, serif" },
  { label: 'Cinzel', value: 'Cinzel', cssFamily: "'Cinzel', Georgia, serif" },
];

export function formatINR(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function paiseToRupeesInput(paise: number): string {
  return (paise / 100).toFixed(paise % 100 === 0 ? 0 : 2);
}

export function isValidSlug(slug: string): boolean {
  return (
    SLUG_REGEX.test(slug) &&
    !(RESERVED_SLUGS as readonly string[]).includes(slug)
  );
}
