import QtQuick
import Noted

// Plain-text editor (plain notes and opened text files): one text area, saved as-is.
Item {
    id: root
    property string noteId: ""
    property bool dirty: false
    property alias textEdit: edit
    signal caretMoved(rect r)

    implicitHeight: Math.max(edit.implicitHeight, 200)

    function load(id, text) {
        flush()
        noteId = id
        loading = true
        edit.text = text || ""
        loading = false
        dirty = false
    }
    function flush() {
        saveTimer.stop()
        if (!dirty || noteId === "") return
        if (Files.isFile(noteId)) {
            if (!Files.writeText(noteId, edit.text)) return  // stays dirty; the next edit retries
        } else {
            Store.updateNote(noteId, { content: edit.text, content_plain: edit.text })
        }
        dirty = false
    }
    function focusEnd() { edit.forceActiveFocus(); edit.cursorPosition = edit.length }
    property bool loading: false
    readonly property int wordCount: {
        const t = edit.text.trim()
        return t === "" ? 0 : t.split(/\s+/).length
    }

    TextEdit {
        id: edit
        cursorDelegate: Caret { target: edit }
        width: parent.width
        textFormat: TextEdit.PlainText
        wrapMode: TextEdit.Wrap
        selectByMouse: true
        persistentSelection: true
        color: Theme.c.text
        selectionColor: Theme.c.selection
        selectedTextColor: Theme.c.text
        font.family: Theme.fontFamily
        font.pixelSize: Math.round(15 * Theme.textScale)
        onCursorRectangleChanged: root.caretMoved(cursorRectangle)
        onTextChanged: {
            if (root.loading) return
            root.dirty = true
            saveTimer.restart()
            Notes.patch(root.noteId, root.noteId === AppState.currentNote.id ? (AppState.currentNote.title || "") : "", text.substring(0, 240))
        }
        Text {
            textFormat: Text.PlainText
            visible: edit.length === 0
            text: "Start writing…"
            color: Theme.c.faint
            font: edit.font
        }
    }

    Timer {
        id: saveTimer
        interval: 500
        onTriggered: root.flush()
    }

    Component.onDestruction: flush()
}
