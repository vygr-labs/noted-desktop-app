import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Left navigation: wordmark, Find, Today and To-dos, then Pinned, the Lists
// tree (each list opens to its notes) and open Files, with New note and
// Settings at the bottom. Right-click a row for its menu.
Rectangle {
    id: side

    signal openFileRequested()
    signal popoutRequested(string noteId)

    width: 256
    color: Theme.c.sidebar

    Rectangle {
        anchors.right: parent.right
        width: 1
        height: parent.height
        color: Theme.c.line
        z: 2
    }

    PopupMenu { id: menu }

    // The notes shown under each open list, refreshed with the store.
    property var pinned: []
    property var listNotes: ({})
    function reload() {
        pinned = Store.pinnedNotes()
        const m = {}
        for (const id in AppState.expandedLists)
            if (AppState.expandedLists[id]) m[id] = Store.notesInList(id, "updated_at")
        listNotes = m
    }
    Component.onCompleted: reload()
    Connections {
        target: Store
        function onNotesChanged() { reloadLater.restart() }
        function onListsChanged() { reloadLater.restart() }
        function onLockStateChanged() { side.reload() }
    }
    Connections {
        target: AppState
        function onExpandedListsChanged() { side.reload() }
        function onNewListRequested() { newListDialog.openFor() }
    }
    Timer { id: reloadLater; interval: 150; onTriggered: side.reload() }

    // ── one row ──────────────────────────────────────────────────────
    component Row_: Rectangle {
        id: row
        property string icon: ""
        property color iconColor: Theme.c.muted
        property real iconSize: 16
        property string label: ""
        property string countText: ""
        property bool active: false
        property bool locked: false
        property bool nested: false
        property real leftPad: 10
        property string tooltip: ""
        readonly property bool ringed: menu.opened && menu.owner === row
        signal clicked()
        signal contextRequested(real x, real y)

        Layout.fillWidth: true
        Layout.preferredHeight: nested ? 30 : 32
        radius: 6
        color: active ? Theme.c.selected : (area.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
        border.width: ringed ? 1.5 : 0
        border.color: Theme.c.accent

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: row.leftPad
            anchors.rightMargin: 10
            spacing: 10
            Icon {
                visible: row.icon !== ""
                name: row.icon
                size: row.iconSize
                color: row.iconColor
            }
            Text {
                textFormat: Text.PlainText
                Layout.fillWidth: !row.locked
                Layout.maximumWidth: row.locked ? row.width - row.leftPad - 40 : -1
                text: row.label
                color: row.active ? Theme.c.ink : Theme.c.text
                font.pointSize: Theme.pt(row.nested ? 13.5 : 14)
                font.weight: row.active ? Font.Medium : Font.Normal
                elide: Text.ElideRight
            }
            Icon {
                visible: row.locked
                name: "lock"
                size: 11
                color: Theme.c.muted
            }
            Item { visible: row.locked; Layout.fillWidth: true }
            Text {
                textFormat: Text.PlainText
                visible: row.countText !== ""
                text: row.countText
                color: Theme.c.muted
                font.pointSize: Theme.pt(12.5)
                font.features: { "tnum": 1 }
            }
        }
        MouseArea {
            id: area
            anchors.fill: parent
            hoverEnabled: true
            acceptedButtons: Qt.LeftButton | Qt.RightButton
            cursorShape: Qt.PointingHandCursor
            onClicked: (e) => e.button === Qt.RightButton ? row.contextRequested(e.x, e.y) : row.clicked()
        }
        Tip { visible: row.tooltip !== "" && area.containsMouse; text: row.tooltip }
    }

    component GroupLabel: RowLayout {
        id: gl
        property string label: ""
        property string addTip: ""
        signal addClicked()
        Layout.fillWidth: true
        Layout.topMargin: 20
        Layout.bottomMargin: 6
        Layout.leftMargin: 10
        Layout.rightMargin: 4
        Layout.preferredHeight: 24
        spacing: 0
        Text {
            textFormat: Text.PlainText
            Layout.fillWidth: true
            text: gl.label
            color: Theme.c.tertiary
            font.pixelSize: 12
            font.weight: Font.Medium
        }
        IconButton {
            visible: gl.addTip !== ""
            size: 24
            iconSize: 14
            icon: "plus"
            iconColor: Theme.c.tertiary
            tooltip: gl.addTip
            onClicked: gl.addClicked()
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.rightMargin: 1
        spacing: 0

        // ── wordmark row (drags the window) ──────────────────────────────
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 44
            DragArea { anchors.fill: parent }
            Text {
                textFormat: Text.PlainText
                x: 18
                anchors.verticalCenter: parent.verticalCenter
                text: "noted"
                color: Theme.c.ink
                font.pixelSize: 15
                font.weight: 650
                font.letterSpacing: -0.15
            }
            IconButton {
                anchors.right: parent.right
                anchors.rightMargin: 10
                anchors.verticalCenter: parent.verticalCenter
                size: 30
                iconSize: 17
                icon: "panel-left"
                tooltip: "Hide sidebar"
                shortcut: "Ctrl+\\"
                onClicked: AppState.setSidebarCollapsed(true)
            }
        }

        // ── find ─────────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            Layout.leftMargin: 10
            Layout.rightMargin: 10
            Layout.topMargin: 4
            Layout.bottomMargin: 10
            Layout.preferredHeight: 34
            radius: 7
            color: findArea.containsMouse ? Theme.mix(Theme.c.field, Theme.c.pressed, 0.4) : Theme.c.field
            border.color: Theme.c.lineStrong
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 10
                anchors.rightMargin: 10
                spacing: 8
                Icon { name: "search"; size: 15; color: Theme.c.muted }
                Text { textFormat: Text.PlainText; Layout.fillWidth: true; text: "Find a note"; color: Theme.c.muted; font.pointSize: Theme.pt(13.5) }
                Text { textFormat: Text.PlainText; text: "Ctrl K"; color: Theme.c.muted; font.pixelSize: 12 }
            }
            MouseArea {
                id: findArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: AppState.paletteOpen = true
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.leftMargin: 10
            Layout.rightMargin: 10
            spacing: 1
            Row_ {
                icon: "calendar"
                iconColor: active ? Theme.c.ink : Theme.c.secondary
                label: "Today"
                active: AppState.view === "desk"
                onClicked: AppState.go("desk")
            }
            Row_ {
                icon: "circle-check"
                iconColor: active ? Theme.c.ink : Theme.c.secondary
                label: "To-dos"
                countText: AppState.openTaskCount > 0 ? String(AppState.openTaskCount) : ""
                active: AppState.view === "todos"
                onClicked: AppState.go("todos")
            }
        }

        // ── pinned, lists, files ─────────────────────────────────────────
        Flickable {
            id: scroller
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentHeight: tree.implicitHeight + 30
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBarThin {}

            ColumnLayout {
                id: tree
                x: 10
                y: 18
                width: scroller.width - 20
                spacing: 1

                Text {
                    textFormat: Text.PlainText
                    visible: side.pinned.length > 0
                    Layout.leftMargin: 10
                    Layout.bottomMargin: 6
                    text: "Pinned"
                    color: Theme.c.tertiary
                    font.pixelSize: 12
                    font.weight: Font.Medium
                }
                Repeater {
                    model: side.pinned
                    delegate: Row_ {
                        required property var modelData
                        icon: "pin"
                        iconSize: 15
                        label: modelData.title || "Untitled"
                        locked: AppState.isLocked(modelData)
                        active: AppState.view === "note" && AppState.selectedNoteId === modelData.id
                        onClicked: AppState.openNote(modelData.id)
                        onContextRequested: (x, y) => side.noteMenu(this, x, y, modelData)
                    }
                }

                GroupLabel {
                    Layout.topMargin: side.pinned.length > 0 ? 20 : 0
                    label: "Lists"
                    addTip: "New list"
                    onAddClicked: newListDialog.openFor()
                }
                Text {
                    textFormat: Text.PlainText
                    visible: AppState.lists.length === 0
                    Layout.leftMargin: 10
                    Layout.topMargin: 2
                    text: "No lists yet"
                    color: Theme.c.muted
                    font.pointSize: Theme.pt(13.5)
                }
                Repeater {
                    model: AppState.lists
                    delegate: ColumnLayout {
                        id: listItem
                        required property var modelData
                        readonly property bool expanded: !!AppState.expandedLists[modelData.id]
                        Layout.fillWidth: true
                        spacing: 1

                        Row_ {
                            id: listRow
                            leftPad: 28
                            icon: "folder"
                            iconColor: Theme.swatch(listItem.modelData.color)
                            label: listItem.modelData.name
                            countText: String(listItem.modelData.note_count || 0)
                            active: AppState.view === "list" && AppState.viewId === listItem.modelData.id
                            onClicked: AppState.go("list", listItem.modelData.id)
                            onContextRequested: (x, y) => side.listMenu(this, x, y, listItem.modelData, listItem.expanded)

                            // Chevron: open/close the list in the tree.
                            Item {
                                x: 2
                                width: 24
                                height: parent.height
                                Icon {
                                    anchors.centerIn: parent
                                    name: "chevron-right"
                                    size: 13
                                    color: Theme.c.muted
                                    rotation: listItem.expanded ? 90 : 0
                                    Behavior on rotation { NumberAnimation { duration: Theme.fast } }
                                }
                                MouseArea {
                                    anchors.fill: parent
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: AppState.setListExpanded(listItem.modelData.id, !listItem.expanded)
                                }
                            }
                        }
                        ColumnLayout {
                            visible: listItem.expanded
                            Layout.fillWidth: true
                            Layout.topMargin: 1
                            Layout.bottomMargin: 4
                            spacing: 1
                            Repeater {
                                model: listItem.expanded ? (side.listNotes[listItem.modelData.id] || []) : []
                                delegate: Row_ {
                                    required property var modelData
                                    nested: true
                                    leftPad: 50
                                    label: modelData.title || "Untitled"
                                    locked: AppState.isLocked(modelData)
                                    active: AppState.view === "note" && AppState.selectedNoteId === modelData.id
                                    onClicked: AppState.openNote(modelData.id)
                                    onContextRequested: (x, y) => side.noteMenu(this, x, y, modelData)
                                }
                            }
                        }
                    }
                }

                // Hidden lists fold into one quiet row.
                Row_ {
                    visible: AppState.hiddenLists.length > 0
                    leftPad: 28
                    label: Fmt.plural(AppState.hiddenLists.length, "hidden list")
                    onClicked: hiddenColumn.visible = !hiddenColumn.visible
                }
                ColumnLayout {
                    id: hiddenColumn
                    visible: false
                    Layout.fillWidth: true
                    spacing: 1
                    Repeater {
                        model: AppState.hiddenLists
                        delegate: Row_ {
                            required property var modelData
                            leftPad: 28
                            icon: "folder"
                            iconColor: Qt.alpha(Theme.swatch(modelData.color), 0.6)
                            label: modelData.name
                            countText: String(modelData.note_count || 0)
                            active: AppState.view === "list" && AppState.viewId === modelData.id
                            onClicked: AppState.go("list", modelData.id)
                            onContextRequested: (x, y) => side.listMenu(this, x, y, modelData, false, true)
                        }
                    }
                }

                // Files opened from disk; only while one is open.
                GroupLabel {
                    visible: Files.files.length > 0
                    label: "Files"
                    addTip: "Open a file"
                    onAddClicked: side.openFileRequested()
                }
                Repeater {
                    model: Files.files
                    delegate: Row_ {
                        required property var modelData
                        required property int index
                        icon: "file"
                        iconSize: 15
                        // Two open files with one name get their folder added.
                        label: {
                            const same = Files.files.filter(f => f.name === modelData.name).length > 1
                            if (!same) return modelData.name
                            const parts = modelData.path.split(/[\\/]/)
                            return modelData.name + "  ·  " + (parts[parts.length - 2] || "")
                        }
                        tooltip: modelData.path
                        active: AppState.view === "note" && AppState.selectedNoteId === modelData.id
                        onClicked: AppState.openNote(modelData.id)
                        onContextRequested: (x, y) => menu.openAt(this, x, y, [
                            { text: "Open", action: () => AppState.openNote(modelData.id) },
                            { text: "Show in folder", action: () => App.revealFile(modelData.path) },
                            { text: "Copy into notes", action: () => AppState.copyFileToNotes(modelData.id) },
                            { separator: true },
                            { text: "Close file", action: () => AppState.closeFile(modelData.id) }
                        ])
                    }
                }
            }
        }

        // ── dev-data note ────────────────────────────────────────────────
        Text {
            textFormat: Text.PlainText
            visible: App.devData
            Layout.leftMargin: 20
            Layout.bottomMargin: 6
            text: "Dev copy of your notes"
            color: Theme.c.muted
            font.pixelSize: 12
            MouseArea { id: devArea; anchors.fill: parent; hoverEnabled: true }
            Tip { visible: devArea.containsMouse; text: "This build is using " + App.dataPath }
        }

        // ── footer ───────────────────────────────────────────────────────
        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Theme.c.line }
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: 10
            spacing: 4
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 34
                radius: 6
                color: newArea.pressed ? Theme.c.pressed : (newArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 10
                    spacing: 10
                    Icon { name: "plus"; size: 16; color: Theme.c.text }
                    Text { textFormat: Text.PlainText; Layout.fillWidth: true; text: "New note"; color: Theme.c.text; font.pixelSize: 14 }
                }
                MouseArea {
                    id: newArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: AppState.newNote()
                }
                Tip { visible: newArea.containsMouse; text: "New note"; shortcut: "Ctrl+N" }
            }
            IconButton {
                size: 34
                iconSize: 17
                icon: "sliders-horizontal"
                checked: AppState.view === "settings"
                tooltip: "Settings"
                shortcut: "Ctrl+,"
                onClicked: AppState.openSettings()
            }
        }
    }

    // ── menus ────────────────────────────────────────────────────────
    function moveTargets(note) {
        return AppState.lists.map(l => ({
            text: l.name, color: l.color || "gray", checked: note.list_id === l.id,
            action: () => { Store.moveToList(note.id, l.id); AppState.refreshCurrent() }
        }))
    }
    function noteMenu(item, x, y, note) {
        const locked = AppState.isLocked(note)
        menu.openAt(item, x, y, [
            { text: "Open", action: () => AppState.openNote(note.id) },
            { text: "Open in new window", action: () => side.popoutRequested(note.id) },
            { text: note.is_pinned ? "Unpin" : "Pin", action: () => Store.setPinned(note.id, !note.is_pinned) },
            { text: "Move to", children: moveTargets(note) },
            { text: "Copy as Markdown", disabled: locked, action: () => { if (App.copyAsMarkdown(note.id)) AppState.toast("Copied as Markdown") } },
            { text: "Duplicate", disabled: locked, action: () => AppState.duplicate(note.id) },
            { separator: true },
            { text: "Move to trash", danger: true, action: () => AppState.trashNote(note.id) }
        ])
    }
    function listMenu(item, x, y, list, expanded, hidden) {
        const colours = Theme.pickerSwatches.concat(
            Theme.pickerSwatches.some(s => s.name === list.color) ? [] : [{ name: list.color, label: list.color.charAt(0).toUpperCase() + list.color.slice(1) }])
        menu.openAt(item, x, y, [
            { text: "New note in " + list.name, action: () => AppState.newNote({ listId: list.id }) },
            hidden ? { text: "Show in sidebar", action: () => Store.setListHidden(list.id, false) }
                   : { text: expanded ? "Collapse" : "Expand", action: () => AppState.setListExpanded(list.id, !expanded) },
            { text: "Rename…", action: () => renameDialog.openFor(list) },
            { text: "Change colour", children: colours.map(s => ({
                text: s.label, color: s.name, checked: list.color === s.name,
                action: () => Store.updateList(list.id, { color: s.name })
            })) },
            { separator: true },
            { text: "Delete list…", danger: true, action: () => deleteDialog.openFor(list) }
        ])
    }

    ModalDialog {
        id: newListDialog
        title: "New list"
        function openFor() { newListField.text = ""; open(); newListField.forceActiveFocus() }
        Field {
            id: newListField
            Layout.fillWidth: true
            placeholderText: "Work, Church, Reading…"
            onAccepted: newListDialog.commit()
        }
        function commit() {
            const name = newListField.text.trim()
            close()
            if (name === "") return
            const l = Store.createList(name, "folder", Theme.pickerSwatches[AppState.lists.length % 7].name)
            AppState.go("list", l.id)
        }
        footer: [
            TextButton { text: "Cancel"; onClicked: newListDialog.close() },
            TextButton { text: "Make list"; onClicked: newListDialog.commit() }
        ]
    }

    ModalDialog {
        id: renameDialog
        property var list: ({})
        title: "Rename list"
        function openFor(l) { list = l; renameField.text = l.name; open(); renameField.selectAll(); renameField.forceActiveFocus() }
        Field {
            id: renameField
            Layout.fillWidth: true
            onAccepted: renameDialog.commit()
        }
        function commit() {
            if (renameField.text.trim() !== "") Store.updateList(list.id, { name: renameField.text.trim() })
            close()
        }
        footer: [
            TextButton { text: "Cancel"; onClicked: renameDialog.close() },
            TextButton { text: "Rename"; onClicked: renameDialog.commit() }
        ]
    }

    ModalDialog {
        id: deleteDialog
        property var list: ({})
        title: "Delete “" + (list.name || "") + "”?"
        description: "Its notes move to the trash. You can restore them from there."
        function openFor(l) { list = l; open() }
        footer: [
            TextButton { text: "Cancel"; onClicked: deleteDialog.close() },
            TextButton {
                text: "Delete list"
                variant: "destructive"
                onClicked: {
                    const id = deleteDialog.list.id
                    deleteDialog.close()
                    if (AppState.view === "list" && AppState.viewId === id) AppState.go("desk")
                    Store.deleteList(id)
                }
            }
        ]
    }
}
