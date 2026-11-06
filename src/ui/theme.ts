/**
 * Tema "Cuidar". Paleta derivada da recomendação da skill UI UX Pro Max
 * (ciano calmo + verde saúde), escurecida para que todo texto tenha contraste
 * ≥ 4,5:1 (WCAG AA). Status nunca é comunicado só por cor: sempre há texto e ícone.
 */
export const colors = {
  background: '#F4FAFB',
  card: '#FFFFFF',
  foreground: '#0F3B4C', // 11,4:1 sobre o fundo
  muted: '#4B5E6B', // 6,4:1
  border: '#6B7C88', // bordas de campos ≥ 3:1
  divider: '#D5E2E7',
  primary: '#0E7490', // 5,4:1 com texto branco
  primarySoft: '#E3F4F7',
  accent: '#047857', // "Tomei" — 5,5:1 com branco
  danger: '#B91C1C',
  onSolid: '#FFFFFF',
  focus: '#0B5566',

  status: {
    taken: { bg: '#E3F5EE', fg: '#065F46' },
    skipped: { bg: '#FDECEC', fg: '#991B1B' },
    unconfirmed: { bg: '#FFF4E0', fg: '#8A4B00' },
    snoozed: { bg: '#E3F4F7', fg: '#0B5566' },
    due: { bg: '#E3F4F7', fg: '#0B5566' },
    pending: { bg: '#EEF2F5', fg: '#3D4F5C' },
    conflict: { bg: '#FFF4E0', fg: '#8A4B00' },
  },
} as const;

export const fonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
} as const;

/** Escala tipográfica: corpo 18, nunca abaixo de 16. */
export const type = {
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 },
  small: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  button: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { md: 12, lg: 16, pill: 999 } as const;
/** Alvos de toque generosos (acima de 44pt/48dp). */
export const TOUCH = 56;
