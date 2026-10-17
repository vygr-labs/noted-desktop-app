import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

Popup {
    id: dlg
    signal pinRequested(string mode)

    parent: Overlay.overlay
    anchors.centerIn: parent
    width: Math.min(560, parent.width - 48)
    height: Math.min(640, parent.height - 64)
    modal: true
    focus: true
    padding: 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    onClosed: AppState.settingsOpen = false

    Overlay.modal: Rectangle { color: Theme.c.scrim }
    enter: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 110 }
        NumberAnimation { property: "scale"; from: 0.97; to: 1; duration: 150; easing.type: Easing.OutCubic }
    }
    background: Rectangle { radius: Theme.radiusXl; color: Theme.c.raised; border.color: Theme.c.border }

    component Section: Text {
        color: Theme.c.subtle
        font.pixelSize: 12
        font.weight: Font.Medium
        Layout.topMargin: 14
    }
    component Setting: RowLayout {
        property string label: ""
        property string hint: ""
        default property alias control: slot.data
        Layout.fillWidth: true
        spacing: 16
        ColumnLayout {
            spacing: 2
            Layout.fillWidth: true
            Text { text: parent.parent.label; color: Theme.c.text; font.pixelSize: Theme.fontMd + 1; font.weight: Font.Medium; Layout.fillWidth: true }
            Text { visible: parent.parent.hint !== ""; text: parent.parent.hint; color: Theme.c.muted; font.pixelSize: Theme.fontSm; wrapMode: Text.Wrap; Layout.fillWidth: true }
        }
        Row { id: slot; spacing: 6 }
    }
    component Choice: Rectangle {
        property string label: ""
        property string icon: ""
        property bool selected: false
        signal picked()
        width: choiceCol.implicitWidth + 20
        height: 58
        radius: Theme.radiusLg
        color: selected ? Theme.c.accentSubtle : (choiceArea.containsMouse ? Theme.c.hover : "transparent")
        border.color: selected ? Theme.c.accent : Theme.c.border
        border.width: selected ? 1.5 : 1
        Column {
            id: choiceCol
            anchors.centerIn: parent
            spacing: 5
            Icon { anchors.horizontalCenter: parent.horizontalCenter; name: parent.parent.icon; size: 17; color: parent.parent.selected ? Theme.c.accentText : Theme.c.muted }
            Text { anchors.horizontalCenter: parent.horizontalCenter; text: parent.parent.label; color: parent.parent.selected ? Theme.c.accentText : Theme.c.text; font.pixelSize: Theme.fontSm }
        }
        MouseArea { id: choiceArea; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: parent.picked() }
    }
    component Segmented: Row {
        id: seg
        property var options: []   // [[value, label]]
        property string value: ""
        signal chosen(string v)
        spacing: 0
        Repeater {
            model: seg.options
            delegate: Rectangle {
                required property var modelData
                required property int index
                width: segText.implicitWidth + 22
                height: 30
                color: seg.value === modelData[0] ? Theme.c.accentSubtle : (segArea.containsMouse ? Theme.c.hover : "transparent")
                border.color: seg.value === modelData[0] ? Theme.c.accentLine : Theme.c.border
                radius: 0
                Text { id: segText; anchors.centerIn: parent; text: parent.modelData[1]; color: seg.value === parent.modelData[0] ? Theme.c.accentText : Theme.c.text; font.pixelSize: Theme.fontSm }
                MouseArea { id: segArea; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: seg.chosen(parent.modelData[0]) }
            }
        }
    }

    contentItem: ColumnLayout {
        spacing: 0
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: 22
            Layout.bottomMargin: 10
            ColumnLayout {
                spacing: 3
                Layout.fillWidth: true
                Text { text: "Settings"; color: Theme.c.text; font.pixelSize: 19; font.weight: Font.Bold; Layout.fillWidth: true }
                Text { text: "Make noted. yours."; color: Theme.c.muted; font.pixelSize: Theme.fontMd; Layout.fillWidth: true }
            }
            IconButton { icon: "x"; tooltip: "Close"; onClicked: dlg.close() }
        }
        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Theme.c.divider }

        Flickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentHeight: settingsCol.implicitHeight + 40
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBarThin {}

            ColumnLayout {
                id: settingsCol
                x: 22
                y: 6
                width: parent.width - 44
                spacing: 12

                Section { text: "Appearance" }
                Flow {
                    Layout.fillWidth: true
                    spacing: 8
                    Repeater {
                        model: [["light", "Light", "sun"], ["warm", "Warm", "coffee"], ["slate", "Slate", "cloudy"], ["dark", "Dark", "moon"], ["system", "System", "monitor"]]
                        delegate: Choice {
                            required property var modelData
                            label: modelData[1]
                            icon: modelData[2]
                            selected: Theme.mode === modelData[0]
                            onPicked: AppState.setTheme(modelData[0])
                        }
                    }
                }
                Setting {
                    label: "Text size"
                    hint: "Editor text scale. Ctrl + / Ctrl − / Ctrl 0 also work."
                    IconButton { icon: "minus"; size: 28; onClicked: AppState.setTextScale(Theme.textScale - 0.1) }
                    Text { text: Math.round(Theme.textScale * 100) + "%"; color: Theme.c.text; font.pixelSize: Theme.fontMd; width: 42; horizontalAlignment: Text.AlignHCenter; anchors.verticalCenter: parent.verticalCenter }
                    IconButton { icon: "plus"; size: 28; onClicked: AppState.setTextScale(Theme.textScale + 0.1) }
                }

                Section { text: "Editor" }
                Setting {
                    label: "Default note type"
                    hint: "What Ctrl+N creates."
                    Segmented {
                        options: [["rich", "Rich text"], ["plain", "Plain text"]]
                        value: AppState.defaultNoteType
                        onChosen: (v) => { AppState.defaultNoteType = v; AppState.save("defaultNoteType", v) }
                    }
                }
                Setting {
                    label: "Toolbar"
                    Segmented {
                        options: [["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"], ["hidden", "Off"]]
                        value: AppState.toolbarPosition
                        onChosen: (v) => AppState.setToolbarPosition(v)
                    }
                }
                Setting {
                    label: "Note previews"
                    hint: "Show two lines of each note in the list."
                    Toggle { checked: AppState.showPreview; onToggled: (v) => AppState.setShowPreview(v) }
                }

                Section { text: "Security" }
                Setting {
                    label: "Lock PIN"
                    hint: Store.hasLockPin ? "Locked notes need this PIN to open." : "Set a PIN to lock individual notes."
                    TextButton {
                        visible: Store.hasLockPin
                        text: "Remove"
                        compact: true
                        onClicked: dlg.pinRequested("remove")
                    }
                    TextButton {
                        text: Store.hasLockPin ? "Change" : "Set PIN"
                        variant: Store.hasLockPin ? "ghost" : "primary"
                        compact: true
                        onClicked: dlg.pinRequested(Store.hasLockPin ? "change" : "set")
                    }
                }

                Section { text: "Quick capture" }
                Setting {
                    label: "Global shortcut"
                    hint: App.hotkeyRegistered ? "Press Ctrl+Alt+N anywhere to jot a note." : "Ctrl+Alt+N is used by another app, so the global shortcut is off."
                    Kbd { text: "Ctrl Alt N"; anchors.verticalCenter: parent.verticalCenter }
                }
                Setting {
                    label: "Hide pop-outs from Alt+Tab"
                    Toggle { checked: AppState.popoutSkipTaskbar; onToggled: (v) => { AppState.popoutSkipTaskbar = v; AppState.save("popoutSkipTaskbar", v ? "true" : "false") } }
                }

                Section { text: "Data" }
                Setting {
                    label: "Database"
                    hint: App.dataPath + (App.devData ? "\nDev build: this is a private copy. Launch with --real-data to use your live notes." : "")
                    TextButton { text: "Show"; compact: true; onClicked: App.revealFile(App.dataPath) }
                }
                Setting {
                    label: "Command line"
                    hint: "noted-cli reads and writes this same database; changes show up here within a second."
                }

                Section { text: "About" }
                Text {
                    text: "noted. " + App.version + " — native Qt edition"
                    color: Theme.c.muted
                    font.pixelSize: Theme.fontMd
                }
                Text {
                    text: "Made with care by Eyetu Kingsley · Voyager Technologies"
                    color: Theme.c.subtle
                    font.pixelSize: Theme.fontSm
                }
            }
        }
    }
}
