import QtQuick
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Home: today's daily note (editable in place), recently edited notes and the
// lists as folders, with the month calendar and open to-dos on the right.
PageColumns {
    id: desk

    property bool active: false
    signal openFileRequested()

    // ── data ─────────────────────────────────────────────────────────
    property var daily: ({})
    property var recent: []
    property var listCards: []
    // To-dos ticked here stay on the page, struck through, until you leave.
    property var ticked: ({})

    function reload() {
        recent = Store.recentEdited(4, false)
        listCards = AppState.lists.map(l => {
            const notes = Store.notesInList(l.id, "updated_at")
            const latest = notes.slice().sort((a, b) => (b.updated_at > a.updated_at) - (b.updated_at < a.updated_at))[0]
            return { list: l, count: notes.length, latest: latest ? latest.title : "No notes yet", edited: latest ? Fmt.editedPhrase(latest.updated_at) : "" }
        })
    }
    function loadDaily() {
        daily = Store.dailyNote(AppState.todayIso)
        if (editor.controller.noteId !== daily.id) editor.load(daily.id, daily.content || "")
    }
    onActiveChanged: {
        if (active) { loadDaily(); reload(); contentY = 0 }
        else { editor.controller.flush(); editor.controller.unload(); ticked = ({}) }
    }
    Connections {
        target: Store
        function onNotesChanged() { if (desk.active) reloadLater.restart() }
        function onNoteChanged(id) { if (id === desk.daily.id) desk.daily = Store.note(id) }
        function onExternalChange() { if (desk.active && !editor.controller.dirty) { desk.daily = ({}); desk.loadDaily() } }
    }
    Connections {
        target: AppState
        function onTodayIsoChanged() { if (desk.active) { editor.controller.flush(); desk.loadDaily() } }
        function onListsChanged() { if (desk.active) reloadLater.restart() }
        function onEditorTaskToggleRequested(noteId, index) {
            if (!desk.active || noteId !== editor.controller.noteId) return
            const t = editor.controller.decorations.filter(d => d.k === "task")
            if (index >= 0 && index < t.length) { editor.controller.toggleTask(t[index].block); AppState.claimTask() }
        }
    }
    Timer { id: reloadLater; interval: 250; onTriggered: desk.reload() }

    function flush() { editor.controller.flush() }

    // Open to-dos, grouped by when they're due.
    readonly property var todoGroups: {
        const open = AppState.tasks.filter(t => !t.checked || desk.ticked[AppState.taskKey(t)])
        return Fmt.DUE_GROUPS.map(([key, label]) => ({
            key, label,
            items: open.filter(t => Fmt.dueGroup(t.due, AppState.todayIso) === key).slice(0, key === "none" ? 4 : 6)
        })).filter(g => g.items.length > 0)
    }

    // ── today's note ─────────────────────────────────────────────────
    Text {
        textFormat: Text.PlainText
        text: desk.daily.content_plain ? "Daily note · edited " + Fmt.edited(desk.daily.updated_at) : "Daily note"
        color: Theme.c.muted
        font.pixelSize: 13
    }
    Item { width: 1; height: 6 }
    Text {
        textFormat: Text.PlainText
        width: parent.width
        text: Fmt.longDay(AppState.todayIso)
        color: Theme.c.ink
        font.pixelSize: 34
        font.weight: 650
        font.letterSpacing: -0.68
        lineHeightMode: Text.FixedHeight
        lineHeight: Math.round(34 * 1.15)
        wrapMode: Text.Wrap
    }
    Item { width: 1; height: 22 }
    RichEditor {
        id: editor
        width: parent.width
        minHeight: 26
        placeholder: "Write anything. This is today’s note, and tomorrow there’ll be a fresh one."
    }

    // ── recently edited ──────────────────────────────────────────────
    Column {
        visible: desk.recent.length > 0
        width: parent.width
        Item { width: 1; height: 52 }
        SectionLabel { text: "Recently edited" }
        Item { width: 1; height: 14 }
        Grid {
            id: recentGrid
            readonly property int cols: Math.max(1, Math.floor((width + 14) / (250 + 14)))
            readonly property real cellW: (width - 14 * (cols - 1)) / cols
            width: parent.width
            columns: cols
            columnSpacing: 14
            rowSpacing: 14
            Repeater {
                model: desk.recent
                delegate: Rectangle {
                    id: card
                    required property var modelData
                    readonly property var list: AppState.listById(modelData.list_id)
                    width: recentGrid.cellW
                    height: 172
                    radius: 10
                    color: cardArea.containsMouse ? Theme.mix(Theme.c.bg, Theme.c.pressed, 0.35) : Theme.c.bg
                    border.color: Theme.c.line
                    ColumnLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 18
                        anchors.rightMargin: 18
                        anchors.topMargin: 16
                        anchors.bottomMargin: 16
                        spacing: 0
                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 12
                            Text {
                                textFormat: Text.PlainText
                                Layout.fillWidth: true
                                text: card.modelData.title || "Untitled"
                                color: Theme.c.ink
                                font.pixelSize: 15
                                font.weight: Font.Medium
                                lineHeightMode: Text.FixedHeight
                                lineHeight: Math.round(15 * 1.35)
                                wrapMode: Text.Wrap
                                maximumLineCount: 2
                                elide: Text.ElideRight
                            }
                            Text {
                                textFormat: Text.PlainText
                                Layout.alignment: Qt.AlignTop
                                Layout.topMargin: 2
                                text: Fmt.edited(card.modelData.updated_at)
                                color: Theme.c.muted
                                font.pointSize: Theme.pt(12.5)
                            }
                        }
                        Text {
                            textFormat: Text.PlainText
                            Layout.fillWidth: true
                            Layout.topMargin: 8
                            text: AppState.isLocked(card.modelData) ? "Locked" : (card.modelData.preview || "").replace(/\s+/g, " ")
                            color: Theme.c.tertiary
                            font.pointSize: Theme.pt(13.5)
                            lineHeightMode: Text.FixedHeight
                            lineHeight: Math.round(13.5 * 1.5)
                            wrapMode: Text.Wrap
                            maximumLineCount: 3
                            elide: Text.ElideRight
                        }
                        Item { Layout.fillHeight: true }
                        RowLayout {
                            spacing: 7
                            Rectangle { width: 7; height: 7; radius: 3.5; color: card.list ? Theme.swatch(card.list.color) : Theme.c.faint }
                            Text { textFormat: Text.PlainText; text: card.list ? card.list.name : "Notes"; color: Theme.c.muted; font.pointSize: Theme.pt(12.5) }
                        }
                    }
                    MouseArea {
                        id: cardArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: AppState.openNote(card.modelData.id)
                    }
                }
            }
        }
    }

    // ── lists as folders ─────────────────────────────────────────────
    Column {
        visible: desk.listCards.length > 0
        width: parent.width
        Item { width: 1; height: 44 }
        SectionLabel { text: "Your lists" }
        Item { width: 1; height: 14 }
        Grid {
            id: listGrid
            readonly property int cols: Math.max(1, Math.floor((width + 14) / (190 + 14)))
            readonly property real cellW: (width - 14 * (cols - 1)) / cols
            width: parent.width
            columns: cols
            columnSpacing: 14
            rowSpacing: 18
            Repeater {
                model: desk.listCards
                delegate: FolderCard {
                    required property var modelData
                    width: listGrid.cellW
                    list: modelData.list
                    count: modelData.count
                    latest: modelData.latest
                    edited: modelData.edited
                    onClicked: AppState.go("list", modelData.list.id)
                }
            }
        }
    }

    // ── first run ────────────────────────────────────────────────────
    Column {
        visible: AppState.lists.length === 0
        width: parent.width
        Item { width: 1; height: 52 }
        SectionLabel { text: "Getting started" }
        Item { width: 1; height: 4 }
        SettingRow {
            label: "Make a list"
            description: "Lists hold notes that belong together, like Work or Church."
            first: true
            TextButton { text: "New list"; onClicked: AppState.newListRequested() }
        }
        SettingRow {
            label: "Open a markdown file"
            description: "Edit .md and .txt files where they are. They show under Files in the sidebar."
            TextButton { text: "Open file…"; onClicked: desk.openFileRequested() }
        }
        SettingRow {
            label: "Jot something down from anywhere"
            description: "Works in any app while noted is running."
            Row { spacing: 4; Kbd { text: "Ctrl" } Kbd { text: "Alt" } Kbd { text: "N" } }
        }
    }

    // ── right column ─────────────────────────────────────────────────
    asideContent: [
        MiniCalendar {
            width: parent.width
            onDayPicked: (iso) => {
                if (iso === AppState.todayIso) return
                AppState.openNote(Store.dailyNote(iso).id)
            }
        },
        Item { width: 1; height: 34 },
        Column {
            width: parent.width
            RowLayout {
                width: parent.width
                SectionLabel { Layout.fillWidth: true; text: "Open to-dos" }
                TextButton {
                    visible: AppState.openTaskCount > 0
                    variant: "link"
                    text: "All " + AppState.openTaskCount
                    onClicked: AppState.go("todos")
                }
            }
            Item { width: 1; height: 6 }
            Repeater {
                model: desk.todoGroups
                delegate: Column {
                    id: group
                    required property var modelData
                    width: parent.width
                    topPadding: 12
                    Text {
                        textFormat: Text.PlainText
                        text: group.modelData.label
                        color: group.modelData.key === "over" ? Theme.c.red : Theme.c.ink
                        font.pixelSize: 12
                        font.weight: Font.Medium
                    }
                    Repeater {
                        model: group.modelData.items
                        delegate: SideTask {
                            required property var modelData
                            width: group.width
                            task: modelData
                            ticked: !!desk.ticked[AppState.taskKey(modelData)]
                            source: modelData.isDaily && modelData.dailyDate === AppState.todayIso ? "Today’s note" : (modelData.title || "Untitled")
                            when: group.modelData.key === "today" ? "" : Fmt.dueLabel(modelData.due, AppState.todayIso)
                            overdue: group.modelData.key === "over"
                            onOpenRequested: AppState.openTask(modelData)
                            onToggled: {
                                const key = AppState.taskKey(modelData)
                                const t = Object.assign({}, desk.ticked)
                                const now = !t[key]
                                if (now) t[key] = true
                                else delete t[key]
                                desk.ticked = t
                                AppState.setTaskDone(modelData, now)
                            }
                        }
                    }
                }
            }
            Text {
                textFormat: Text.PlainText
                visible: desk.todoGroups.length === 0
                width: parent.width
                topPadding: 10
                text: "Nothing open. A to-do in any note shows up here."
                color: Theme.c.muted
                font.pixelSize: 14
                lineHeightMode: Text.FixedHeight
                lineHeight: Math.round(14 * 1.5)
                wrapMode: Text.Wrap
            }
        }
    ]
}
