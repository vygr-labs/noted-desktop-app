import QtQuick
import QtQuick.Layouts
import Noted

// Ctrl+Alt+N from anywhere: a small always-on-top window that saves a
// plain note titled by its first line.
Window {
    id: win
    width: 520
    height: 240
    flags: Qt.Tool | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
    color: "transparent"
    title: "Quick capture"

    function showCentered() {
        const s = Screen
        x = (s.desktopAvailableWidth - width) / 2
        y = s.desktopAvailableHeight * 0.28
        input.text = ""
        show()
        raise()
        requestActivate()
        input.forceActiveFocus()
    }

    function save() {
        const text = input.text.trim()
        if (text !== "") {
            const firstLine = text.split("\n")[0].trim()
            Store.createNote({ title: firstLine.substring(0, 100) || "Quick note", content: text, content_plain: text, note_type: "plain" })
            AppState.toast("Saved to All Notes")
        }
        hide()
    }

    onActiveChanged: if (!active && visible) hideTimer.start()
    Timer { id: hideTimer; interval: 150; onTriggered: if (!win.active) win.hide() }

    Rectangle {
        anchors.fill: parent
        anchors.margins: 8
        radius: Theme.radiusXl
        color: Theme.c.raised
        border.color: Theme.c.border

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 16
            spacing: 10

            RowLayout {
                Layout.fillWidth: true
                MouseArea {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 22
                    onPressed: win.startSystemMove()
                    Row {
                        spacing: 8
                        anchors.verticalCenter: parent.verticalCenter
                        Icon { name: "zap"; size: 15; color: Theme.c.accent; anchors.verticalCenter: parent.verticalCenter }
                        Text { textFormat: Text.PlainText; text: "Quick capture"; color: Theme.c.text; font.pixelSize: Theme.fontMd; font.weight: Font.DemiBold; anchors.verticalCenter: parent.verticalCenter }
                    }
                }
                Kbd { text: "Ctrl Enter to save" }
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: Theme.radiusLg
                color: Theme.c.window
                border.color: input.activeFocus ? Theme.c.accentLine : Theme.c.border
                Flickable {
                    anchors.fill: parent
                    anchors.margins: 10
                    contentHeight: input.implicitHeight
                    clip: true
                    TextEdit {
                        id: input
                        cursorDelegate: Caret { target: input }
                        width: parent.width
                        wrapMode: TextEdit.Wrap
                        color: Theme.c.text
                        font.pixelSize: Theme.fontLg
                        selectByMouse: true
                        Text { textFormat: Text.PlainText; visible: input.length === 0; text: "Jot something down…"; color: Theme.c.faint; font: input.font }
                        Keys.onPressed: (e) => {
                            if ((e.key === Qt.Key_Return || e.key === Qt.Key_Enter) && (e.modifiers & Qt.ControlModifier)) { win.save(); e.accepted = true }
                            else if (e.key === Qt.Key_Escape) { win.hide(); e.accepted = true }
                        }
                    }
                }
            }
            RowLayout {
                Layout.fillWidth: true
                Text { textFormat: Text.PlainText; text: "Saved as a plain note. Esc to dismiss."; color: Theme.c.subtle; font.pixelSize: Theme.fontSm; Layout.fillWidth: true }
                TextButton { text: "Save note"; variant: "primary"; compact: true; onClicked: win.save() }
            }
        }
    }
}
