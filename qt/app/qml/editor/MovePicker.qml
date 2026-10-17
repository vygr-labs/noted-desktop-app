import QtQuick
import Noted

// Move to list: search plus the lists, the current one ticked.
Picker {
    id: move
    property string noteId: ""
    property string currentListId: ""

    width: 248
    placeholder: "Move to…"
    rows: {
        const q = query.trim().toLowerCase()
        return AppState.lists.concat(AppState.hiddenLists)
            .filter(l => q === "" || l.name.toLowerCase().indexOf(q) >= 0)
            .map(l => ({ id: l.id, text: l.name, color: l.color || "gray", checked: l.id === move.currentListId }))
    }
    emptyText: query.trim() === "" ? "No lists yet." : "No list called “" + query.trim() + "”."
    onPicked: (row) => {
        close()
        if (row.id === currentListId) return
        Store.moveToList(noteId, row.id)
        AppState.refreshCurrent()
        AppState.toast("Moved to " + row.text)
    }
}
