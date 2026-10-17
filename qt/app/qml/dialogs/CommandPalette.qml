import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// Ctrl+P / Ctrl+Shift+F: search every note and run any command.
Popup {
    id: cmdp

    signal importRequested()
    signal exportCurrentRequested(string format)

    parent: Overlay.overlay
    x: (parent.width - width) / 2
    y: parent.height * 0.14
    width: Math.min(600, parent.width - 48)
    height: Math.min(460, col.implicitHeight + 2)
    modal: true
    focus: true
    padding: 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    property var results: []
    property int current: 0

    Overlay.modal: Rectangle { color: Theme.c.scrim }
    enter: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 100 }
        NumberAnimation { property: "scale"; from: 0.98; to: 1; duration: 140; easing.type: Easing.OutCubic }
    }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 80 } }

    background: Rectangle {
        radius: Theme.radiusXl
        color: Theme.c.raised
        border.color: Theme.c.border
    }

    onOpened: { input.text = ""; rebuild(); input.forceActiveFocus() }
    onClosed: AppState.paletteOpen = false

    function commands() {
        const cmds = [
            { kind: "cmd", icon: "square-pen", title: "New note", hint: "Ctrl+N", run: () => AppState.newNote() },
            { kind: "cmd", icon: "type", title: "New plain-text note", run: () => AppState.newNote({ type: "plain" }) },
            { kind: "cmd", icon: "calendar", title: "Go to Today", hint: "Ctrl+.", run: () => AppState.go("desk") },
            { kind: "cmd", icon: "square-check", title: "Go to To-dos", run: () => AppState.setView("todos") },
            { kind: "cmd", icon: "trash-2", title: "Go to Trash", run: () => AppState.setView("trash") },
            { kind: "cmd", icon: "folder-open", title: "Open file…", hint: "Ctrl+O", keywords: "import markdown md txt", run: () => cmdp.importRequested() },
            { kind: "cmd", icon: "settings", title: "Settings", hint: "Ctrl+,", run: () => AppState.openSettings() },
            { kind: "cmd", icon: "sun", title: "Theme: Light", run: () => AppState.setTheme("light") },
            { kind: "cmd", icon: "moon", title: "Theme: Dark", run: () => AppState.setTheme("dark") },
            { kind: "cmd", icon: "monitor", title: "Theme: Match Windows", run: () => AppState.setTheme("system") },
            { kind: "cmd", icon: "panel-left", title: "Toggle sidebar", hint: "Ctrl+\\", run: () => AppState.setSidebarCollapsed(!AppState.sidebarCollapsed) },
            { kind: "cmd", icon: "maximize-2", title: "Toggle focus mode", hint: "F11", run: () => AppState.focusMode = !AppState.focusMode }
        ]
        if (AppState.currentNote.id) {
            const id = AppState.currentNote.id
            cmds.push({ kind: "cmd", icon: "pin", title: AppState.currentNote.is_pinned ? "Unpin this note" : "Pin this note", run: () => Store.setPinned(id, !AppState.currentNote.is_pinned) })
            cmds.push({ kind: "cmd", icon: "lock", title: AppState.currentNote.is_locked ? "Unlock this note" : "Lock this note", run: () => AppState.toggleLock(id) })
            cmds.push({ kind: "cmd", icon: "copy", title: "Duplicate this note", run: () => AppState.duplicate(id) })
            cmds.push({ kind: "cmd", icon: "download", title: "Export note as Markdown", run: () => cmdp.exportCurrentRequested("md") })
            cmds.push({ kind: "cmd", icon: "download", title: "Export note as PDF", run: () => cmdp.exportCurrentRequested("pdf") })
            cmds.push({ kind: "cmd", icon: "trash-2", title: "Delete this note", run: () => AppState.trashNote(id) })
        }
        for (const l of AppState.lists)
            cmds.push({ kind: "cmd", icon: "folder", title: "Go to list: " + l.name, run: () => AppState.setView("list", l.id) })
        for (const t of AppState.tags)
            cmds.push({ kind: "cmd", icon: "hash", title: "Go to tag: " + t.name, run: () => AppState.setView("tag", t.id) })
        return cmds
    }

    function fuzzy(hay, needle) {
        hay = hay.toLowerCase()
        let i = 0
        for (const ch of needle.toLowerCase()) {
            i = hay.indexOf(ch, i)
            if (i < 0) return false
            ++i
        }
        return true
    }

    function rebuild() {
        const q = input.text.trim()
        const out = []
        if (q === "") {
            for (const n of Store.recentNotes(8))
                out.push({ kind: "note", icon: n.note_type === "plain" ? "type" : "file-text", title: n.title, sub: Dates.relative(n.updated_at), id: n.id, section: "Recent" })
            const cmds = commands().slice(0, 7)
            for (const c of cmds) { c.section = "Commands"; out.push(c) }
        } else {
            const hits = Store.search(q, 40)
            for (const h of hits)
                out.push({ kind: "note", icon: h.is_locked ? "lock" : (h.note_type === "plain" ? "type" : "file-text"), title: h.title,
                           snippet: h.is_locked ? "Locked" : h.snippet, id: h.note_id, sub: Dates.relative(h.updated_at), section: "Notes" })
            for (const c of commands())
                if (fuzzy(c.title + " " + (c.keywords || ""), q)) { c.section = "Commands"; out.push(c) }
            out.push({ kind: "create", icon: "plus", title: "Create note “" + q + "”", section: "", run: () => {
                const id = AppState.newNote()
                Store.updateNote(id, { title: q })
                AppState.refreshCurrent()
            } })
        }
        let last = null
        for (const r of out) { r.header = r.section && r.section !== last ? r.section : ""; last = r.section }
        results = out
        current = 0
    }

    function activate(i) {
        const r = results[i]
        if (!r) return
        close()
        if (r.kind === "note") AppState.openNote(r.id)
        else if (r.run) r.run()
    }

    function snippetHtml(s) {
        if (!s) return ""
        const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, " ")
        return esc.replace(/\u0001/g, "<b><font color='" + Theme.c.accentText + "'>").replace(/\u0002/g, "</font></b>")
    }

    Timer { id: debounce; interval: 110; onTriggered: cmdp.rebuild() }

    contentItem: ColumnLayout {
        id: col
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 52
            Layout.leftMargin: 16
            Layout.rightMargin: 12
            spacing: 10
            Icon { name: "search"; size: 17; color: Theme.c.subtle }
            TextInput {
                id: input
                Layout.fillWidth: true
                color: Theme.c.text
                font.pixelSize: 16
                selectByMouse: true
                clip: true
                onTextChanged: debounce.restart()
                Text { visible: input.length === 0; text: "Search notes or type a command…"; color: Theme.c.faint; font: input.font }
                Keys.onPressed: (e) => {
                    if (e.key === Qt.Key_Down) { cmdp.current = Math.min(cmdp.results.length - 1, cmdp.current + 1); list.positionViewAtIndex(cmdp.current, ListView.Contain); e.accepted = true }
                    else if (e.key === Qt.Key_Up) { cmdp.current = Math.max(0, cmdp.current - 1); list.positionViewAtIndex(cmdp.current, ListView.Contain); e.accepted = true }
                    else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter) { debounce.stop(); if (input.text.trim() !== "" && cmdp.results.length === 0) cmdp.rebuild(); cmdp.activate(cmdp.current); e.accepted = true }
                }
            }
            Kbd { text: "Esc" }
        }
        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Theme.c.divider }

        ListView {
            id: list
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(contentHeight, 360)
            Layout.topMargin: 6
            Layout.bottomMargin: 6
            clip: true
            model: cmdp.results
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBarThin {}
            delegate: Rectangle {
                id: item
                required property var modelData
                required property int index
                width: ListView.view.width - 12
                x: 6
                readonly property real headerH: modelData.header ? 26 : 0
                height: (modelData.snippet ? 54 : 38) + headerH
                radius: Theme.radiusLg
                color: "transparent"
                Text {
                    visible: item.headerH > 0
                    height: item.headerH
                    leftPadding: 12
                    verticalAlignment: Text.AlignBottom
                    bottomPadding: 4
                    text: item.modelData.header || ""
                    color: Theme.c.subtle
                    font.pixelSize: 12
                    font.weight: Font.Medium
                }
                Rectangle {
                    anchors.fill: parent
                    anchors.topMargin: item.headerH
                    radius: Theme.radiusLg
                    color: item.index === cmdp.current ? Theme.c.accentSubtle : (itemArea.containsMouse ? Theme.c.hover : "transparent")
                }
                RowLayout {
                    anchors.fill: parent
                    anchors.topMargin: item.headerH
                    anchors.leftMargin: 12
                    anchors.rightMargin: 12
                    spacing: 10
                    Icon { name: item.modelData.icon; size: 15; color: item.index === cmdp.current ? Theme.c.accentText : Theme.c.subtle; Layout.alignment: item.modelData.snippet ? Qt.AlignTop : Qt.AlignVCenter; Layout.topMargin: item.modelData.snippet ? 11 : 0 }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Text {
                            Layout.fillWidth: true
                            text: item.modelData.title || "Untitled"
                            color: Theme.c.text
                            font.pixelSize: Theme.fontMd + 1
                            font.weight: item.modelData.kind === "note" ? Font.Medium : Font.Normal
                            elide: Text.ElideRight
                        }
                        Text {
                            visible: !!item.modelData.snippet
                            Layout.fillWidth: true
                            text: cmdp.snippetHtml(item.modelData.snippet)
                            textFormat: Text.StyledText
                            color: Theme.c.muted
                            font.pixelSize: Theme.fontSm
                            elide: Text.ElideRight
                            maximumLineCount: 1
                        }
                    }
                    Text { visible: !!item.modelData.sub; text: item.modelData.sub || ""; color: Theme.c.faint; font.pixelSize: Theme.fontSm }
                    Text { visible: !!item.modelData.hint; text: item.modelData.hint || ""; color: Theme.c.subtle; font.pixelSize: Theme.fontXs; font.family: Theme.monoFamily }
                }
                MouseArea {
                    id: itemArea
                    anchors.fill: parent
                    anchors.topMargin: item.headerH
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: cmdp.activate(item.index)
                }
            }
        }

        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Theme.c.divider }
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 34
            Layout.leftMargin: 16
            Layout.rightMargin: 16
            spacing: 14
            Row { spacing: 5; Kbd { text: "↑↓" } Text { text: "navigate"; color: Theme.c.subtle; font.pixelSize: Theme.fontXs; anchors.verticalCenter: parent.verticalCenter } }
            Row { spacing: 5; Kbd { text: "Enter" } Text { text: "open"; color: Theme.c.subtle; font.pixelSize: Theme.fontXs; anchors.verticalCenter: parent.verticalCenter } }
            Item { Layout.fillWidth: true }
            Text { text: cmdp.results.filter(r => r.kind === "note").length + " notes"; color: Theme.c.faint; font.pixelSize: Theme.fontXs }
        }
    }
}
