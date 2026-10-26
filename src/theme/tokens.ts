/**
 * SWAPD design tokens — same palette and type as the web app (barter/docs/DESIGN.md).
 * coral = primary action · cobalt = "needs your attention" · lilac/violet = discovery · mint = agreed · butter = pending.
 * Coral always takes ink text (white on coral fails contrast).
 */
export const colors = {
  paper: '#FAF8F5',
  surface: '#FFFFFF',
  ink: '#17151E',
  inkSoft: '#2D2A38',
  night: '#100E16',
  coral: '#FF765E',
  coralSoft: '#FFE3DC',
  coralInk: '#B73C26',
  lilac: '#F3E9FF',
  violet: '#CDB8FF',
  lavenderInk: '#5B3A99',
  cobalt: '#5267FF',
  cobaltInk: '#3D4FE8',
  cobaltSoft: '#E7EAFF',
  mint: '#D8F4DF',
  mintInk: '#1D6A3A',
  butter: '#FFF1C9',
  butterInk: '#7A5600',
  muted: '#66627A',
  line: '#E7E3DC',
  danger: '#B42318',
  dangerSoft: '#FDE4E1',
  overlay: 'rgba(23,21,30,0.06)',
} as const;

/** Font family names registered in the root layout (expo-google-fonts). */
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  accent: 'InstrumentSerif_400Regular_Italic',
  body: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export const radius = { card: 24, control: 14, pill: 999 } as const;
export const space = (n: number) => n * 4;

export const shadow = {
  card: { shadowColor: '#17151E', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  pop: { shadowColor: '#17151E', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
} as const;
