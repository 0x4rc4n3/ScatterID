// packages/design-tokens/tokens.ts
// THE ONLY FILE ALLOWED TO CONTAIN RAW HEX/RGB VALUES. Everything else imports from here.
export const tokens = {
  color: {
    brand50:  '#ecfdf9',
    brand300: '#2dd4bf',
    brand500: '#10b981',   // primary brand teal
    brand700: '#065f46',

    bgBase:    '#f4faf9',  // light mode canvas (matches client portal)
    bgSurface: '#ffffff',  // light mode white paper
    bgCard:    '#ffffff',  // light mode white card
    bgCardHover: '#f8fafc',
    bgInput:   '#ffffff',
    bgLight:   '#f4faf9',  // light mode, portal daytime counter use
    bgLightSurface: '#ffffff',
    bgLightCard: '#f0fdf4',

    borderSubtle: '#e2e8f0',
    borderMedium: '#cbd5e1',
    borderFocus:  '#10b981',
    borderLight:  '#e2e8f0',

    textMain:    '#1e293b',
    textDim:     '#64748b',
    textMuted:   '#94a3b8',
    textOnLight: '#3f3f46',
    textLightMuted: '#71717a',

    approve: '#0F6E56',
    reject:  '#A32D2D',
    flag:    '#B45309',    // never reuse approve/reject colors for flag
    rootTier:'#534AB7',    // Root-exclusive surfaces only

    // Semantic accents and status
    cyanBright:    '#0284c7',
    cyanMid:       '#0284c7',
    amberBright:   '#f59e0b',
    amberDark:     '#78350f',
    roseBright:    '#f43f5e',
    roseDark:      '#881337',
    purpleBright:  '#a855f7',
    purpleLight:   '#f3e8ff',
    emeraldBright: '#10b981',
    emeraldDark:   '#065f46',
    slate800:      '#1e293b',
    slate700:      '#334155',
    slate500:      '#64748b',
    slate200:      '#e2e8f0',
    slate100:      '#f1f5f9',
    slate50:       '#f8fafc',
    white:         '#ffffff',
    black:         '#000000',
  },
  radius: { sm: '6px', md: '10px', lg: '14px' },
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
  },
} as const;

export type DesignTokens = typeof tokens;
export default tokens;
