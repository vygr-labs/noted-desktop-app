import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Settings as a page: sections on the left, the section's rows on the right.
Flickable {
    id: page

    property bool active: false
    signal exportRequested(string format)
    signal pinRequested(string mode)

    readonly property string section: AppState.view === "settings" && AppState.viewId ? AppState.viewId : "appearance"
    readonly property var sections: [
        ["appearance", "Appearance"], ["editor", "Editor"], ["sharing", "Sharing"], ["security", "Security"],
        ["capture", "Quick capture"], ["data", "Data"], ["about", "About"]
    ]
    readonly property string title: (sections.find(s => s[0] === section) || sections[0])[1]

    onActiveChanged: if (active) { contentY = 0; AppState.refreshCounts() }

    contentWidth: width
    contentHeight: frame.height + 96
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    ScrollBar.vertical: ScrollBarThin {}

    readonly property real frameW: Math.min(940, width) - 96
    readonly property bool wrapped: frameW < 168 + 56 + 420

    Item {
        id: frame
        x: (page.width - page.frameW) / 2
        y: 40
        width: page.frameW
        height: page.wrapped ? nav.height + 40 + body.height : Math.max(nav.height + 25, body.height)

        // ── sections ─────────────────────────────────────────────────
        Column {
            id: nav
            y: page.wrapped ? 0 : 25
            width: page.wrapped ? frame.width : 196
            spacing: 1
            Repeater {
                model: page.sections
                delegate: Rectangle {
                    required property var modelData
                    readonly property bool on: page.section === modelData[0]
                    width: nav.width
                    height: 34
                    radius: 6
                    color: on ? Theme.c.selected : (navArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
                    Text {
                        textFormat: Text.PlainText
                        x: 10
                        anchors.verticalCenter: parent.verticalCenter
                        text: parent.modelData[1]
                        color: parent.on ? Theme.c.ink : Theme.c.text
                        font.pixelSize: 14
                        font.weight: parent.on ? Font.Medium : Font.Normal
                    }
                    MouseArea {
                        id: navArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: AppState.go("settings", parent.modelData[0])
                    }
                }
            }
        }

        // ── the section ──────────────────────────────────────────────
        Column {
            id: body
            x: page.wrapped ? 0 : 196 + 56
            y: page.wrapped ? nav.height + 40 : 0
            width: page.wrapped ? frame.width : Math.min(620, frame.width - 196 - 56)

            Text { textFormat: Text.PlainText; text: "Settings"; color: Theme.c.muted; font.pixelSize: 13 }
            Item { width: 1; height: 6 }
            Text { textFormat: Text.PlainText; text: page.title; color: Theme.c.ink; font.pixelSize: 34; font.weight: 650; font.letterSpacing: -0.68 }

            Loader {
                width: parent.width
                sourceComponent: ({ appearance: appearance, editor: editor, sharing: sharing, security: security,
                                    capture: capture, data: data, about: about })[page.section] || appearance
            }
        }
    }

    component Intro: Text {
        textFormat: Text.PlainText
        width: parent ? parent.width : 0
        topPadding: 14
        bottomPadding: 4
        color: Theme.c.muted
        font.pixelSize: 14
        lineHeightMode: Text.FixedHeight
        lineHeight: 22
        wrapMode: Text.Wrap
    }

    // Appearance
    Component {
        id: appearance
        Column {
            width: parent ? parent.width : 0
            Item { width: 1; height: 28 }
            Text { textFormat: Text.PlainText; text: "Theme"; color: Theme.c.ink; font.pointSize: Theme.pt(14.5); font.weight: Font.Medium }
            Item { width: 1; height: 12 }
            Flow {
                width: parent.width
                spacing: 16
                Repeater {
                    model: [["light", "Light"], ["dark", "Dark"], ["system", "Match Windows"]]
                    delegate: ThemeCard {
                        required property var modelData
                        kind: modelData[0]
                        label: modelData[1]
                        selected: Theme.mode === modelData[0]
                        onPicked: AppState.setTheme(modelData[0])
                    }
                }
            }
            Item { width: 1; height: 28 }
            SettingRow {
                label: "Accent"
                description: "Used for ticked to-dos, today and the text selection. Nowhere else."
                Row {
                    spacing: 12
                    Repeater {
                        model: Theme.accents
                        delegate: Item {
                            required property var modelData
                            readonly property bool on: Theme.accentChoice.toUpperCase() === modelData.hex.toUpperCase()
                            readonly property color shown: Theme.dark ? (modelData.name === "Ink" ? Theme.c.ink : Theme.mix(modelData.hex, "#FFFFFF", 0.22)) : modelData.hex
                            width: 22
                            height: 22
                            Rectangle {
                                visible: parent.on
                                anchors.centerIn: parent
                                width: 29
                                height: 29
                                radius: 14.5
                                color: "transparent"
                                border.width: 1.5
                                border.color: parent.shown
                            }
                            Rectangle { anchors.fill: parent; radius: 11; color: parent.shown }
                            MouseArea {
                                id: accArea
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: AppState.setAccent(parent.modelData.hex)
                            }
                            Tip { visible: accArea.containsMouse; text: parent.modelData.name }
                        }
                    }
                }
            }
            SettingRow {
                label: "Text size"
                description: "For the text in your notes. The rest of the app stays the same size."
                Segmented {
                    readonly property var steps: [["0.9375", "Small"], ["1", "Default"], ["1.094", "Large"], ["1.1875", "Larger"]]
                    options: steps.map(s => ({ value: s[0], label: s[1] }))
                    value: { const t = Theme.textScale; let best = steps[1][0]; for (const s of steps) if (Math.abs(parseFloat(s[0]) - t) < 0.02) best = s[0]; return best }
                    onPicked: (v) => AppState.setTextScale(parseFloat(v))
                }
            }
            Rectangle {
                width: parent.width
                height: sample.implicitHeight + 28
                radius: 8
                color: Theme.c.codeBg
                Text {
                    textFormat: Text.PlainText
                    id: sample
                    x: 16
                    y: 14
                    width: parent.width - 32
                    text: "Rehearsal moved to Thursday at 6. Bring the updated chord sheets, and check the new song list before Sunday."
                    color: Theme.c.text
                    font.pointSize: Theme.pt(16 * Theme.textScale)
                    lineHeightMode: Text.FixedHeight
                    lineHeight: Math.round(16 * Theme.textScale * 1.65)
                    wrapMode: Text.Wrap
                }
            }
            Item { width: 1; height: 16 }
            SettingRow {
                label: "Text width"
                description: "Wide lets a note use the whole window. You can still switch one note from its More menu."
                Segmented {
                    options: [{ value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }]
                    value: AppState.fullWidth ? "wide" : "normal"
                    onPicked: (v) => AppState.setFullWidth(v === "wide")
                }
            }
        }
    }

    // Editor
    Component {
        id: editor
        Column {
            width: parent ? parent.width : 0
            Item { width: 1; height: 28 }
            SettingRow {
                first: true
                label: "New notes start as"
                description: "Plain text keeps markdown exactly as you type it. You can convert a note later."
                Segmented {
                    options: [{ value: "rich", label: "Rich text" }, { value: "plain", label: "Plain text" }]
                    value: AppState.defaultNoteType
                    onPicked: (v) => { AppState.defaultNoteType = v; AppState.save("defaultNoteType", v) }
                }
            }
            SettingRow {
                label: "Note previews"
                description: "Show the first lines of each note under its title in rows."
                Toggle { checked: AppState.showPreview; onToggled: (v) => AppState.setShowPreview(v) }
            }
            SettingRow {
                label: "Markdown and text files"
                description: "To open .md and .txt files in noted, choose it for those types in Windows’ default apps. They stay files on disk and show under Files in the sidebar."
                TextButton { text: "Default apps…"; onClicked: App.openExternal("ms-settings:defaultapps") }
            }
        }
    }

    // Sharing
    Component {
        id: sharing
        Column {
            width: parent ? parent.width : 0
            property bool showToken: false
            Intro { text: "Share a note to edit it with someone else in real time. Everything else stays on this computer." }
            Item { width: 1; height: 14 }
            SettingRow {
                first: true
                label: "Connection"
                description: "Live sync isn’t in this build yet, so shared notes save on this computer until it is. " + Fmt.plural(AppState.counts.synced || 0, "note is", "notes are") + " shared."
            }
            Column {
                width: parent.width
                topPadding: 16
                bottomPadding: 16
                Rectangle { width: parent.width; height: 1; color: Theme.c.lineFaint; y: 0 }
                Text { textFormat: Text.PlainText; text: "Server"; color: Theme.c.ink; font.pointSize: Theme.pt(14.5); font.weight: Font.Medium; topPadding: 16 }
                Text { textFormat: Text.PlainText; text: "Leave this alone to use the noted server."; color: Theme.c.muted; font.pointSize: Theme.pt(13.5); topPadding: 2 }
                Item { width: 1; height: 10 }
                Field {
                    width: parent.width
                    implicitHeight: 36
                    mono: true
                    font.pixelSize: 13
                    text: Store.setting("syncServerUrl", "")
                    placeholderText: "wss://…"
                    onEditingFinished: AppState.save("syncServerUrl", text.trim())
                }
            }
            Column {
                id: tokenCol
                width: parent.width
                bottomPadding: 16
                property bool show: false
                Rectangle { width: parent.width; height: 1; color: Theme.c.lineFaint }
                Text { textFormat: Text.PlainText; text: "Access token"; color: Theme.c.ink; font.pointSize: Theme.pt(14.5); font.weight: Font.Medium; topPadding: 16 }
                Text { textFormat: Text.PlainText; width: parent.width; text: "Only needed for your own server. It has to match the server’s secret."; color: Theme.c.muted; font.pointSize: Theme.pt(13.5); topPadding: 2; wrapMode: Text.Wrap }
                Item { width: 1; height: 10 }
                RowLayout {
                    width: parent.width
                    spacing: 8
                    Field {
                        Layout.fillWidth: true
                        implicitHeight: 36
                        mono: true
                        font.pixelSize: 13
                        echoMode: tokenCol.show ? TextInput.Normal : TextInput.Password
                        text: Store.setting("syncToken", "")
                        onEditingFinished: AppState.save("syncToken", text.trim())
                    }
                    TextButton { implicitWidth: 64; implicitHeight: 36; text: tokenCol.show ? "Hide" : "Show"; onClicked: tokenCol.show = !tokenCol.show }
                }
            }
        }
    }

    // Security
    Component {
        id: security
        Column {
            width: parent ? parent.width : 0
            Item { width: 1; height: 28 }
            SettingRow {
                first: true
                label: "Lock PIN"
                description: AppState.hasLockPin ? "Set. Locked notes ask for it before they open." : "Set a PIN to lock individual notes."
                TextButton { visible: AppState.hasLockPin; text: "Change"; onClicked: page.pinRequested("change") }
                TextButton { visible: AppState.hasLockPin; text: "Remove"; variant: "destructive"; onClicked: page.pinRequested("remove") }
                TextButton { visible: !AppState.hasLockPin; text: "Set a PIN"; onClicked: page.pinRequested("set") }
            }
            SettingRow {
                label: "Locked notes"
                description: {
                    const n = AppState.counts.locked || 0
                    if (!AppState.hasLockPin) return "None. Removing the PIN unlocks every note."
                    return (n ? Fmt.plural(n, "note") + ". " : "None yet. ") + "Lock or unlock one from its More menu. An unlocked note stays open until you quit noted."
                }
            }
        }
    }

    // Quick capture
    Component {
        id: capture
        Column {
            width: parent ? parent.width : 0
            Intro { text: "A small window for jotting something down from anywhere, even when noted is in the background." }
            Item { width: 1; height: 14 }
            SettingRow {
                first: true
                label: "Shortcut"
                description: App.hotkeyRegistered ? "Works in every app while noted is running." : "Another app is using Ctrl Alt N, so the shortcut is off for now."
                Kbd { text: "Ctrl" }
                Kbd { text: "Alt" }
                Kbd { text: "N" }
            }
            SettingRow {
                label: "Hide pop-outs from Alt+Tab"
                description: "Quick capture and popped-out notes stay out of the window switcher and taskbar."
                Toggle { checked: AppState.popoutSkipTaskbar; onToggled: (v) => { AppState.popoutSkipTaskbar = v; AppState.save("popoutSkipTaskbar", v ? "true" : "false") } }
            }
        }
    }

    // Data
    Component {
        id: data
        Column {
            width: parent ? parent.width : 0
            Item { width: 1; height: 28 }
            SettingRow {
                first: true
                label: "Where your notes live"
                description: App.dataPath + (App.devData ? "\nA private copy for this dev build. Start it with --real-data to use your live notes." : "")
                TextButton { text: "Show in folder"; onClicked: App.revealFile(App.dataPath) }
            }
            SettingRow {
                label: "Export"
                description: "Every note, list and tag in one JSON or SQL file, or your notes as markdown files in a ZIP."
                TextButton {
                    id: exportButton
                    text: "Export…"
                    onClicked: exportMenu.openBelowRight(exportButton, [
                        { text: "JSON file", action: () => page.exportRequested("json") },
                        { text: "SQL file", action: () => page.exportRequested("sql") },
                        { text: "Markdown files (ZIP)", action: () => page.exportRequested("zip") }
                    ])
                }
            }
            SettingRow {
                label: "Trash"
                description: (AppState.counts.trash || 0) ? Fmt.plural(AppState.counts.trash, "note") + ". They stay here until you empty it." : "Empty."
                TextButton { visible: (AppState.counts.trash || 0) > 0; text: "Open trash"; onClicked: AppState.go("trash") }
                TextButton { visible: (AppState.counts.trash || 0) > 0; text: "Empty trash"; variant: "destructive"; onClicked: emptyDialog.open() }
            }
        }
    }

    // About
    Component {
        id: about
        Column {
            width: parent ? parent.width : 0
            topPadding: 28
            Image { source: "qrc:/brand/icon.png"; width: 64; height: 64; sourceSize: Qt.size(128, 128); smooth: true; mipmap: true }
            Item { width: 1; height: 16 }
            Text { textFormat: Text.StyledText; text: "noted<font color=\"" + Theme.accent + "\">.</font>"; color: Theme.c.ink; font.pixelSize: 22; font.weight: 650; font.letterSpacing: -0.22 }
            Text { textFormat: Text.PlainText; topPadding: 4; text: "Version " + App.version; color: Theme.c.muted; font.pixelSize: 14; font.features: { "tnum": 1 } }
            Text {
                textFormat: Text.PlainText
                topPadding: 18
                width: Math.min(parent.width, 460)
                text: "Notes, lists and to-dos that live on your computer. Made with care by Eyetu Kingsley at Voyager Technologies."
                color: Theme.c.text
                font.pointSize: Theme.pt(14.5)
                lineHeightMode: Text.FixedHeight
                lineHeight: 23
                wrapMode: Text.Wrap
            }
        }
    }

    PopupMenu { id: exportMenu }
    ModalDialog {
        id: emptyDialog
        title: "Empty the trash?"
        description: Fmt.plural(AppState.counts.trash || 0, "note") + " will be deleted for good. This can’t be undone."
        footer: [
            TextButton { text: "Cancel"; onClicked: emptyDialog.close() },
            TextButton { text: "Empty trash"; variant: "destructive"; onClicked: { Store.emptyTrash(); AppState.refreshCounts(); emptyDialog.close() } }
        ]
    }

    // A small drawing of the app in that theme.
    component ThemeCard: Column {
        id: card
        property string kind: "light"
        property string label: ""
        property bool selected: false
        signal picked()
        spacing: 8
        readonly property var lightSide: ({ bg: "#FFFFFF", side: "#F5F4F1", bar: "#D6D3CC", ink: "#3A3936", line: "#E2E0DA", edge: "#E2E0DA" })
        readonly property var darkSide: ({ bg: "#1C1C1B", side: "#161615", bar: "#46453F", ink: "#CAC9C3", line: "#353532", edge: "#353532" })
        Item {
            width: 148
            height: 92
            Rectangle {
                visible: card.selected
                anchors.fill: parent
                anchors.margins: -3.5
                radius: 12.5
                color: "transparent"
                border.width: 1.5
                border.color: Theme.c.accent
            }
            Rectangle {
                id: shot
                anchors.fill: parent
                radius: 9
                clip: true
                readonly property var p: card.kind === "dark" ? card.darkSide : card.lightSide
                color: p.bg
                border.color: p.edge
                Rectangle {
                    x: 1; y: 1; width: 38; height: parent.height - 2
                    topLeftRadius: 8; bottomLeftRadius: 8; topRightRadius: 0; bottomRightRadius: 0
                    color: shot.p.side
                    Column {
                        x: 7; y: 10; width: 24; spacing: 5
                        Repeater { model: 3; delegate: Rectangle { width: 24; height: 4; radius: 2; color: shot.p.bar } }
                    }
                }
                Column {
                    x: 51; y: 12; width: parent.width - 63; spacing: 6
                    Rectangle { width: parent.width * 0.6; height: 6; radius: 3; color: shot.p.ink }
                    Repeater { model: 3; delegate: Rectangle { width: parent.width * (index === 2 ? 0.7 : 1); height: 4; radius: 2; color: shot.p.line } }
                }
                // Match Windows: the right half in dark.
                Rectangle {
                    visible: card.kind === "system"
                    x: 74; width: parent.width - 74; height: parent.height
                    topRightRadius: 9; bottomRightRadius: 9; topLeftRadius: 0; bottomLeftRadius: 0
                    color: card.darkSide.bg
                    border.color: card.darkSide.edge
                    Column {
                        y: 12; width: parent.width - 12; spacing: 6
                        Rectangle { width: parent.width * 0.4; height: 6; topRightRadius: 3; bottomRightRadius: 3; color: card.darkSide.ink }
                        Repeater { model: 3; delegate: Rectangle { width: parent.width * (index === 2 ? 0.55 : 1); height: 4; topRightRadius: 2; bottomRightRadius: 2; color: card.darkSide.line } }
                    }
                }
            }
            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: card.picked()
            }
        }
        Text {
            textFormat: Text.PlainText
            text: card.label
            color: card.selected ? Theme.c.ink : Theme.c.secondary
            font.pointSize: Theme.pt(13.5)
            font.weight: card.selected ? Font.Medium : Font.Normal
        }
    }
}
