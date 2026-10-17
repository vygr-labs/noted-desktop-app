import QtQuick
import Noted

// Tags: find one or create it. Tags are sorted by use, with their counts and
// a tick on the ones this note has. Names are lower case, spaces → hyphens.
Picker {
    id: tagPicker
    property string noteId: ""
    property var noteTags: []

    width: 260
    placeholder: "Find or create a tag"
    checkFirst: true
    readonly property string wanted: query.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-")
    rows: {
        const has = {}
        for (const t of noteTags) has[t.id] = true
        const all = AppState.tags.slice().sort((a, b) => (b.note_count || 0) - (a.note_count || 0) || a.name.localeCompare(b.name))
        const matching = all.filter(t => wanted === "" || t.name.indexOf(wanted) >= 0)
            .map(t => ({ id: t.id, text: t.name, count: t.note_count || 0, checked: !!has[t.id] }))
        const exact = all.some(t => t.name === wanted)
        return wanted !== "" && !exact ? [{ create: true, text: "#" + wanted }].concat(matching) : matching
    }
    emptyText: "No tags yet. Type one to create it."
    onPicked: (row) => {
        if (row.create) {
            Store.addTagToNote(noteId, wanted)
            query = ""
        } else if (row.checked) Store.removeTagFromNote(noteId, row.id)
        else Store.addTagToNote(noteId, row.text)
        AppState.refreshCurrent()
    }
}
