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
        search.findMatches = []   // their positions are for the old text
        edit.text = text || ""
        loading = false
        dirty = false
        rebuildFind()
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
        search.findMatches = []
        edit.text = text
        loading = false
        if (caret === anchor) edit.cursorPosition = caret
        else edit.select(anchor, caret)
        rebuildFind()
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

    // Find and replace, shaped like EditorController's so one FindBar drives
    // both editors. Matches ignore case, as in rich notes.
    property alias finder: search
    QtObject {
        id: search
        property string findQuery: ""
        property var findMatches: []   // [{start, length}]
        property int findIndex: -1
        signal findChanged()
        onFindQueryChanged: root.rebuildFind()
        function findNext(backwards) {
            const n = findMatches.length
            if (n === 0) return -1
            findIndex = findIndex < 0 ? 0 : (findIndex + (backwards ? n - 1 : 1)) % n
            const m = findMatches[findIndex]
            edit.select(m.start, m.start + m.length)
            findChanged()
            return m.start
        }
        function replaceCurrent(text) {
            if (findIndex < 0 || findIndex >= findMatches.length) return
            const m = findMatches[findIndex]
            const at = findIndex
            root.replacing = true
            edit.remove(m.start, m.start + m.length)
            edit.insert(m.start, text)
            root.replacing = false
            root.rebuildFind()
            if (findMatches.length > 0) {
                findIndex = Math.min(at, findMatches.length - 1) - 1
                findNext(false)
            }
        }
        function replaceAll(text) {
            const all = findMatches
            root.replacing = true
            for (let i = all.length - 1; i >= 0; --i) {
                edit.remove(all[i].start, all[i].start + all[i].length)
                edit.insert(all[i].start, text)
            }
            root.replacing = false
            root.rebuildFind()
            return all.length
        }
    }
    property bool replacing: false
    function rebuildFind() {
        const q = search.findQuery.toLowerCase()
        const out = []
        let at = -1
        if (q !== "") {
            const t = edit.text.toLowerCase()
            const from = Math.min(edit.selectionStart, edit.cursorPosition)
            for (let p = t.indexOf(q); p >= 0 && out.length <= 5000; p = t.indexOf(q, p + q.length)) {
                if (at < 0 && p >= from) at = out.length
                out.push({ start: p, length: q.length })
            }
            if (at < 0 && out.length > 0) at = 0
        }
        search.findMatches = out
        search.findIndex = at
        search.findChanged()
    }
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
        // Also raised when find selects a match, with the text unchanged.
        property string lastText: ""
        onTextChanged: {
            if (text === lastText) return
            lastText = text
            if (root.loading) return
            if (search.findQuery !== "" && !root.replacing) root.rebuildFind()
            root.dirty = true
            saveTimer.restart()
            Notes.patch(root.noteId, root.noteId === AppState.currentNote.id ? (AppState.currentNote.title || "") : "", text.substring(0, 240))
        }
        // Find highlights, drawn under the text.
        Repeater {
            model: search.findMatches
            delegate: Rectangle {
                required property var modelData
                required property int index
                readonly property rect a: { edit.width; edit.contentHeight; return edit.positionToRectangle(modelData.start) }
                readonly property rect b: { edit.width; edit.contentHeight; return edit.positionToRectangle(modelData.start + modelData.length) }
                z: -1
                x: a.x - 1
                y: a.y
                width: b.y === a.y ? Math.max(4, b.x - a.x + 2) : edit.width - a.x
                height: a.height
                radius: 3
                color: index === search.findIndex ? Qt.alpha(Theme.c.accent, 0.45) : Qt.alpha(Theme.c.accent, 0.16)
            }
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
