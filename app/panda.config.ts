import { green } from "~/theme/colors/green";
import { red } from "~/theme/colors/red";
import { slate } from "~/theme/colors/slate";
import { indigo } from "~/theme/colors/indigo";
import { animationStyles } from "~/theme/animation-styles";
import { zIndex } from "~/theme/tokens/z-index";
import { shadows } from "~/theme/tokens/shadows";
import { durations } from "~/theme/tokens/durations";
import { colors } from "~/theme/tokens/colors";
import { textStyles } from "~/theme/text-styles";
import { layerStyles } from "~/theme/layer-styles";
import { keyframes } from "~/theme/keyframes";
import { globalCss } from "~/theme/global-css";
import { conditions } from "~/theme/conditions";
import { slotRecipes, recipes } from "~/theme/recipes";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx,astro}"],
  exclude: ["./src/backend"],

  theme: {
    extend: {
      animationStyles: animationStyles,
      recipes: recipes,
      slotRecipes: slotRecipes,
      keyframes: keyframes,
      layerStyles: layerStyles,
      textStyles: textStyles,

      tokens: {
        colors: colors,
        durations: durations,
        zIndex: zIndex,
        fonts: {
          body: { value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
          heading: { value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
          mono: { value: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" },
        },
      },

      semanticTokens: {
        colors: {
          fg: {
            default: {
              value: {
                _light: "{colors.gray.12}",
                _dark: "{colors.gray.12}"
              }
            },

            muted: {
              value: {
                _light: "{colors.gray.11}",
                _dark: "{colors.gray.11}"
              }
            },

            subtle: {
              value: {
                _light: "{colors.gray.10}",
                _dark: "{colors.gray.10}"
              }
            }
          },

          border: {
            value: {
              _light: "{colors.gray.4}",
              _dark: "{colors.gray.4}"
            }
          },

          error: {
            value: {
              _light: "{colors.red.9}",
              _dark: "{colors.red.9}"
            }
          },

          accent: {
            value: {
              _light: "{colors.indigo.9}",
              _dark: "{colors.indigo.9}"
            }
          },

          'accent.subtle': {
            value: {
              _light: "{colors.indigo.a3}",
              _dark: "{colors.indigo.a3}"
            }
          },

          'accent.text': {
            value: {
              _light: "{colors.indigo.11}",
              _dark: "{colors.indigo.11}"
            }
          },

          indigo: indigo,
          gray: slate,
          red: red,
          green: green
        },

        shadows: shadows,

        radii: {
          l1: {
            value: "{radii.xs}"
          },

          l2: {
            value: "{radii.sm}"
          },

          l3: {
            value: "{radii.md}"
          }
        }
      }
    },
  },

  jsxFramework: "solid",
  outdir: "styled-system",
  globalCss: globalCss,
  conditions: conditions
});
