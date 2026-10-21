import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Ctrl K: jump to a note. Recent notes when empty, title-and-text matches as
// you type, then "Search everywhere" (Ctrl Shift F) or, with no match,
// "Create a note called …". Start with ">" for commands.
Popup {
    id: find
    // In the window's own scene: clamped to it, closed by a press outside.
    popupType: Popup.Item

    signal importRequested()
    signal exportCurrentRequested(string format)

    parent: Overlay.overlay
    x: Math.round((parent.width - width) / 2)
    y: 96
    width: Math.min(560, parent.width - 32)
    height: col.implicitHeight
    modal: true
    focus: true
    padding: 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    property var rows: []        // [{ kind: note | all | create | cmd, title, meta, run }]
    property int current: 0
    readonly property string q: input.text.trim()
    readonly property bool commandMode: q.startsWith(">")

    Overlay.modal: Rectangle { color: Theme.c.scrim }
    enter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 100 } }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 80 } }

    background: Rectangle {
        radius: 12
        color: Theme.c.raised
        Shadow { anchors.fill: parent; radius: 12; kind: "modal" }
    }

    onOpened: { input.text = ""; rebuild(); input.forceActiveFocus() }
    onClosed: AppState.paletteOpen = false

    function metaOf(n) {
        const l = AppState.listById(n.list_id)
        return (l ? l.name : (n.is_daily ? "Daily notes" : "Notes")) + " · " + Fmt.edited(n.updated_at, AppState.now)
    }
    function commands() {
        const n = AppState.view === "note" ? AppState.currentNote : ({})
        const out = [
            { title: "New note", meta: "Ctrl N", run: () => AppState.newNote() },
            { title: "New plain-text note", meta: "Ctrl Shift N", run: () => AppState.newNote({ type: "plain" }) },
            { title: "Go to Today", meta: "Ctrl .", run: () => AppState.go("desk") },
            { title: "Go to To-dos", run: () => AppState.go("todos") },
            { title: "Go to Trash", run: () => AppState.go("trash") },
            { title: "Open file…", meta: "Ctrl O", run: () => find.importRequested() },
            { title: "Settings", meta: "Ctrl ,", run: () => AppState.openSettings() },
            { title: "Theme: Light", run: () => AppState.setTheme("light") },
            { title: "Theme: Dark", run: () => AppState.setTheme("dark") },
            { title: "Theme: Match Windows", run: () => AppState.setTheme("system") },
            { title: "Hide or show the sidebar", meta: "Ctrl \\", run: () => AppState.setSidebarCollapsed(!AppState.sidebarCollapsed) }
        ]
        if (n.id && !n.is_file) {
            out.push({ title: n.is_pinned ? "Unpin this note" : "Pin this note", run: () => Store.setPinned(n.id, !n.is_pinned) })
            out.push({ title: "Duplicate this note", run: () => AppState.duplicate(n.id) })
            out.push({ title: "Export this note as Markdown…", run: () => find.exportCurrentRequested("md") })
            out.push({ title: "Export this note as PDF…", run: () => find.exportCurrentRequested("pdf") })
            out.push({ title: "Move this note to trash", run: () => AppState.trashNote(n.id) })
        }
        for (const l of AppState.lists) out.push({ title: "Go to " + l.name, run: () => AppState.go("list", l.id) })
        return out.map(c => Object.assign({ kind: "cmd" }, c))
    }

    function rebuild() {
        const out = []
        if (commandMode) {
            const w = q.slice(1).trim().toLowerCase()
            for (const c of commands()) if (w === "" || c.title.toLowerCase().indexOf(w) >= 0) out.push(c)
        } else if (q === "") {
            for (const n of Store.recentEdited(6, true))
                out.push({ kind: "note", id: n.id, title: n.title || "Untitled", meta: metaOf(n) })
        } else {
            for (const n of Store.searchNotes(q, 7))
                out.push({ kind: "note", id: n.id, title: n.title || "Untitled", meta: metaOf(n), locked: n.is_locked })
            out.push({ kind: "all", title: "Search everywhere for “" + q + "”", meta: "Ctrl Shift F" })
            if (out.length === 1) out.push({ kind: "create", title: "Create a note called “" + q + "”", meta: "Enter" })
        }
        rows = out
        // With no match, Enter makes the note.
        current = out.length && out[out.length - 1].kind === "create" ? out.length - 1 : 0
    }

    function activate(i) {
        const r = rows[i]
        if (!r) return
        close()
        if (r.kind === "note") AppState.openNote(r.id)
        else if (r.kind === "all") AppState.openSearch(q)
        else if (r.kind === "create") AppState.newNote({ title: q })
        else if (r.run) r.run()
    }

    Timer { id: debounce; interval: 90; onTriggered: find.rebuild() }

    readonly property string sectionTitle: commandMode ? "Commands"
        : q === "" ? "Recent" : (rows.some(r => r.kind === "note") ? "Notes" : "Nothing matches “" + q + "”")

    contentItem: ColumnLayout {
        id: col
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 52
            Layout.leftMargin: 16
            Layout.rightMargin: 10
            spacing: 10
            Icon { name: "search"; size: 17; color: Theme.c.muted }
            Field {
                id: input
                Layout.fillWidth: true
                bare: true
                implicitHeight: 40
                font.pixelSize: 16
                placeholderText: "Find or jump to a note"
                onTextEdited: debounce.restart()
                Keys.onPressed: (e) => {
                    if (e.key === Qt.Key_Down) { find.current = Math.min(find.rows.length - 1, find.current + 1); e.accepted = true }
                    else if (e.key === Qt.Key_Up) { find.current = Math.max(0, find.current - 1); e.accepted = true }
                    else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter) {
                        if (debounce.running) { debounce.stop(); find.rebuild() }
                        find.activate(find.current)
                        e.accepted = true
                    }
                }
            }
            IconButton { size: 30; iconSize: 14; icon: "x"; tooltip: "Close"; onClicked: find.close() }
        }
        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Theme.c.menuLine }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.margins: 8
            Layout.bottomMargin: 10
            spacing: 0
            Text {
                textFormat: Text.PlainText
                Layout.leftMargin: 10
                Layout.topMargin: 6
                Layout.bottomMargin: 4
                text: find.sectionTitle
                color: Theme.c.tertiary
                font.pixelSize: 12
                font.weight: Font.Medium
            }
            Repeater {
                model: find.rows
                delegate: Rectangle {
                    id: row
                    required property var modelData
                    required property int index
                    readonly property bool special: modelData.kind === "all" || modelData.kind === "create"
                    Layout.fillWidth: true
                    Layout.topMargin: modelData.kind === "all" ? 4 : 0
                    Layout.preferredHeight: 38
                    radius: 7
                    color: index === find.current ? Theme.c.pressed : (rowArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.5) : "transparent")
                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 10
                        anchors.rightMargin: 10
                        spacing: 12
                        Icon {
                            visible: row.special
                            name: row.modelData.kind === "create" ? "plus" : "search"
                            size: 15
                            color: Theme.c.secondary
                        }
                        Text {
                            textFormat: Text.PlainText
                            Layout.fillWidth: true
                            text: row.modelData.title
                            color: Theme.c.ink
                            font.pixelSize: 14
                            elide: Text.ElideRight
                        }
                        Icon { visible: !!row.modelData.locked; name: "lock"; size: 12; color: Theme.c.muted }
                        Text {
                            textFormat: Text.PlainText
                            visible: !!row.modelData.meta
                            text: row.modelData.meta || ""
                            color: Theme.c.muted
                            font.pointSize: Theme.pt(12.5)
                        }
                    }
                    MouseArea {
                        id: rowArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onEntered: find.current = row.index
                        onClicked: find.activate(row.index)
                    }
                }
            }
            Text {
                textFormat: Text.PlainText
                visible: find.rows.some(r => r.kind === "create")
                Layout.fillWidth: true
                Layout.leftMargin: 10
                Layout.rightMargin: 10
                Layout.topMargin: 8
                text: "Searches titles and text in every list. Locked notes are found by title only."
                color: Theme.c.muted
                font.pointSize: Theme.pt(12.5)
                wrapMode: Text.Wrap
            }
            Text {
                textFormat: Text.PlainText
                visible: find.q === ""
                Layout.leftMargin: 10
                Layout.topMargin: 8
                text: "Type > for commands"
                color: Theme.c.faint
                font.pixelSize: 12
            }
        }
    }
}
