import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Every to-do in your notes: Upcoming (by when it's due), By list, Done. The
// field adds one to today's note. Anything ticked here stays in place,
// struck through, until you leave, so a mis-tap is easy to undo.
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
            // The older standalone to-do lists, under their own names.
            const names = []
            for (const t of shown) if (t.kind === "todo" && names.indexOf(t.title) < 0) names.push(t.title)
            out = out.concat(names.map(n => ({ key: "todo:" + n, label: n, items: shown.filter(t => t.kind === "todo" && t.title === n) })))
        } else {
            out = [{ key: "done", label: "Completed", items: done.slice(0, 200) }]
        }
        return out.filter(g => g.items.length > 0)
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
                        width: group.width
                        height: Math.max(taskText.implicitHeight, 22) + 16
                        Checkbox {
                            y: 10
                            checked: row.done
                            onToggled: page.flip(row.modelData)
                        }
                        Text {
                            textFormat: Text.PlainText
                            id: taskText
                            x: 30
                            y: 8
                            width: row.width - x - 12 - source.width - 12 - 52
                            text: row.modelData.text
                            color: row.done ? Theme.c.muted : Theme.c.ink2
                            font.pixelSize: 15
                            font.strikeout: row.done
                            lineHeightMode: Text.FixedHeight
                            lineHeight: 22
                            wrapMode: Text.Wrap
                        }
                        Row {
                            id: source
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
                            textFormat: Text.PlainText
                            x: row.width - 52
                            y: 10
                            width: 52
                            horizontalAlignment: Text.AlignRight
                            text: row.done && page.tab !== "done" ? "Done"
                                : (page.tab === "upcoming" && row.dueKey === "today") ? "" : Fmt.dueLabel(row.modelData.due, AppState.todayIso)
                            color: row.dueKey === "over" && !row.done ? Theme.c.red : Theme.c.muted
                            font.pixelSize: 13
                            font.features: { "tnum": 1 }
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
            }
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
