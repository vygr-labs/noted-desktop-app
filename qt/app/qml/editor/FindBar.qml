import QtQuick
import QtQuick.Layouts
import Noted

// In-note find (Ctrl+F) and replace (Ctrl+H).
Rectangle {
    id: bar
    property var editor            // EditorController, or PlainEditor.finder
    property bool replaceMode: AppState.replaceOpen
    signal closed()

    implicitHeight: col.implicitHeight + 16
    color: Theme.c.sunken

    function focusFind() { findInput.forceActiveFocus(); findInput.selectAll() }

    Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.c.divider }

    ColumnLayout {
        id: col
        anchors.fill: parent
        anchors.margins: 8
        anchors.leftMargin: 16
        anchors.rightMargin: 16
        spacing: 6

        RowLayout {
            spacing: 6
            IconButton {
                icon: "chevron-right"
                size: 26
                iconSize: 13
                rotation: bar.replaceMode ? 90 : 0
                tooltip: "Toggle replace"
                onClicked: AppState.replaceOpen = !AppState.replaceOpen
            }
            Field {
                id: findInput
                Layout.fillWidth: true
                Layout.maximumWidth: 420
                implicitHeight: 30
                leadingIcon: "search"
                placeholderText: "Find in note…"
                text: bar.editor.findQuery
                onTextChanged: bar.editor.findQuery = text
                Keys.onReturnPressed: (e) => bar.editor.findNext(e.modifiers & Qt.ShiftModifier)
                Keys.onEscapePressed: bar.closed()
            }
            Text {
                textFormat: Text.PlainText
                text: bar.editor.findQuery === "" ? "" : bar.editor.findMatches.length === 0 ? "No results"
                      : (bar.editor.findIndex + 1) + " of " + bar.editor.findMatches.length
                color: bar.editor.findMatches.length === 0 && bar.editor.findQuery !== "" ? Theme.c.dangerText : Theme.c.subtle
                font.pixelSize: Theme.fontSm
                Layout.minimumWidth: 60
            }
            IconButton { icon: "chevron-up"; size: 26; iconSize: 14; tooltip: "Previous"; shortcut: "Shift+Enter"; onClicked: bar.editor.findNext(true) }
            IconButton { icon: "chevron-down"; size: 26; iconSize: 14; tooltip: "Next"; shortcut: "Enter"; onClicked: bar.editor.findNext(false) }
            Item { Layout.fillWidth: true }
            IconButton { icon: "x"; size: 26; iconSize: 14; tooltip: "Close"; shortcut: "Esc"; onClicked: bar.closed() }
        }
        RowLayout {
            visible: bar.replaceMode
            spacing: 6
            Item { Layout.preferredWidth: 26 }
            Field {
                id: replaceInput
                Layout.fillWidth: true
                Layout.maximumWidth: 420
                implicitHeight: 30
                leadingIcon: "pencil"
                placeholderText: "Replace with…"
                Keys.onReturnPressed: bar.editor.replaceCurrent(text)
                Keys.onEscapePressed: bar.closed()
            }
            TextButton { text: "Replace"; compact: true; onClicked: bar.editor.replaceCurrent(replaceInput.text) }
            TextButton { text: "All"; compact: true; onClicked: bar.editor.replaceAll(replaceInput.text) }
            Item { Layout.fillWidth: true }
        }
    }
}
