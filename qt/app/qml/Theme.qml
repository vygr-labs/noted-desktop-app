pragma Singleton

import QtQuick

// Design tokens. The names match the prototype and qt/DESIGN.md, with the
// kebab-case names written in camelCase (ink-2 → ink2, line-strong →
// lineStrong), so the two stay greppable against each other.
QtObject {
    id: theme

    // light | dark | system ("Match Windows")
    property string mode: "system"
    readonly property bool dark: mode === "dark" || (mode === "system" && Qt.styleHints.colorScheme === Qt.ColorScheme.Dark)
    readonly property string resolved: dark ? "dark" : "light"

    // Body text size in notes (Settings → Text size, Ctrl +/-).
    property real textScale: 1.0

    readonly property var light: ({
        bg: "#FFFFFF", sidebar: "#F5F4F1", selected: "#E8E6E0", pressed: "#ECEAE5",
        raised: "#FFFFFF", card: "#FFFFFF", field: "#FFFFFF", folder: "#FAFAF8",
        codeBg: "#F7F6F3", inlineCode: "#F1EFEA", hl: "#FBEFB8",
        ink: "#1B1B1A", ink2: "#22221F", text: "#2A2926", text2: "#3A3936", secondary: "#4A4945",
        tertiary: "#5F5E59", muted: "#6E6D68", placeholder: "#767570", faint: "#8F8D87", faintest: "#B9B7B0",
        underline: "#C9C6BF", linkLine: "#A9A7A0", quote: "#D6D3CC",
        line: "#E7E5E0", lineStrong: "#E2E0DA", lineSoft: "#ECEAE5", lineFaint: "#F0EEE9",
        cardLine: "#E5E3DE", menuLine: "#EDEBE6",
        red: "#B4432F", scrim: "#291B1B1A",
        segTrack: "#EFEDE8", segOn: "#FFFFFF", switchOff: "#D6D3CC", knob: "#FFFFFF"
    })
    // Warm near-black. The sidebar sits darker than the page, menus lift
    // lighter, and depth comes from a faint light ring instead of shadow.
    readonly property var darkTokens: ({
        bg: "#1C1C1B", sidebar: "#161615", selected: "#2B2B29", pressed: "#2E2E2B",
        raised: "#262624", card: "#222221", field: "#222221", folder: "#212120",
        codeBg: "#252523", inlineCode: "#2D2D2A", hl: "#4D4220",
        ink: "#EDECE9", ink2: "#E4E3DF", text: "#D9D8D3", text2: "#CAC9C3", secondary: "#B5B4AE",
        tertiary: "#9E9D97", muted: "#8F8E88", placeholder: "#86857F", faint: "#6F6E69", faintest: "#55544F",
        underline: "#55544F", linkLine: "#77766F", quote: "#46453F",
        line: "#2B2B29", lineStrong: "#353532", lineSoft: "#2A2A28", lineFaint: "#262625",
        cardLine: "#2F2F2D", menuLine: "#363633",
        red: "#E2765F", scrim: "#80000000",
        segTrack: "#2A2A28", segOn: "#3B3B38", switchOff: "#46453F", knob: "#F2F1EE"
    })

    // ── shadows (see Shadow.qml) ─────────────────────────────────────
    readonly property var shadowPop: dark ? { y: 10, blur: 28, color: "#73000000", ring: "#12FFFFFF" }
                                          : { y: 8, blur: 24, color: "#1F000000", ring: "#14000000" }
    readonly property var shadowModal: dark ? { y: 24, blur: 60, color: "#8C000000", ring: "#14FFFFFF" }
                                            : { y: 24, blur: 60, color: "#29000000", ring: "#12000000" }

    // ── accent ───────────────────────────────────────────────────────
    // One user setting (qt.accent). In the dark it's lifted 22% towards
    // white so it holds on the darker ground; Ink turns to paper.
    readonly property var accents: [
        { name: "Blue", hex: "#2F5AC8" }, { name: "Green", hex: "#1F7A5C" },
        { name: "Rust", hex: "#9A4A1F" }, { name: "Ink", hex: "#1B1B1A" }
    ]
    property string accentChoice: "#2F5AC8"
    readonly property bool inkAccent: accentChoice.toUpperCase() === "#1B1B1A"
    readonly property color accent: !dark ? accentChoice : (inkAccent ? darkTokens.ink : mix(accentChoice, "#FFFFFF", 0.22))
    readonly property color accentInk: dark && inkAccent ? darkTokens.bg : "#FFFFFF"
    readonly property color selection: Qt.alpha(accent, dark ? 0.34 : 0.2)

    function mix(a, b, t) {
        const x = Qt.color(a), y = Qt.color(b)
        return Qt.rgba(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t, 1)
    }

    // ── list colours ─────────────────────────────────────────────────
    // The database stores names; these are their tones. The colour picker
    // offers the first seven, the rest still render for older lists.
    readonly property var swatches: ({
        blue: "#4A6FA5", teal: "#3E8A8A", green: "#5E8C61", yellow: "#B07D2B", orange: "#B4543A",
        purple: "#8A5A83", gray: "#6E6D68", red: "#A8483B", indigo: "#5B62A8", pink: "#A85A78", cyan: "#3D7F9E"
    })
    readonly property var swatchNames: ["blue", "teal", "green", "yellow", "orange", "purple", "gray", "red", "indigo", "pink", "cyan"]
    readonly property var pickerSwatches: [
        { name: "blue", label: "Blue" }, { name: "teal", label: "Teal" }, { name: "green", label: "Green" },
        { name: "yellow", label: "Ochre" }, { name: "orange", label: "Rust" }, { name: "purple", label: "Plum" },
        { name: "gray", label: "Grey" }
    ]
    function swatch(name) {
        const base = swatches[name] !== undefined ? swatches[name] : swatches.gray
        return dark ? mix(base, "#FFFFFF", 0.2) : Qt.color(base)
    }

    // ── colours in use ───────────────────────────────────────────────
    readonly property var c: {
        const t = Object.assign({}, dark ? darkTokens : light)
        t.accent = accent
        t.onAccent = accentInk
        t.selection = selection
        // Legacy names, for the screens not rebuilt on the new tokens yet.
        // Remove each one when nothing reads it any more.
        Object.assign(t, {
            window: t.bg, list: t.bg, sunken: t.codeBg, border: t.lineStrong, divider: t.line,
            hover: Qt.alpha(t.pressed, 0.6), press: t.pressed, navActive: t.selected,
            body: t.text, subtle: t.faint,
            accentHover: Qt.darker(accent, 1.08), accentText: accent, accentSubtle: Qt.alpha(accent, 0.08),
            accentSoft: Qt.alpha(accent, 0.14), accentLine: Qt.alpha(accent, 0.5),
            cardActive: t.selected, cardActiveText: t.ink,
            chip: t.codeBg, chipText: t.secondary, chipActive: t.ink, chipActiveText: t.bg,
            danger: t.red, dangerText: t.red, success: accent, successText: accent, warning: swatch("yellow"),
            codeText: t.text, inlineCodeText: t.ink, checkedText: t.muted, highlight: t.hl,
            shadow: shadowPop.color
        })
        return t
    }

    // ── type ─────────────────────────────────────────────────────────
    readonly property string fontFamily: "Geist"
    readonly property string monoFamily: "Geist Mono"
    // font.pixelSize only takes whole pixels; the type scale has halves
    // (12.5, 13.5, 14.5), so those sizes go in as points (96 dpi logical).
    function pt(px) { return px * 0.75 }
    // Legacy sizes; new code uses the pixel sizes from DESIGN.md directly.
    readonly property int fontXs: 11
    readonly property int fontSm: 12
    readonly property int fontMd: 13
    readonly property int fontLg: 14
    readonly property int fontXl: 16

    // ── shape ────────────────────────────────────────────────────────
    readonly property int radiusSm: 4
    readonly property int radius: 6
    readonly property int radiusLg: 8
    readonly property int radiusXl: 12

    // ── motion ───────────────────────────────────────────────────────
    readonly property int fast: 120
    readonly property int normal: 200

    // Palette handed to the editor's document styler.
    readonly property var editorPalette: ({
        bodyFamily: fontFamily,
        monoFamily: monoFamily,
        basePx: 16 * textScale,
        lineHeight: 170,
        text: c.text,
        muted: c.muted,
        subtle: c.faint,
        accent: accent,
        accentText: accent,
        link: c.ink,
        inlineCodeBg: c.inlineCode,
        inlineCodeText: c.ink,
        codeBlockBg: c.codeBg,
        codeBlockText: c.text,
        highlightBg: c.hl,
        quoteText: c.secondary,
        checkedText: c.muted,
        rule: c.line,
        tableBorder: c.lineFaint,
        tableHeaderBg: c.bg,
        checkbox: accent
    })
}
