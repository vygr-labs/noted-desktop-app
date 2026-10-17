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

    // The notes shown under each open list, refreshed with the store. A long
    // list shows its latest few, and more a page at a time.
    property var pinned: []
    property var listNotes: ({})
    readonly property int treeLimit: 8
    property var listLimits: ({})     // list id -> notes shown, while more than treeLimit
    function limitFor(id) { return listLimits[id] || treeLimit }
    function setLimit(id, n) {
        const m = Object.assign({}, listLimits)
        if (n <= treeLimit) delete m[id]
        else m[id] = n
        listLimits = m
        reload()
    }
    function reload() {
        pinned = Store.pinnedNotes()
        const m = {}
        for (const id in AppState.expandedLists)
            if (AppState.expandedLists[id]) m[id] = Store.treeNotes(id, limitFor(id))
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
        // [view, id, note]: middle- or Ctrl-click opens it in a new tab.
        property var tabPlace: null
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
            acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
            cursorShape: Qt.PointingHandCursor
            onClicked: (e) => {
                if (e.button === Qt.RightButton) row.contextRequested(e.x, e.y)
                else if (row.tabPlace && (e.button === Qt.MiddleButton || (e.modifiers & Qt.ControlModifier)))
                    AppState.openInNewTab(row.tabPlace[0], row.tabPlace[1], row.tabPlace[2])
                else if (e.button === Qt.LeftButton) row.clicked()
            }
        }
        Tip { visible: row.tooltip !== "" && area.containsMouse; text: row.tooltip }
    }

    // A list's row in the tree, with the chevron that opens it there.
    component ListRow: Row_ {
        id: lr
        property var list: ({})
        property bool expanded: false
        leftPad: 28
        icon: "folder"
        iconColor: Theme.swatch(list.color)
        label: list.name || ""
        countText: String(list.note_count || 0)
        active: AppState.view === "list" && AppState.viewId === list.id
        tabPlace: ["list", list.id, ""]
        onClicked: AppState.go("list", list.id)
        onContextRequested: (x, y) => side.listMenu(this, x, y, list, expanded)
        Item {
            x: 2
            width: 24
            height: parent.height
            Icon {
                anchors.centerIn: parent
                name: "chevron-right"
                size: 13
                color: Theme.c.muted
                rotation: lr.expanded ? 90 : 0
                Behavior on rotation { NumberAnimation { duration: Theme.fast } }
            }
            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: side.toggleList(lr.list.id, !lr.expanded)
            }
        }
    }
    property Item stuck: null
    property real stuckShift: 0
    function updateStuck() {
        const top = scroller.contentY - tree.y
        for (let i = 0; i < listRepeater.count; ++i) {
            const it = listRepeater.itemAt(i)
            if (!it || !it.expanded || it.y >= top) continue
            if (it.y + it.height > top + 32) {
                stuck = it
                stuckShift = Math.min(0, it.y + it.height - 4 - (top + 34))
                return
            }
        }
        stuck = null
        stuckShift = 0
    }
    function scrollTree(y) { scroller.contentY = Math.max(0, Math.min(y, scroller.contentHeight - scroller.height)) }
    function toggleList(id, open) {
        // Closing a list from its pinned header: bring its row back into view.
        if (!open && stuck && stuck.modelData.id === id) scroller.contentY = Math.max(0, tree.y + stuck.y - 2)
        AppState.setListExpanded(id, open)
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
                x: 18
                anchors.verticalCenter: parent.verticalCenter
                textFormat: Text.StyledText
                text: "noted<font color=\"" + Theme.accent + "\">.</font>"
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
                tabPlace: ["desk", "", ""]
                onClicked: AppState.go("desk")
            }
            Row_ {
                icon: "circle-check"
                iconColor: active ? Theme.c.ink : Theme.c.secondary
                label: "To-dos"
                countText: AppState.openTaskCount > 0 ? String(AppState.openTaskCount) : ""
                active: AppState.view === "todos"
                tabPlace: ["todos", "", ""]
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
            onContentYChanged: side.updateStuck()
            onContentHeightChanged: side.updateStuck()

            // An open list's row stays at the top while you scroll through its
            // notes, and is pushed off by the end of the list.
            Rectangle {
                visible: side.stuck !== null
                z: 3
                y: scroller.contentY + side.stuckShift
                width: scroller.width
                height: 34
                color: Theme.c.sidebar
                ListRow {
                    x: 10
                    y: 1
                    width: parent.width - 20
                    height: 32
                    list: side.stuck ? side.stuck.modelData : ({})
                    expanded: true
                }
                Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.c.lineFaint }
            }

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
                        tabPlace: ["note", "", modelData.id]
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
                    id: listRepeater
                    model: AppState.lists
                    delegate: ColumnLayout {
                        id: listItem
                        required property var modelData
                        readonly property bool expanded: !!AppState.expandedLists[modelData.id]
                        readonly property var notes: expanded ? (side.listNotes[modelData.id] || []) : []
                        readonly property int limit: side.limitFor(modelData.id)
                        readonly property int total: modelData.note_count || 0
                        Layout.fillWidth: true
                        spacing: 1

                        ListRow {
                            list: listItem.modelData
                            expanded: listItem.expanded
                        }
                        ColumnLayout {
                            visible: listItem.expanded
                            Layout.fillWidth: true
                            Layout.topMargin: 1
                            Layout.bottomMargin: 4
                            spacing: 1
                            Repeater {
                                model: listItem.notes.slice(0, listItem.limit)
                                delegate: Row_ {
                                    required property var modelData
                                    nested: true
                                    leftPad: 50
                                    label: modelData.title || "Untitled"
                                    locked: AppState.isLocked(modelData)
                                    active: AppState.view === "note" && AppState.selectedNoteId === modelData.id
                                    tabPlace: ["note", "", modelData.id]
                                    onClicked: AppState.openNote(modelData.id)
                                    onContextRequested: (x, y) => side.noteMenu(this, x, y, modelData)
                                }
                            }
                            // More (or fewer) of a long list.
                            Row_ {
                                readonly property int rest: listItem.total - listItem.limit
                                visible: listItem.total > side.treeLimit
                                nested: true
                                leftPad: 50
                                label: rest > 0 ? "Show more" : "Show fewer"
                                countText: rest > 0 ? String(rest) : ""
                                onClicked: {
                                    if (rest > 0) side.setLimit(listItem.modelData.id, listItem.limit + 20)
                                    else {
                                        side.setLimit(listItem.modelData.id, side.treeLimit)
                                        if (scroller.contentY > tree.y + listItem.y) scroller.contentY = Math.max(0, tree.y + listItem.y - 2)
                                    }
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
                            tabPlace: ["list", modelData.id, ""]
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
                        tabPlace: ["note", "", modelData.id]
                        onClicked: AppState.openNote(modelData.id)
                        onContextRequested: (x, y) => menu.openAt(this, x, y, [
                            { text: "Open", action: () => AppState.openNote(modelData.id) },
                            { text: "Open in new tab", action: () => AppState.openNoteInNewTab(modelData.id) },
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
    function noteMenu(item, x, y, note) { menu.openAt(item, x, y, AppState.noteMenuItems(note)) }
    function listMenu(item, x, y, list, expanded, hidden) {
        const colours = Theme.pickerSwatches.concat(
            Theme.pickerSwatches.some(s => s.name === list.color) ? [] : [{ name: list.color, label: list.color.charAt(0).toUpperCase() + list.color.slice(1) }])
        menu.openAt(item, x, y, [
            { text: "New note in " + list.name, action: () => AppState.newNote({ listId: list.id }) },
            { text: "Open in new tab", action: () => AppState.openInNewTab("list", list.id) },
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
