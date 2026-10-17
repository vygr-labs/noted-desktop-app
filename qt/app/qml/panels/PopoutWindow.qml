import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// Small floating window: a live, read-only view of a note.
Window {
    id: win
    property string mode: "note"
    property string noteId: ""
    property bool pinned: false

    width: 420
    height: 520
    minimumWidth: 260
    minimumHeight: 220
    color: Theme.c.window
    flags: Qt.Window | Qt.FramelessWindowHint | (pinned ? Qt.WindowStaysOnTopHint : 0) | (AppState.popoutSkipTaskbar ? Qt.Tool : 0)
    title: note.title || "Note"

    property var note: ({})
    function reload() { note = Store.note(noteId) }
    // A read-only live view: the main window stays the only writer, so two
    // editors can never overwrite each other's saves.
    function loadContent() {
        if (mode !== "note" || !note.id || AppState.isLocked(note)) return
        if (note.note_type === "plain") plainView.text = note.content || ""
        else richEditor.controller.load("", note.content || "")
    }
    Component.onCompleted: { reload(); loadContent() }
    Connections {
        target: Store
        function onNoteChanged(id) { if (id === win.noteId) { win.note = Store.note(id); win.loadContent() } }
    }

    Rectangle {
        anchors.fill: parent
        color: "transparent"
        border.color: Theme.c.border
        z: 10
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            color: Theme.c.sidebar
            MouseArea { anchors.fill: parent; onPressed: win.startSystemMove() }
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 12
                anchors.rightMargin: 4
                spacing: 4
                Icon { name: "file-text"; size: 13; color: Theme.c.muted }
                Text { textFormat: Text.PlainText; text: win.title; color: Theme.c.text; font.pixelSize: Theme.fontSm; font.weight: Font.DemiBold; elide: Text.ElideRight; Layout.fillWidth: true }
                IconButton { icon: win.pinned ? "pin-off" : "pin"; size: 26; iconSize: 13; checked: win.pinned; tooltip: win.pinned ? "Unpin" : "Keep on top"; onClicked: win.pinned = !win.pinned }
                IconButton { icon: "x"; size: 26; iconSize: 14; tooltip: "Close"; onClicked: win.close() }
            }
        }

        // ── note ─────────────────────────────────────────────────────
        Flickable {
            visible: win.mode === "note"
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentHeight: noteCol.implicitHeight + 40
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBarThin {}
            ColumnLayout {
                id: noteCol
                x: 18
                y: 14
                width: parent.width - 36
                spacing: 10
                Text {
                    textFormat: Text.PlainText
                    Layout.fillWidth: true
                    text: win.note.title || "Untitled"
                    color: Theme.c.text
                    font.pixelSize: 20
                    font.weight: Font.Bold
                    wrapMode: Text.Wrap
                }
                Text {
                    textFormat: Text.PlainText
                    visible: AppState.isLocked(win.note)
                    text: "This note is locked. Unlock it in the main window."
                    color: Theme.c.muted
                    font.pixelSize: Theme.fontMd
                }
                RichEditor {
                    id: richEditor
                    readOnly: true
                    visible: win.note.note_type !== "plain" && !AppState.isLocked(win.note)
                    Layout.fillWidth: true
                }
                TextEdit {
                    id: plainView
                    readOnly: true
                    selectByMouse: true
                    visible: win.note.note_type === "plain" && !AppState.isLocked(win.note)
                    Layout.fillWidth: true
                    wrapMode: TextEdit.Wrap
                    color: Theme.c.text
                    font.pixelSize: 14
                }
            }
        }
    }

    ResizeFrame { window: win }
}
