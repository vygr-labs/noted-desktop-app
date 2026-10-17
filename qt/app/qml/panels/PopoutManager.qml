import QtQuick
import Noted

// Opens floating pop-out windows (one per note / todo list).
QtObject {
    id: mgr
    property var open: ({})

    property Component windowComponent: Component { PopoutWindow {} }

    function show(key, props) {
        const existing = open[key]
        if (existing) { existing.show(); existing.raise(); existing.requestActivate(); return }
        const w = windowComponent.createObject(null, props)
        const o = Object.assign({}, open)
        o[key] = w
        open = o
        w.closing.connect(() => {
            const n = Object.assign({}, mgr.open)
            delete n[key]
            mgr.open = n
            w.destroy()
        })
        w.show()
    }

    function openNote(id) { show("note:" + id, { mode: "note", noteId: id }) }
}
