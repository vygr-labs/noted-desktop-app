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
    // New text from elsewhere, keeping the caret: before the change it stays,
    // after it moves with the text, inside it goes to the change's end.
    function refresh(id, text) {
        text = text || ""
        if (id !== noteId) { load(id, text); return }
        if (dirty || text === edit.text) return
        const old = edit.text
        let p = 0
        while (p < old.length && p < text.length && old[p] === text[p]) ++p
        let s = 0
        while (s < old.length - p && s < text.length - p && old[old.length - 1 - s] === text[text.length - 1 - s]) ++s
        const map = (x) => x <= p ? x : x >= old.length - s ? x + text.length - old.length : text.length - s
        const caret = map(edit.cursorPosition)
        const anchor = map(edit.cursorPosition === edit.selectionEnd ? edit.selectionStart : edit.selectionEnd)
        loading = true
        edit.text = text
        loading = false
        if (caret === anchor) edit.cursorPosition = caret
        else edit.select(anchor, caret)
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
