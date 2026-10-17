import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Every to-do in your notes: Upcoming (by when it's due), By list, Done. The
// field adds one to today's note. Anything ticked here stays in place,
// struck through, until you leave, so a mis-tap is easy to undo.
//
// The standalone to-dos (made in the older To-dos lists, not in a note) are
// edited right here: click one to change it, right-click for its date,
// description, list or to delete it. By list shows each of those lists with
// a field to add to it.
Flickable {
    id: page

    property bool active: false
    property string tab: "upcoming"
    property var ticked: ({})      // "noteId:index" -> checked state set here

    onActiveChanged: if (!active) { ticked = ({}); draft.text = "" } else contentY = 0

    contentWidth: width
    contentHeight: col.y + col.height + 96
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    ScrollBar.vertical: ScrollBarThin {}

    function key(t) { return AppState.taskKey(t) }
    function isDone(t) { const k = key(t); return ticked[k] !== undefined ? ticked[k] : t.checked }
    function flip(t) {
        const done = !isDone(t)
        const m = Object.assign({}, ticked)
        m[key(t)] = done
        ticked = m
        AppState.setTaskDone(t, done)
    }
    // Open ones, plus anything ticked on this visit.
    readonly property var shown: AppState.tasks.filter(t => !t.checked || ticked[key(t)] !== undefined)
    readonly property var open: AppState.tasks.filter(t => !t.checked)
    readonly property var done: AppState.tasks.filter(t => t.checked)
    readonly property int openNotes: { const s = {}; for (const t of open) s[t.noteId] = true; return Object.keys(s).length }

    readonly property var groups: {
        let out = []
        if (tab === "upcoming") {
            out = Fmt.DUE_GROUPS.map(([k, label]) => ({ key: k, label, items: shown.filter(t => Fmt.dueGroup(t.due, AppState.todayIso) === k) }))
        } else if (tab === "lists") {
            const owners = [{ id: "", name: "Daily notes", color: "" }].concat(AppState.lists)
            out = owners.map(o => ({ key: o.id, label: o.name, color: o.color || "", folder: true,
                                     items: shown.filter(t => t.kind !== "todo" && (o.id === "" ? (t.isDaily || !t.listId) : t.listId === o.id)) }))
            // The standalone to-do lists, empty ones too (so they can be
            // added to), then any standalone to-dos in no list.
            out = out.concat(AppState.todoLists.map(l => ({
                key: "todo:" + l.id, label: l.name, todoList: l,
                items: shown.filter(t => t.kind === "todo" && t.todoListId === l.id)
            })))
            const loose = shown.filter(t => t.kind === "todo" && !t.todoListId)
            if (loose.length) out.push({ key: "todo:", label: "To-dos", todoList: { id: "", name: "To-dos" }, items: loose })
        } else {
            out = [{ key: "done", label: "Completed", items: done.slice(0, 200) }]
        }
        return out.filter(g => g.items.length > 0 || g.todoList)
    }

    // ── editing standalone to-dos ────────────────────────────────────
    PopupMenu { id: menu }
    DuePicker {
        id: duePicker
        property string todoId: ""
        onPicked: (iso) => Store.updateTodo(todoId, { due_date: iso })
    }
    function rowMenu(item, x, y, t, row) {
        if (t.kind !== "todo") {
            menu.openAt(item, x, y, [{ text: "Open note", action: () => AppState.openTask(t) }])
            return
        }
        menu.openAt(item, x, y, [
            { text: "Edit", action: () => row.startEdit() },
            { text: t.due ? "Change date…" : "Add a date…", action: () => { duePicker.todoId = t.todoId; duePicker.openUnder(row.dueAnchor, -200, t.due) } },
            { text: t.description ? "Edit description" : "Add a description", action: () => row.startDescription() },
            { text: "Move to", disabled: AppState.todoLists.length === 0, children: AppState.todoLists.map(l => ({
                text: l.name, checked: l.id === t.todoListId, action: () => Store.updateTodo(t.todoId, { todo_list_id: l.id })
            })) },
            { separator: true },
            { text: "Delete", danger: true, action: () => Store.deleteTodo(t.todoId) }
        ])
    }
    function listMenu(item, l) {
        menu.openBelowRight(item, [
            { text: "Rename…", action: () => listDialog.openFor(l) },
            { separator: true },
            { text: "Delete list…", danger: true, action: () => deleteListDialog.openFor(l) }
        ])
    }
    ModalDialog {
        id: listDialog
        property var list: null   // null: a new list
        title: list ? "Rename to-do list" : "New to-do list"
        function openFor(l) { list = l || null; listName.text = l ? l.name : ""; open(); listName.forceActiveFocus(); listName.selectAll() }
        function commit() {
            const n = listName.text.trim()
            if (n === "") return
            if (list) Store.updateTodoList(list.id, { name: n })
            else Store.createTodoList(n)
            close()
        }
        Field { id: listName; Layout.fillWidth: true; placeholderText: "Groceries, Errands, House…"; onAccepted: listDialog.commit() }
        footer: [
            TextButton { text: "Cancel"; onClicked: listDialog.close() },
            TextButton { text: listDialog.list ? "Rename" : "Create"; variant: "primary"; onClicked: listDialog.commit() }
        ]
    }
    ModalDialog {
        id: deleteListDialog
        property var list: ({})
        readonly property int count: list.id ? AppState.tasks.filter(t => t.kind === "todo" && t.todoListId === list.id).length : 0
        title: "Delete " + (list.name || "this list") + "?"
        description: count ? "Its " + Fmt.plural(count, "to-do") + " stay, under To-dos." : "It has no to-dos."
        function openFor(l) { list = l; open() }
        footer: [
            TextButton { text: "Cancel"; onClicked: deleteListDialog.close() },
            TextButton { text: "Delete list"; variant: "danger"; onClicked: { Store.deleteTodoList(deleteListDialog.list.id); deleteListDialog.close() } }
        ]
    }

    Column {
        id: col
        y: 40
        width: Math.min(page.width - 96, Math.max(680, Math.min(960, page.width * 0.62)) - 96)
        x: (page.width - width) / 2

        Text {
            textFormat: Text.PlainText
            text: page.open.length + " open across " + Fmt.plural(page.openNotes, "note")
            color: Theme.c.muted
            font.pixelSize: 13
        }
        Item { width: 1; height: 6 }
        Text { textFormat: Text.PlainText; text: "To-dos"; color: Theme.c.ink; font.pixelSize: 34; font.weight: 650; font.letterSpacing: -0.68 }
        Item { width: 1; height: 24 }
        Tabs {
            width: parent.width
            current: page.tab
            tabs: [
                { id: "upcoming", label: "Upcoming", count: String(page.open.length) },
                { id: "lists", label: "By list", count: "" },
                { id: "done", label: "Done", count: String(page.done.length) }
            ]
            onPicked: (id) => page.tab = id
        }

        // Add to today's note.
        Item { visible: page.tab !== "done"; width: 1; height: 22 }
        Rectangle {
            visible: page.tab !== "done"
            width: parent.width
            height: 42
            radius: 8
            color: "transparent"
            border.color: draft.activeFocus ? Theme.c.accent : Theme.c.lineStrong
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 12
                anchors.rightMargin: 12
                spacing: 10
                Icon { name: "plus"; size: 16; color: Theme.c.muted }
                Field {
                    id: draft
                    Layout.fillWidth: true
                    bare: true
                    font.pixelSize: 15
                    placeholderText: "Add a to-do for today"
                    onAccepted: {
                        const t = text.trim()
                        if (t === "") return
                        const daily = Store.dailyNote(AppState.todayIso)
                        if (Store.appendTask(daily.id, t) >= 0) text = ""
                    }
                }
                Text { textFormat: Text.PlainText; visible: draft.text !== ""; text: "Enter to add"; color: Theme.c.muted; font.pixelSize: 12 }
            }
        }

        Repeater {
            model: page.groups
            delegate: Column {
                id: group
                required property var modelData
                readonly property string foldKey: page.tab + ":" + modelData.key
                readonly property bool folded: !!AppState.foldedTodoGroups[foldKey]
                // A long group shows a page of to-dos at a time.
                property int limit: 40
                width: col.width
                topPadding: 30
                // The group's heading folds it away (remembered). The chevron
                // hangs in the margin so the name lines up with the boxes.
                Item {
                    x: -22
                    width: groupHead.width
                    height: groupHead.height
                    Row {
                        id: groupHead
                        spacing: 8
                        bottomPadding: 4
                        Item {
                            width: 14
                            height: 18
                            anchors.verticalCenter: parent.verticalCenter
                            Icon {
                                anchors.centerIn: parent
                                name: "chevron-right"
                                size: 12
                                color: headArea.containsMouse ? Theme.c.ink : Theme.c.muted
                                rotation: group.folded ? 0 : 90
                                Behavior on rotation { NumberAnimation { duration: Theme.fast } }
                            }
                        }
                        Icon {
                            visible: !!group.modelData.todoList
                            name: "list-checks"
                            size: 14
                            color: Theme.c.faint
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        Icon {
                            visible: !!group.modelData.folder
                            name: "folder"
                            size: 14
                            color: group.modelData.color ? Theme.swatch(group.modelData.color) : Theme.c.faint
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        Text {
                            textFormat: Text.PlainText
                            text: group.modelData.label
                            color: group.modelData.key === "over" ? Theme.c.red : Theme.c.ink
                            font.pixelSize: 13
                            font.weight: Font.DemiBold
                        }
                        Text {
                            textFormat: Text.PlainText
                            text: group.modelData.items.filter(t => !page.isDone(t)).length
                            color: Theme.c.muted
                            font.pixelSize: 13
                            font.features: { "tnum": 1 }
                        }
                    }
                    MouseArea {
                        id: headArea
                        anchors.fill: parent
                        anchors.leftMargin: -6
                        anchors.rightMargin: -6
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: AppState.setTodoGroupFolded(group.foldKey, !group.folded)
                    }
                    // A standalone list's menu, at the end of its heading line.
                    IconButton {
                        id: listButton
                        visible: !!group.modelData.todoList && !!group.modelData.todoList.id
                        x: group.width + 22 - width + 6
                        anchors.verticalCenter: groupHead.verticalCenter
                        anchors.verticalCenterOffset: -2
                        size: 26
                        iconSize: 14
                        icon: "ellipsis"
                        tooltip: "List options"
                        onClicked: page.listMenu(listButton, group.modelData.todoList)
                    }
                }

                Repeater {
                    model: group.folded ? [] : group.modelData.items.slice(0, group.limit)
                    delegate: Item {
                        id: row
                        required property var modelData
                        readonly property bool done: page.isDone(modelData)
                        readonly property var list: AppState.listById(modelData.listId)
                        readonly property bool todays: modelData.isDaily && modelData.dailyDate === AppState.todayIso
                        readonly property string dueKey: Fmt.dueGroup(modelData.due, AppState.todayIso)
                        readonly property bool standalone: modelData.kind === "todo"
                        readonly property alias dueAnchor: dueText
                        property bool editing: false
                        property bool describing: false
                        width: group.width
                        height: body.implicitHeight + 16

                        function startEdit() { if (!standalone) return; editing = true; editor.text = modelData.text; editor.forceActiveFocus(); editor.selectAll() }
                        function finishEdit() {
                            if (!editing) return
                            editing = false
                            const t = editor.text.trim()
                            if (t !== "" && t !== modelData.text) Store.updateTodo(modelData.todoId, { text: t })
                        }
                        function startDescription() { describing = true; descEditor.text = modelData.description; descEditor.forceActiveFocus() }
                        function finishDescription() {
                            if (!describing) return
                            describing = false
                            const d = descEditor.text.trim()
                            if (d !== modelData.description) Store.updateTodo(modelData.todoId, { description: d })
                        }

                        MouseArea {
                            anchors.fill: parent
                            acceptedButtons: Qt.RightButton
                            onClicked: (e) => page.rowMenu(row, e.x, e.y, row.modelData, row)
                        }
                        Checkbox {
                            y: 10
                            checked: row.done
                            onToggled: page.flip(row.modelData)
                        }
                        Column {
                            id: body
                            x: 30
                            y: 8
                            width: row.width - x - 12 - (source.visible ? source.width + 12 : 0) - 52
                            spacing: 2
                            Text {
                                textFormat: Text.PlainText
                                id: taskText
                                visible: !row.editing
                                width: parent.width
                                text: row.modelData.text
                                color: row.done ? Theme.c.muted : Theme.c.ink2
                                font.pixelSize: 15
                                font.strikeout: row.done
                                lineHeightMode: Text.FixedHeight
                                lineHeight: 22
                                wrapMode: Text.Wrap
                                MouseArea {
                                    anchors.fill: parent
                                    enabled: row.standalone
                                    cursorShape: Qt.IBeamCursor
                                    onClicked: row.startEdit()
                                }
                            }
                            Field {
                                id: editor
                                visible: row.editing
                                x: -11
                                width: parent.width + 11
                                implicitHeight: 30
                                font.pixelSize: 15
                                onAccepted: row.finishEdit()
                                onActiveFocusChanged: if (!activeFocus) row.finishEdit()
                                Keys.onEscapePressed: { row.editing = false }
                            }
                            Text {
                                textFormat: Text.PlainText
                                visible: !row.describing && row.modelData.description !== undefined && row.modelData.description !== ""
                                width: parent.width
                                text: row.modelData.description || ""
                                color: Theme.c.muted
                                font.pixelSize: 13
                                lineHeightMode: Text.FixedHeight
                                lineHeight: 19
                                wrapMode: Text.Wrap
                                MouseArea { anchors.fill: parent; cursorShape: Qt.IBeamCursor; onClicked: row.startDescription() }
                            }
                            Field {
                                id: descEditor
                                visible: row.describing
                                x: -11
                                width: parent.width + 11
                                implicitHeight: 28
                                font.pixelSize: 13
                                placeholderText: "Description"
                                onAccepted: row.finishDescription()
                                onActiveFocusChanged: if (!activeFocus) row.finishDescription()
                                Keys.onEscapePressed: { row.describing = false }
                            }
                        }
                        Row {
                            id: source
                            // Under its own list's heading, a standalone to-do doesn't repeat it.
                            visible: !(row.standalone && page.tab === "lists")
                            x: row.width - 52 - 12 - width
                            y: 10
                            spacing: 7
                            Rectangle {
                                width: 7
                                height: 7
                                radius: 3.5
                                anchors.verticalCenter: parent.verticalCenter
                                color: row.list ? Theme.swatch(row.list.color) : Theme.c.faint
                            }
                            Text {
                                textFormat: Text.PlainText
                                width: Math.min(implicitWidth, row.width * 0.42 - 14)
                                text: row.todays ? "Today’s note" : (row.modelData.title || "Untitled")
                                color: srcArea.containsMouse ? Theme.c.ink : Theme.c.muted
                                font.pixelSize: 13
                                elide: Text.ElideRight
                            }
                        }
                        MouseArea {
                            id: srcArea
                            x: source.x
                            y: source.y
                            width: source.width
                            height: source.height
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: AppState.openTask(row.modelData)
                        }
                        Text {
                            id: dueText
                            textFormat: Text.PlainText
                            x: row.width - 52
                            y: 10
                            width: 52
                            horizontalAlignment: Text.AlignRight
                            text: row.done && page.tab !== "done" ? "Done"
                                : (page.tab === "upcoming" && row.dueKey === "today") ? "" : Fmt.dueLabel(row.modelData.due, AppState.todayIso)
                            color: row.dueKey === "over" && !row.done ? Theme.c.red : (dueArea.containsMouse ? Theme.c.ink : Theme.c.muted)
                            font.pixelSize: 13
                            font.features: { "tnum": 1 }
                            MouseArea {
                                id: dueArea
                                anchors.fill: parent
                                enabled: row.standalone && !row.done
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: { duePicker.todoId = row.modelData.todoId; duePicker.openUnder(dueText, -200, row.modelData.due) }
                            }
                        }
                    }
                }
                TextButton {
                    readonly property int rest: group.modelData.items.length - group.limit
                    visible: !group.folded && rest > 0
                    x: 24
                    variant: "link"
                    text: "Show " + Math.min(rest, 100) + " more of " + rest
                    onClicked: group.limit += 100
                }
                // Add to this standalone list.
                Item {
                    visible: !group.folded && !!group.modelData.todoList
                    width: group.width
                    height: 36
                    Icon { x: 1; anchors.verticalCenter: parent.verticalCenter; name: "plus"; size: 15; color: Theme.c.faint }
                    Field {
                        id: addHere
                        x: 30
                        width: parent.width - 30
                        anchors.verticalCenter: parent.verticalCenter
                        bare: true
                        font.pixelSize: 15
                        placeholderText: "Add a to-do"
                        onAccepted: {
                            const t = text.trim()
                            if (t === "") return
                            Store.createTodo({ text: t, todo_list_id: group.modelData.todoList.id })
                            text = ""
                        }
                    }
                }
            }
        }

        Item { visible: page.tab === "lists"; width: 1; height: 26 }
        TextButton {
            visible: page.tab === "lists"
            icon: "plus"
            text: "New to-do list"
            onClicked: listDialog.openFor(null)
        }

        Text {
            textFormat: Text.PlainText
            visible: page.groups.length === 0
            topPadding: 40
            width: parent.width
            text: page.tab === "done" ? "Nothing ticked off yet."
                : (AppState.tasks.length > 0 ? "Nothing open. Enjoy the day." : "No to-dos yet. Add one above, or type [ ] at the start of a line in any note.")
            color: Theme.c.muted
            font.pixelSize: 15
            wrapMode: Text.Wrap
        }
    }
}
