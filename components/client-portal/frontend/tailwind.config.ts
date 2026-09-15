import type { Config } from 'tailwindcss';
import { tokens } from '../../../packages/design-tokens/tokens';
import flowbitePlugin from 'flowbite/plugin';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    'node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand50: tokens.color.brand50,
        brand300: tokens.color.brand300,
        brand500: tokens.color.brand500,
        brand700: tokens.color.brand700,

        bgBase: tokens.color.bgBase,
        bgSurface: tokens.color.bgSurface,
        bgCard: tokens.color.bgCard,
        bgCardHover: tokens.color.bgCardHover,
        bgInput: tokens.color.bgInput,
        bgLight: tokens.color.bgLight,
        bgLightSurface: tokens.color.bgLightSurface,
        bgLightCard: tokens.color.bgLightCard,

        borderSubtle: tokens.color.borderSubtle,
        borderMedium: tokens.color.borderMedium,
        borderFocus: tokens.color.borderFocus,
        borderLight: tokens.color.borderLight,

        textMain: tokens.color.textMain,
        textDim: tokens.color.textDim,
        textMuted: tokens.color.textMuted,
        textOnLight: tokens.color.textOnLight,
        textLightMuted: tokens.color.textLightMuted,

        approve: tokens.color.approve,
        reject: tokens.color.reject,
        flag: tokens.color.flag,
        rootTier: tokens.color.rootTier,

        cyanBright: tokens.color.cyanBright,
        cyanMid: tokens.color.cyanMid,
        amberBright: tokens.color.amberBright,
        amberDark: tokens.color.amberDark,
        roseBright: tokens.color.roseBright,
        roseDark: tokens.color.roseDark,
        purpleBright: tokens.color.purpleBright,
        emeraldBright: tokens.color.emeraldBright,
        emeraldDark: tokens.color.emeraldDark,
        slate800: tokens.color.slate800,
        slate700: tokens.color.slate700,
        slate100: tokens.color.slate100,
        white: tokens.color.white,
        black: tokens.color.black,
      },
      borderRadius: {
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
      },
      fontFamily: {
        sans: [tokens.font.sans],
        mono: [tokens.font.mono],
      },
    },
  },
  plugins: [flowbitePlugin],
};

export default config;
