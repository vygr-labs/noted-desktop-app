import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// To-dos: list tabs, quick add (with natural due-date words), sections by
// due date, inline edit, drag to reorder.
Rectangle {
    id: view
    color: Theme.c.window

    property var todos: []
    property string listId: AppState.selectedTodoListId
    property string editingId: ""

    // Top strip drags the window (there's no title bar).
    DragArea { width: parent.width; height: 30; z: 5 }

    function reload() { todos = Store.todos(listId) }
    onListIdChanged: reload()
    Component.onCompleted: reload()
    Connections { target: Store; function onTodosChanged() { view.reload() } }

    readonly property var sections: {
        const s = { overdue: [], today: [], upcoming: [], none: [], done: [] }
        for (const t of todos) {
            if (t.is_completed) { s.done.push(t); continue }
            const st = Dates.dueState(t.due_date || "")
            if (st === -1) s.overdue.push(t)
            else if (st === 0) s.today.push(t)
            else if (st === 1) s.upcoming.push(t)
            else s.none.push(t)
        }
        s.upcoming.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
        return s
    }
    readonly property int openCount: todos.length - sections.done.length
    readonly property int doneCount: sections.done.length

    // "call mom tomorrow", "pay rent fri", "ship v2 today" → due date.
    function parseQuickAdd(text) {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        const short = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        let due = ""
        let t = text.trim()
        const m = t.match(/\s+(today|tomorrow|tmrw|next week|(?:on\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*)$/i)
        if (m) {
            const word = m[1].toLowerCase().replace(/^on\s+/, "")
            const now = new Date()
            if (word === "today") due = Dates.isoDate(0)
            else if (word === "tomorrow" || word === "tmrw") due = Dates.isoDate(1)
            else if (word === "next week") due = Dates.isoDate(7)
            else {
                const key = word.substring(0, 3)
                const target = short.indexOf(key)
                if (target >= 0) {
                    let diff = (target - now.getDay() + 7) % 7
                    if (diff === 0) diff = 7
                    due = Dates.isoDate(diff)
                }
            }
            if (due !== "") t = t.substring(0, m.index).trim()
        }
        return { text: t, due: due }
    }

    function add() {
        const q = parseQuickAdd(addField.text)
        if (q.text === "") return
        Store.createTodo({ text: q.text, todo_list_id: listId, due_date: q.due })
        addField.text = ""
    }

    Flickable {
        id: scroller
        anchors.fill: parent
        contentHeight: content.implicitHeight + 80
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBarThin {}

        ColumnLayout {
            id: content
            width: Math.min(scroller.width - 80, 680)
            x: (scroller.width - width) / 2
            y: 32
            spacing: 16

            // ── header ──────────────────────────────────────────────
            RowLayout {
                Layout.fillWidth: true
                spacing: 10
                ColumnLayout {
                    spacing: 4
                    Layout.fillWidth: true
                    Text {
                        text: "To-dos"
                        color: Theme.c.text
                        font.pixelSize: 26
                        font.weight: Font.DemiBold
                        font.letterSpacing: -0.4
                    }
                    Text {
                        readonly property real pct: view.todos.length ? view.doneCount / view.todos.length : 0
                        text: view.todos.length === 0 ? "Nothing here yet."
                              : pct === 1 ? "All done! Time to celebrate."
                              : pct >= 0.75 ? "Almost there, keep it up!"
                              : pct >= 0.5 ? "Halfway through, nice progress."
                              : pct > 0 ? "You're getting started, keep going!"
                              : view.openCount + (view.openCount === 1 ? " task" : " tasks") + " waiting for you."
                        color: Theme.c.muted
                        font.pixelSize: Theme.fontMd
                    }
                }
                Repeater {
                    model: [[view.openCount, "active", Theme.c.accent], [view.doneCount, "done", Theme.c.success]]
                    delegate: Rectangle {
                        required property var modelData
                        radius: 12
                        height: 24
                        width: statRow.implicitWidth + 16
                        color: Theme.c.hover
                        Row {
                            id: statRow
                            anchors.centerIn: parent
                            spacing: 6
                            Rectangle { width: 7; height: 7; radius: 4; color: parent.parent.modelData[2]; anchors.verticalCenter: parent.verticalCenter }
                            Text { text: parent.parent.modelData[0] + " " + parent.parent.modelData[1]; color: Theme.c.muted; font.pixelSize: Theme.fontSm }
                        }
                    }
                }
                IconButton {
                    icon: "external-link"
                    tooltip: "Pop out"
                    onClicked: popouts.openTodos(view.listId)
                }
            }

            // ── list tabs ───────────────────────────────────────────
            Flow {
                Layout.fillWidth: true
                spacing: 6
                component Tab: Rectangle {
                    id: tab
                    property string label: ""
                    property string swatch: ""
                    property int count: 0
                    property bool active: false
                    property bool deletable: false
                    signal clicked()
                    signal deleteClicked()
                    height: 30
                    width: tabRow.implicitWidth + 20
                    radius: Theme.radiusLg
                    color: active ? Theme.c.accentSubtle : (tabArea.containsMouse ? Theme.c.hover : "transparent")
                    border.color: active ? Theme.c.accentSoft : Theme.c.border
                    Row {
                        id: tabRow
                        anchors.centerIn: parent
                        spacing: 6
                        ColorDot { visible: tab.swatch !== ""; swatch: tab.swatch || "gray"; anchors.verticalCenter: parent.verticalCenter }
                        Text { text: tab.label; color: tab.active ? Theme.c.accentText : Theme.c.text; font.pixelSize: Theme.fontMd; font.weight: tab.active ? Font.Medium : Font.Normal; anchors.verticalCenter: parent.verticalCenter }
                        Text { visible: tab.count > 0; text: tab.count; color: Theme.c.subtle; font.pixelSize: Theme.fontSm; anchors.verticalCenter: parent.verticalCenter }
                        Icon {
                            visible: tab.deletable && (tabArea.containsMouse || tab.active)
                            name: "x"
                            size: 12
                            color: Theme.c.subtle
                            anchors.verticalCenter: parent.verticalCenter
                            MouseArea { anchors.fill: parent; anchors.margins: -4; cursorShape: Qt.PointingHandCursor; onClicked: tab.deleteClicked() }
                        }
                    }
                    MouseArea { id: tabArea; anchors.fill: parent; hoverEnabled: true; z: -1; cursorShape: Qt.PointingHandCursor; onClicked: tab.clicked() }
                }
                Tab {
                    label: "All"
                    active: view.listId === ""
                    count: AppState.counts.todosOpen || 0
                    onClicked: AppState.selectedTodoListId = ""
                }
                Repeater {
                    model: AppState.todoLists
                    delegate: Tab {
                        required property var modelData
                        label: modelData.name
                        swatch: modelData.color || "gray"
                        count: modelData.open_count || 0
                        active: view.listId === modelData.id
                        deletable: true
                        onClicked: AppState.selectedTodoListId = modelData.id
                        onDeleteClicked: {
                            if (view.listId === modelData.id) AppState.selectedTodoListId = ""
                            Store.deleteTodoList(modelData.id)
                        }
                    }
                }
                Rectangle {
                    height: 30
                    width: newListInput.visible ? 150 : 30
                    radius: Theme.radiusLg
                    color: "transparent"
                    border.color: Theme.c.border
                    Icon { visible: !newListInput.visible; anchors.centerIn: parent; name: "plus"; size: 14; color: Theme.c.subtle }
                    MouseArea { visible: !newListInput.visible; anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { newListInput.visible = true; newListInput.forceActiveFocus() } }
                    TextInput {
                        id: newListInput
                        visible: false
                        anchors.fill: parent
                        anchors.leftMargin: 10
                        anchors.rightMargin: 10
                        verticalAlignment: TextInput.AlignVCenter
                        color: Theme.c.text
                        font.pixelSize: Theme.fontMd
                        clip: true
                        function commit() {
                            if (text.trim() !== "") {
                                const l = Store.createTodoList(text.trim(), Theme.swatchNames[1 + (AppState.todoLists.length % 10)])
                                AppState.selectedTodoListId = l.id
                            }
                            text = ""
                            visible = false
                        }
                        Keys.onReturnPressed: commit()
                        Keys.onEscapePressed: { text = ""; visible = false }
                        onActiveFocusChanged: if (!activeFocus && visible) commit()
                    }
                }
            }

            // ── quick add ───────────────────────────────────────────
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 48
                radius: Theme.radiusLg + 2
                color: Theme.c.window
                border.color: addField.activeFocus ? Theme.c.accentLine : Theme.c.border
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 14
                    anchors.rightMargin: 8
                    spacing: 10
                    Rectangle { width: 18; height: 18; radius: 9; color: "transparent"; border.color: Theme.c.faint; border.width: 1.5 }
                    TextInput {
                        id: addField
                        Layout.fillWidth: true
                        color: Theme.c.text
                        font.pixelSize: Theme.fontLg
                        clip: true
                        selectByMouse: true
                        Keys.onReturnPressed: view.add()
                        Text {
                            visible: addField.length === 0
                            text: "What needs to be done?  Try “pay rent friday”"
                            color: Theme.c.faint
                            font: addField.font
                        }
                    }
                    Text {
                        readonly property var parsed: view.parseQuickAdd(addField.text)
                        visible: parsed.due !== ""
                        text: "Due " + Dates.due(parsed.due)
                        color: Theme.c.accentText
                        font.pixelSize: Theme.fontSm
                    }
                    TextButton { text: "Add"; icon: "plus"; variant: "primary"; compact: true; enabled: addField.text.trim() !== ""; onClicked: view.add() }
                }
            }

            // ── sections ────────────────────────────────────────────
            Repeater {
                model: [
                    { key: "overdue", title: "Overdue", icon: "triangle-alert", color: Theme.c.dangerText },
                    { key: "today", title: "Today", icon: "sun", color: Theme.c.accentText },
                    { key: "upcoming", title: "Upcoming", icon: "calendar-clock", color: Theme.c.muted },
                    { key: "none", title: "No due date", icon: "inbox", color: Theme.c.muted },
                    { key: "done", title: "Completed", icon: "circle-check-big", color: Theme.c.subtle }
                ]
                delegate: ColumnLayout {
                    id: section
                    required property var modelData
                    readonly property var items: view.sections[modelData.key]
                    visible: items.length > 0
                    Layout.fillWidth: true
                    spacing: 2

                    RowLayout {
                        Layout.topMargin: 8
                        Layout.bottomMargin: 4
                        spacing: 7
                        Icon { name: section.modelData.icon; size: 14; color: section.modelData.color }
                        Text {
                            text: section.modelData.title
                            color: section.modelData.color
                            font.pixelSize: Theme.fontSm
                            font.weight: Font.DemiBold
                        }
                        Text { text: section.items.length; color: Theme.c.subtle; font.pixelSize: Theme.fontSm }
                        Item { Layout.fillWidth: true }
                        TextButton {
                            visible: section.modelData.key === "done"
                            text: "Clear completed"
                            compact: true
                            onClicked: Store.clearCompletedTodos(view.listId)
                        }
                    }

                    Repeater {
                        model: section.items
                        delegate: TodoRow {
                            required property var modelData
                            required property int index
                            Layout.fillWidth: true
                            todo: modelData
                            editing: view.editingId === modelData.id
                            onEditRequested: view.editingId = modelData.id
                            onEditFinished: view.editingId = ""
                            onMoveRequested: (delta) => {
                                const ids = section.items.map(t => t.id)
                                const i = index, j = index + delta
                                if (j < 0 || j >= ids.length) return
                                const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp
                                Store.reorderTodos(ids)
                            }
                        }
                    }
                }
            }

            // ── empty ───────────────────────────────────────────────
            ColumnLayout {
                visible: view.todos.length === 0
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: 40
                spacing: 8
                Icon { Layout.alignment: Qt.AlignHCenter; name: "sparkles"; size: 28; color: Theme.c.faint }
                Text { Layout.alignment: Qt.AlignHCenter; text: "All clear!"; color: Theme.c.text; font.pixelSize: Theme.fontLg; font.weight: Font.DemiBold }
                Text { Layout.alignment: Qt.AlignHCenter; text: "Add something above to get started."; color: Theme.c.muted; font.pixelSize: Theme.fontMd }
            }
        }
    }

    PopoutManager { id: popouts }
}
