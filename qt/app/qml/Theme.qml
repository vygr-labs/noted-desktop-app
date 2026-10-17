pragma Singleton

import QtQuick

// Design tokens (direction 2a: warm neutrals, one red accent, IBM Plex).
// Four palettes; "system" follows the OS between light and dark.
QtObject {
    id: theme

    // light | warm | slate | dark | system
    property string mode: "system"
    readonly property bool dark: mode === "dark" || (mode === "system" && Qt.styleHints.colorScheme === Qt.ColorScheme.Dark)
    readonly property string resolved: dark ? "dark" : (mode === "system" ? "light" : mode)

    // Editor text size — adjustable with Ctrl +/-.
    property real textScale: 1.0

    // Keys:
    //   window/sidebar/list/raised/sunken   surfaces
    //   border, divider                     1px lines
    //   hover, press, navActive             interaction fills
    //   text (UI), body (editor prose), muted, subtle, faint
    //   accent*, cardActive/cardActiveText  selected note card
    //   chip                                filter chips, tags, meta pills
    //   codeBg/codeText, inlineCode/inlineCodeText, checkedText
    readonly property var palettes: ({
        light: {
            window: "#fbfaf8", sidebar: "#f5f3ef", list: "#fbfaf8", raised: "#ffffff", sunken: "#efebe5",
            border: "#e6e1d9", divider: "#ece8e2", hover: "#0f1f1d1a", press: "#1a1f1d1a", navActive: "#eae5dd",
            text: "#1f1d1a", body: "#2e2b27", muted: "#6e6961", subtle: "#a9a399", faint: "#c9c3b9",
            accent: "#c4381f", accentHover: "#b0321b", accentText: "#a5341e", accentSubtle: "#f7eeea", accentSoft: "#f0dfd8",
            accentLine: "#e3b3a6", onAccent: "#ffffff", cardActive: "#f3e9e4", cardActiveText: "#8e2a17",
            chip: "#efebe5", chipText: "#55514b", chipActive: "#1f1d1a", chipActiveText: "#ffffff",
            danger: "#d0443a", dangerText: "#b3261e", success: "#2f8a5b", successText: "#23704a", warning: "#b7791f",
            codeBg: "#1f1d1a", codeText: "#e8e3db", inlineCode: "#f4efe9", inlineCodeText: "#a5341e",
            checkedText: "#a9a399", highlight: "#80ffd96b", selection: "#40c4381f",
            shadow: "#33281e14", scrim: "#59201a14"
        },
        warm: {
            window: "#f7f4ee", sidebar: "#f1ede4", list: "#f7f4ee", raised: "#fffdf9", sunken: "#ece7dc",
            border: "#e2dbcd", divider: "#e7e1d6", hover: "#12302a1a", press: "#1f302a1a", navActive: "#e9e4d8",
            text: "#22211d", body: "#33312b", muted: "#6f695d", subtle: "#9a9486", faint: "#c3bcae",
            accent: "#c4381f", accentHover: "#b0321b", accentText: "#a5341e", accentSubtle: "#f4e9e1", accentSoft: "#eed9cd",
            accentLine: "#e0ae9c", onAccent: "#ffffff", cardActive: "#efe3d8", cardActiveText: "#8e2a17",
            chip: "#ece7dc", chipText: "#55514b", chipActive: "#22211d", chipActiveText: "#ffffff",
            danger: "#d0443a", dangerText: "#b3261e", success: "#2f7a55", successText: "#23704a", warning: "#a8701c",
            codeBg: "#22211d", codeText: "#ece7dc", inlineCode: "#efe8dc", inlineCodeText: "#a5341e",
            checkedText: "#9a9486", highlight: "#80ffd463", selection: "#40c4381f",
            shadow: "#33302a1a", scrim: "#59201a10"
        },
        slate: {
            window: "#f7f8fa", sidebar: "#eff1f4", list: "#f7f8fa", raised: "#ffffff", sunken: "#e7eaef",
            border: "#dfe3e9", divider: "#e5e8ed", hover: "#0f171a21", press: "#1a171a21", navActive: "#e3e7ed",
            text: "#171a21", body: "#2b303b", muted: "#555b6b", subtle: "#8a90a0", faint: "#bcc1cc",
            accent: "#c4381f", accentHover: "#b0321b", accentText: "#a5341e", accentSubtle: "#f6ecea", accentSoft: "#efdcd8",
            accentLine: "#e3b3a6", onAccent: "#ffffff", cardActive: "#f1e6e3", cardActiveText: "#8e2a17",
            chip: "#e7eaef", chipText: "#555b6b", chipActive: "#171a21", chipActiveText: "#ffffff",
            danger: "#d0443a", dangerText: "#b3261e", success: "#2f8a5b", successText: "#23704a", warning: "#b7791f",
            codeBg: "#171a21", codeText: "#e6e8ee", inlineCode: "#eef0f4", inlineCodeText: "#a5341e",
            checkedText: "#8a90a0", highlight: "#80ffd96b", selection: "#40c4381f",
            shadow: "#33141a28", scrim: "#59101420"
        },
        dark: {
            window: "#161513", sidebar: "#1b1a17", list: "#161513", raised: "#23211e", sunken: "#262420",
            border: "#2e2b27", divider: "#2a2825", hover: "#0fede9e3", press: "#1aede9e3", navActive: "#2a2824",
            text: "#ede9e3", body: "#d6d0c3", muted: "#9a948b", subtle: "#77726a", faint: "#4f4b45",
            accent: "#d2472c", accentHover: "#e0573b", accentText: "#e8876f", accentSubtle: "#2a1c17", accentSoft: "#3a2219",
            accentLine: "#6e2c1e", onAccent: "#ffffff", cardActive: "#2c1f1a", cardActiveText: "#f0a48f",
            chip: "#262420", chipText: "#b5afa5", chipActive: "#ede9e3", chipActiveText: "#161513",
            danger: "#e5534b", dangerText: "#ff9a92", success: "#4e9e75", successText: "#6fbf94", warning: "#e0a84a",
            codeBg: "#0f0e0d", codeText: "#e8e3db", inlineCode: "#2a2622", inlineCodeText: "#ec8a72",
            checkedText: "#6b665e", highlight: "#59c9a227", selection: "#55d2472c",
            shadow: "#80000000", scrim: "#a6000000"
        }
    })
    readonly property var c: palettes[resolved]

    // Named colours for lists and tags — muted, so twenty of them in a
    // sidebar still read as one palette.
    readonly property var swatches: ({
        gray: "#a39d92", red: "#c4381f", orange: "#cf6f2e", yellow: "#c48a1f", green: "#2f8a5b",
        blue: "#3e7bc4", indigo: "#5566c4", purple: "#7a5bc4", pink: "#c24f86", teal: "#2a8a84", cyan: "#2d8db0"
    })
    readonly property var swatchNames: ["gray", "red", "orange", "yellow", "green", "blue", "indigo", "purple", "pink", "teal", "cyan"]
    function swatch(name) { return swatches[name] !== undefined ? swatches[name] : swatches.gray }

    // Type
    readonly property string fontFamily: "IBM Plex Sans"
    readonly property string monoFamily: "IBM Plex Mono"
    readonly property int fontXs: 11
    readonly property int fontSm: 12
    readonly property int fontMd: 13
    readonly property int fontLg: 14
    readonly property int fontXl: 16

    // Shape
    readonly property int radiusSm: 4
    readonly property int radius: 6
    readonly property int radiusLg: 8
    readonly property int radiusXl: 12

    // Motion
    readonly property int fast: 120
    readonly property int normal: 200

    // Palette handed to the editor's document styler.
    readonly property var editorPalette: ({
        bodyFamily: fontFamily,
        monoFamily: monoFamily,
        basePx: Math.round(16 * textScale),
        lineHeight: 160,
        text: c.body,
        muted: c.muted,
        subtle: c.subtle,
        accent: c.accent,
        accentText: c.accentText,
        link: c.accent,
        inlineCodeBg: c.inlineCode,
        inlineCodeText: c.inlineCodeText,
        codeBlockBg: c.codeBg,
        codeBlockText: c.codeText,
        highlightBg: c.highlight,
        quoteText: c.muted,
        checkedText: c.checkedText,
        rule: c.border,
        tableBorder: c.border,
        tableHeaderBg: c.sunken,
        checkbox: c.accent
    })
}
