import QtQuick
import QtQuick.Layouts
import Noted

// Title, then the tag row. Dates live in the editor's status line.
ColumnLayout {
    id: header
    property var note: ({})
    property var tags: []
    property bool readOnly: false
    property bool showTitle: true   // false when the body's opening H1 is the title
    readonly property string liveTitle: title.text.trim()
    signal enterPressed()

    spacing: 10

    function focusTitle(selectAll) {
        title.forceActiveFocus()
        if (selectAll) title.selectAll()
        else title.cursorPosition = title.length
    }

    TextEdit {
        id: title
        visible: header.showTitle
        Layout.fillWidth: true
        readOnly: header.readOnly
        wrapMode: TextEdit.Wrap
        color: Theme.c.text
        selectionColor: Theme.c.selection
        selectedTextColor: Theme.c.text
        selectByMouse: true
        font.family: Theme.fontFamily
        font.pixelSize: Math.round(32 * Theme.textScale)
        font.weight: Font.DemiBold
        font.letterSpacing: -0.6

        // Set imperatively, not bound: a binding would rewrite the text (and
        // drop a trailing space) every time a debounced save lands.
        property string noteId: header.note.id || ""
        property string storedTitle: header.note.title || ""
        function sync() { text = storedTitle === "Untitled" ? "" : storedTitle }
        onNoteIdChanged: { saveTimer.stop(); sync() }
        onStoredTitleChanged: if (!activeFocus) sync()

        Text {
            visible: title.length === 0
            text: "Untitled"
            color: Theme.c.faint
            font: title.font
        }
        Keys.onPressed: (e) => {
            if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter || (e.key === Qt.Key_Down && title.cursorPosition === title.length)) {
                e.accepted = true
                saveTimer.stop()
                title.commit()
                header.enterPressed()
            }
        }
        onTextChanged: {
            if (!activeFocus) return
            saveTimer.restart()
            Notes.patch(noteId, text.trim() === "" ? "Untitled" : text.trim().replace(/\n/g, " "), header.note.content_plain ? header.note.content_plain.substring(0, 240) : "")
        }
        onActiveFocusChanged: if (!activeFocus && saveTimer.running) { saveTimer.stop(); commit() }
        function commit() {
            if (noteId === "") return
            const t = text.trim().replace(/\n/g, " ")
            const wanted = t === "" ? "Untitled" : t
            if (wanted !== header.note.title) Store.updateNote(noteId, { title: wanted })
        }
        Timer {
            id: saveTimer
            interval: 300
            onTriggered: title.commit()
        }
    }

    TagsBar {
        Layout.fillWidth: true
        noteId: header.note.id || ""
        tags: header.tags
        readOnly: header.readOnly
    }
}
