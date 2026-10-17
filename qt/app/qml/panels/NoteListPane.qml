import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// Middle column: view header, filter chips (or the daily-note calendar), the
// list's open to-dos, and notes grouped by date.
Rectangle {
    id: pane
    signal importRequested()

    color: Theme.c.list

    readonly property bool isToday: AppState.view === "today"
    readonly property bool isTrash: AppState.view === "trash"
    readonly property var sortLabels: ({ updated_at: "Edited", created_at: "Created", title: "Title" })

    PopupMenu { id: menu }

    function noteMenu(item, x, y, id) {
        const n = Store.note(id)
        if (!n.id) return
        if (n.is_trashed) {
            menu.openAt(item, x, y, [
                { text: "Restore", icon: "rotate-ccw", action: () => AppState.restoreNote(id) },
                { separator: true },
                { text: "Delete permanently", icon: "trash-2", danger: true, action: () => AppState.deleteForever(id) }
            ])
            return
        }
        const lists = [{ text: "No list", icon: "inbox", checked: !n.list_id, action: () => Store.moveToList(id, "") }]
        for (const l of AppState.lists.concat(AppState.hiddenLists))
            lists.push({ text: l.name, color: l.color || "gray", checked: n.list_id === l.id, action: () => Store.moveToList(id, l.id) })
        menu.openAt(item, x, y, [
            { text: n.is_pinned ? "Unpin" : "Pin to top", icon: n.is_pinned ? "pin-off" : "pin", action: () => Store.setPinned(id, !n.is_pinned) },
            { text: "Duplicate", icon: "copy", action: () => AppState.duplicate(id) },
            { text: n.is_locked ? "Unlock" : "Lock", icon: n.is_locked ? "lock-open" : "lock", action: () => AppState.toggleLock(id) },
            { text: "Pop out", icon: "external-link", action: () => popout.openNote(id) },
            { separator: true },
            { text: "Move to list", icon: "folder", children: lists },
            { separator: true },
            { text: "Delete", icon: "trash-2", danger: true, shortcut: "Del", action: () => AppState.trashNote(id) }
        ])
    }

    function viewMenu(item) {
        const sort = [
            { header: "Sort by" },
            { text: "Last edited", checked: AppState.noteSort === "updated_at", action: () => AppState.setSort("updated_at") },
            { text: "Date created", checked: AppState.noteSort === "created_at", action: () => AppState.setSort("created_at") },
            { text: "Title", checked: AppState.noteSort === "title", action: () => AppState.setSort("title") },
            { separator: true },
            { text: "Show snippets", checked: AppState.showPreview, action: () => AppState.setShowPreview(!AppState.showPreview) },
            { separator: true },
            { text: "Open file…", icon: "folder-open", shortcut: "Ctrl+O", action: () => pane.importRequested() },
            { text: "Hide note list", icon: "chevrons-left", shortcut: "Ctrl+[", action: () => AppState.noteListCollapsed = true }
        ]
        menu.openBelow(item, sort)
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── header (drags the window) ───────────────────────────────────
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 58
            DragArea { anchors.fill: parent }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 18
                anchors.rightMargin: 12
                anchors.topMargin: 8
                spacing: 4

                RowLayout {
                    id: titleRow
                    Layout.fillWidth: true
                    spacing: 6
                    Text {
                        text: AppState.viewTitle
                        color: Theme.c.text
                        font.pixelSize: 18
                        font.weight: Font.DemiBold
                        elide: Text.ElideRight
                        Layout.maximumWidth: Math.max(60, pane.width - 200)
                        Layout.alignment: Qt.AlignBaseline
                    }
                    Text {
                        id: countText
                        text: Notes.count
                        color: Theme.c.subtle
                        font.pixelSize: 14
                        Layout.alignment: Qt.AlignBaseline
                    }
                    Item { Layout.fillWidth: true }
                }

                // Sort / view options: "Edited ↓"
                Rectangle {
                    visible: !pane.isToday && !pane.isTrash
                    implicitWidth: sortRow.implicitWidth + 10
                    implicitHeight: 28
                    radius: Theme.radius
                    color: sortArea.containsMouse ? Theme.c.hover : "transparent"
                    Row {
                        id: sortRow
                        anchors.centerIn: parent
                        spacing: 4
                        Text {
                            text: pane.sortLabels[AppState.noteSort] || "Edited"
                            color: Theme.c.muted
                            font.pixelSize: 13
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        Icon {
                            name: AppState.noteSort === "title" ? "arrow-up-down" : "chevron-down"
                            size: 13
                            color: Theme.c.subtle
                            anchors.verticalCenter: parent.verticalCenter
                        }
                    }
                    MouseArea {
                        id: sortArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: pane.viewMenu(parent)
                    }
                }
                TextButton {
                    visible: pane.isTrash && Notes.count > 0
                    text: "Empty trash"
                    compact: true
                    onClicked: emptyTrashDialog.open()
                }
                IconButton {
                    visible: !pane.isTrash
                    icon: "square-pen"
                    size: 30
                    iconSize: 17
                    tooltip: pane.isToday ? "Today's note" : "New note"
                    shortcut: pane.isToday ? "Ctrl+." : "Ctrl+N"
                    onClicked: pane.isToday ? AppState.selectNote(Store.dailyNote(AppState.todayIso).id) : AppState.newNote()
                }
            }
        }

        // ── filter chips (only the ones that would narrow this view) ───
        Flow {
            id: filters
            readonly property var chips: {
                const fc = Notes.filterCounts
                // Worth showing if it would narrow the view without emptying it.
                const useful = (key, n) => Notes.filter === key || (n > 0 && n < (fc.total || 0))
                return [
                    { key: "todos", label: "Has to-dos", n: fc.todos || 0 },
                    { key: "daily", label: "Daily", n: AppState.view === "synced" ? 0 : (fc.daily || 0) },
                    { key: "shared", label: "Shared", n: AppState.view === "synced" ? 0 : (fc.shared || 0) }
                ].filter(c => useful(c.key, c.n))
            }
            visible: !pane.isToday && !pane.isTrash && chips.length > 0
            Layout.fillWidth: true
            Layout.leftMargin: 12
            Layout.rightMargin: 12
            Layout.bottomMargin: 6
            spacing: 2
            Repeater {
                model: [{ key: "", label: "All" }].concat(filters.chips)
                delegate: Rectangle {
                    required property var modelData
                    readonly property bool on: Notes.filter === modelData.key
                    width: chipLabel.implicitWidth + 16
                    height: 26
                    radius: Theme.radius
                    color: on ? Theme.c.navActive : (chipArea.containsMouse ? Theme.c.hover : "transparent")
                    Text {
                        id: chipLabel
                        anchors.centerIn: parent
                        text: parent.modelData.label
                        color: parent.on ? Theme.c.text : Theme.c.muted
                        font.pixelSize: 13
                        font.weight: parent.on ? Font.Medium : Font.Normal
                    }
                    MouseArea {
                        id: chipArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: Notes.filter = parent.modelData.key
                    }
                }
            }
        }

        // ── daily notes: calendar ───────────────────────────────────────
        MiniCalendar {
            visible: pane.isToday
            Layout.fillWidth: true
            Layout.leftMargin: 14
            Layout.rightMargin: 14
            Layout.bottomMargin: 10
            selectedIso: AppState.currentNote.is_daily ? (AppState.currentNote.daily_date || "") : ""
            onDayPicked: (iso) => AppState.selectNote(Store.dailyNote(iso).id)
        }

        // ── the list's open to-dos ──────────────────────────────────────
        OpenTasks {
            Layout.fillWidth: true
            Layout.bottomMargin: 2
            listId: AppState.view === "list" ? AppState.viewId : ""
            visible: AppState.view === "list" && total > 0
            open: Store.setting("qt.openTasksOpen", "false") === "true"
        }

        // Hairline under the header once rows scroll beneath it.
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.c.divider
            opacity: list.contentY > list.originY + 2 ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: 150 } }
        }

        ListView {
            id: list
            Layout.fillWidth: true
            Layout.fillHeight: true
            model: Notes
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            cacheBuffer: 800
            currentIndex: Notes.indexOf(AppState.selectedNoteId)
            highlightFollowsCurrentItem: false
            ScrollBar.vertical: ScrollBarThin {}
            keyNavigationEnabled: false
            bottomMargin: 8

            section.property: "group"
            section.delegate: Item {
                required property string section
                width: ListView.view.width
                height: section === "" ? 0 : 42
                Text {
                    visible: parent.section !== ""
                    anchors.left: parent.left
                    anchors.leftMargin: 18
                    anchors.bottom: parent.bottom
                    anchors.bottomMargin: 6
                    text: parent.section
                    color: Theme.c.subtle
                    font.pixelSize: 12
                    font.weight: Font.Medium
                }
            }

            delegate: NoteCard {
                width: ListView.view.width
                showList: AppState.view !== "list"
                onMenuRequested: (item, x, y) => pane.noteMenu(item, x, y, noteId)
            }

            displaced: Transition { NumberAnimation { properties: "y"; duration: 160; easing.type: Easing.OutCubic } }

            onCurrentIndexChanged: if (currentIndex >= 0) positionViewAtIndex(currentIndex, ListView.Contain)

            // Empty states
            Column {
                visible: Notes.count === 0
                anchors.centerIn: parent
                width: parent.width - 48
                spacing: 8
                Icon {
                    anchors.horizontalCenter: parent.horizontalCenter
                    name: pane.isTrash ? "trash-2" : Notes.filter !== "" ? "search" : "notebook-pen"
                    size: 26
                    color: Theme.c.faint
                }
                Text {
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    text: pane.isTrash ? "Trash is empty" : Notes.filter !== "" ? "Nothing matches this filter" : Dates.greeting() + "!"
                    color: Theme.c.text
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                }
                Text {
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.Wrap
                    text: pane.isTrash ? "Deleted notes will appear here."
                        : Notes.filter !== "" ? "Try another filter, or show all notes."
                        : pane.isToday ? "Write something today and it'll show up here." : "Your notes will show up here. Ready to write something?"
                    color: Theme.c.muted
                    font.pixelSize: 13
                }
                TextButton {
                    visible: !pane.isTrash
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: Notes.filter !== "" ? "Show all" : "Create note"
                    icon: Notes.filter !== "" ? "" : "plus"
                    variant: Notes.filter !== "" ? "ghost" : "primary"
                    onClicked: Notes.filter !== "" ? Notes.filter = "" : AppState.newNote()
                }
            }
        }
    }

    ModalDialog {
        id: emptyTrashDialog
        title: "Empty trash?"
        description: Notes.count + " note" + (Notes.count === 1 ? "" : "s") + " will be deleted forever. This can't be undone."
        footer: [
            TextButton { text: "Cancel"; onClicked: emptyTrashDialog.close() },
            TextButton {
                text: "Delete forever"
                variant: "danger"
                onClicked: { Store.emptyTrash(); AppState.selectNote(""); emptyTrashDialog.close() }
            }
        ]
    }

    PopoutManager { id: popout }
}
