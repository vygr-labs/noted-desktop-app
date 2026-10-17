import QtQuick
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// One list: its notes as sheets (a small render of each page) or rows, with
// the list's open to-dos and its colour on the right. Long lists sorted by
// date split into time groups.
PageColumns {
    id: page

    property bool active: false
    readonly property string listId: AppState.view === "list" ? AppState.viewId : ""
    readonly property var list: AppState.listById(listId) || ({})
    readonly property bool sheets: AppState.listLayout !== "rows"
    readonly property bool byTitle: AppState.noteSort === "title"

    property var notes: []
    property var previews: ({})
    function reload() {
        if (!listId) { notes = []; return }
        notes = Store.notesInList(listId, byTitle ? "title" : "updated_at")
        if (sheets) {
            const p = {}
            for (const n of notes) p[n.id] = Store.previewBlocks(n.id, 9)
            previews = p
        }
    }
    onListIdChanged: if (active) { reload(); contentY = 0 }
    onActiveChanged: if (active) reload()
    onSheetsChanged: if (active) reload()
    onByTitleChanged: if (active) reload()
    Connections {
        target: Store
        function onNotesChanged() { if (page.active) reloadLater.restart() }
        function onLockStateChanged() { if (page.active) page.reload() }
    }
    Timer { id: reloadLater; interval: 200; onTriggered: page.reload() }

    // Open to-do counts per note.
    readonly property var openByNote: {
        const m = {}
        for (const t of AppState.tasks) if (!t.checked) m[t.noteId] = (m[t.noteId] || 0) + 1
        return m
    }
    readonly property var groups: {
        const flat = notes.length <= 15 || byTitle
        const out = []
        for (const n of notes) {
            const label = flat ? "" : (n.is_pinned ? "Pinned" : Fmt.timeGroup(n.updated_at))
            let g = out.length ? out[out.length - 1] : null
            if (!g || g.label !== label) { g = { label, notes: [] }; out.push(g) }
            g.notes.push(n)
        }
        return out
    }

    // ── heading ──────────────────────────────────────────────────────
    Text {
        text: "List · " + Fmt.plural(page.notes.length, "note")
        color: Theme.c.muted
        font.pixelSize: 13
    }
    Item { width: 1; height: 6 }
    Text {
        width: parent.width
        text: page.list.name || ""
        color: Theme.c.ink
        font.pixelSize: 34
        font.weight: 650
        font.letterSpacing: -0.68
        lineHeightMode: Text.FixedHeight
        lineHeight: Math.round(34 * 1.15)
        wrapMode: Text.Wrap
    }
    Item { width: 1; height: 22 }
    RowLayout {
        width: parent.width
        spacing: 8
        TextButton { icon: "plus"; text: "New note"; onClicked: AppState.newNote({ listId: page.listId }) }
        Item { Layout.fillWidth: true }
        Row {
            visible: page.notes.length > 0
            spacing: 2
            Layout.rightMargin: 4
            IconButton { icon: "layout-grid"; iconSize: 15; checked: page.sheets; tooltip: "Sheets"; onClicked: AppState.setListLayout("sheets") }
            IconButton { icon: "list"; iconSize: 15; checked: !page.sheets; tooltip: "Rows"; onClicked: AppState.setListLayout("rows") }
        }
        Rectangle {
            visible: page.notes.length > 0
            implicitWidth: sortRow.implicitWidth + 16
            implicitHeight: 32
            radius: 6
            color: sortArea.pressed ? Theme.c.pressed : (sortArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
            Row {
                id: sortRow
                anchors.centerIn: parent
                spacing: 6
                Text { text: page.byTitle ? "Title A–Z" : "Last edited"; color: Theme.c.secondary; font.pixelSize: 13; anchors.verticalCenter: parent.verticalCenter }
                Icon { name: "chevron-down"; size: 11; color: Theme.c.secondary; anchors.verticalCenter: parent.verticalCenter }
            }
            MouseArea {
                id: sortArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: AppState.setSort(page.byTitle ? "updated_at" : "title")
            }
        }
    }
    Item { width: 1; height: 10 }

    // ── empty ────────────────────────────────────────────────────────
    Column {
        visible: page.notes.length === 0
        width: parent.width
        Item { width: 1; height: 16 }
        Text { text: "Nothing in " + (page.list.name || "this list") + " yet."; color: Theme.c.text; font.pixelSize: 15 }
        Item { width: 1; height: 4 }
        Text {
            width: Math.min(parent.width, 460)
            text: "Notes you start here land in this list. To bring one in, click the list name under its title, or right-click it in the sidebar."
            color: Theme.c.muted
            font.pixelSize: 14
            lineHeightMode: Text.FixedHeight
            lineHeight: Math.round(14 * 1.55)
            wrapMode: Text.Wrap
        }
        Item { width: 1; height: 22 }
        Rectangle {
            width: Math.min(parent.width, 220)
            height: 180
            radius: 10
            color: emptyArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.4) : "transparent"
            // Dashed outline
            Canvas {
                id: dashes
                anchors.fill: parent
                onPaint: {
                    const ctx = getContext("2d")
                    ctx.reset()
                    ctx.strokeStyle = Theme.c.lineStrong
                    ctx.lineWidth = 1.5
                    ctx.setLineDash([5, 4])
                    ctx.beginPath()
                    ctx.roundedRect(0.75, 0.75, width - 1.5, height - 1.5, 10, 10)
                    ctx.stroke()
                }
                Connections { target: Theme; function onDarkChanged() { dashes.requestPaint() } }
            }
            Column {
                anchors.centerIn: parent
                spacing: 8
                Icon { anchors.horizontalCenter: parent.horizontalCenter; name: "plus"; size: 18; color: Theme.c.secondary }
                Text { text: "New note"; color: Theme.c.secondary; font.pointSize: Theme.pt(13.5) }
            }
            MouseArea {
                id: emptyArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: AppState.newNote({ listId: page.listId })
            }
        }
    }

    // ── notes ────────────────────────────────────────────────────────
    Repeater {
        model: page.groups
        delegate: Column {
            id: group
            required property var modelData
            required property int index
            width: parent.width

            Item { width: 1; height: group.modelData.label ? (group.index ? 40 : 18) : 0 }
            Row {
                visible: group.modelData.label !== ""
                spacing: 8
                SectionLabel { text: group.modelData.label }
                Text { text: group.modelData.notes.length; color: Theme.c.muted; font.pixelSize: 13; font.features: { "tnum": 1 } }
            }
            Item { width: 1; height: group.modelData.label ? 14 : 10 }

            // Sheets
            Grid {
                id: sheetGrid
                visible: page.sheets
                readonly property int cols: Math.max(1, Math.floor((width + 20) / (196 + 20)))
                readonly property real cellW: (width - 20 * (cols - 1)) / cols
                width: parent.width
                columns: cols
                columnSpacing: 20
                rowSpacing: 28
                Repeater {
                    model: page.sheets ? group.modelData.notes : []
                    delegate: Item {
                        id: sheet
                        required property var modelData
                        readonly property bool locked: AppState.isLocked(modelData)
                        readonly property int openHere: page.openByNote[modelData.id] || 0
                        width: sheetGrid.cellW
                        height: 180 + 10 + titleText.implicitHeight + 3 + 18

                        Rectangle {
                            id: paper
                            width: parent.width
                            height: 180
                            radius: 10
                            color: Theme.c.card
                            border.color: sheetArea.containsMouse ? Theme.c.lineStrong : Theme.c.cardLine
                            clip: true
                            Rectangle {
                                visible: !Theme.dark
                                z: -1
                                anchors.fill: parent
                                anchors.topMargin: 1
                                anchors.bottomMargin: -1
                                radius: 10
                                color: "#0A000000"
                            }
                            SheetPreview {
                                visible: !sheet.locked
                                x: 16
                                y: 14
                                width: parent.width - 32
                                blocks: sheet.locked ? [] : (page.previews[sheet.modelData.id] || [])
                            }
                            Column {
                                visible: sheet.locked
                                anchors.centerIn: parent
                                spacing: 8
                                Icon { anchors.horizontalCenter: parent.horizontalCenter; name: "lock"; size: 18; color: Theme.c.muted }
                                Text { text: "Locked"; color: Theme.c.muted; font.pointSize: Theme.pt(12.5) }
                            }
                            // Fade out the bottom of the page.
                            Rectangle {
                                anchors.bottom: parent.bottom
                                anchors.bottomMargin: 1
                                x: 1
                                width: parent.width - 2
                                height: 44
                                gradient: Gradient {
                                    GradientStop { position: 0; color: Qt.alpha(Theme.c.card, 0) }
                                    GradientStop { position: 0.85; color: Theme.c.card }
                                }
                            }
                        }
                        Text {
                            id: titleText
                            y: 190
                            width: parent.width
                            text: sheet.modelData.title || "Untitled"
                            color: Theme.c.ink
                            font.pointSize: Theme.pt(14.5)
                            font.weight: Font.Medium
                            lineHeightMode: Text.FixedHeight
                            lineHeight: Math.round(14.5 * 1.35)
                            wrapMode: Text.Wrap
                            maximumLineCount: 2
                            elide: Text.ElideRight
                        }
                        Row {
                            y: titleText.y + titleText.height + 3
                            spacing: 6
                            Icon { visible: !!sheet.modelData.is_pinned; name: "pin"; size: 12; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
                            Text {
                                text: Fmt.edited(sheet.modelData.updated_at) + (sheet.openHere && !sheet.locked ? "  ·  " + sheet.openHere + " open" : "")
                                color: Theme.c.muted
                                font.pointSize: Theme.pt(12.5)
                                font.features: { "tnum": 1 }
                            }
                        }
                        MouseArea {
                            id: sheetArea
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: AppState.openNote(sheet.modelData.id)
                        }
                    }
                }
            }

            // Rows
            Column {
                visible: !page.sheets
                width: parent.width
                spacing: 2
                Repeater {
                    model: page.sheets ? [] : group.modelData.notes
                    delegate: Rectangle {
                        id: noteRow
                        required property var modelData
                        readonly property bool locked: AppState.isLocked(modelData)
                        readonly property int openHere: page.openByNote[modelData.id] || 0
                        readonly property string meta: locked ? "" : [openHere ? Fmt.plural(openHere, "open to-do") : "",
                                                                      (modelData.tags || []).map(t => "#" + t).join(" ")].filter(s => s).join(" · ")
                        x: -12
                        width: parent.width + 24
                        height: rowCol.implicitHeight + 28
                        radius: 8
                        color: rowArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.5) : "transparent"
                        ColumnLayout {
                            id: rowCol
                            x: 12
                            y: 14
                            width: parent.width - 24
                            spacing: 0
                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 16
                                Text {
                                    Layout.fillWidth: true
                                    text: noteRow.modelData.title || "Untitled"
                                    color: Theme.c.ink
                                    font.pixelSize: 15
                                    font.weight: Font.Medium
                                    lineHeightMode: Text.FixedHeight
                                    lineHeight: Math.round(15 * 1.4)
                                    wrapMode: Text.Wrap
                                    maximumLineCount: 2
                                    elide: Text.ElideRight
                                }
                                Row {
                                    Layout.alignment: Qt.AlignTop
                                    Layout.topMargin: 2
                                    spacing: 6
                                    Icon { visible: !!noteRow.modelData.is_pinned; name: "pin"; size: 13; color: Theme.c.muted }
                                    Text { text: Fmt.edited(noteRow.modelData.updated_at); color: Theme.c.muted; font.pointSize: Theme.pt(12.5) }
                                }
                            }
                            Text {
                                visible: AppState.showPreview
                                Layout.fillWidth: true
                                Layout.topMargin: 4
                                text: noteRow.locked ? "Locked" : (noteRow.modelData.preview || "").replace(/\s+/g, " ")
                                color: Theme.c.tertiary
                                font.pointSize: Theme.pt(13.5)
                                lineHeightMode: Text.FixedHeight
                                lineHeight: Math.round(13.5 * 1.5)
                                wrapMode: Text.Wrap
                                maximumLineCount: 2
                                elide: Text.ElideRight
                            }
                            Text {
                                visible: noteRow.meta !== ""
                                Layout.topMargin: 6
                                text: noteRow.meta
                                color: Theme.c.muted
                                font.pointSize: Theme.pt(12.5)
                            }
                        }
                        MouseArea {
                            id: rowArea
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: AppState.openNote(noteRow.modelData.id)
                        }
                    }
                }
            }
        }
    }

    // ── right column ─────────────────────────────────────────────────
    asideContent: [
        Column {
            id: openCol
            width: parent.width
            readonly property var open: AppState.tasks.filter(t => !t.checked && t.listId === page.listId)
            SectionLabel { text: "Open in " + (page.list.name || "this list") }
            Item { width: 1; height: 6 }
            Repeater {
                model: openCol.open.slice(0, 12)
                delegate: SideTask {
                    required property var modelData
                    width: openCol.width
                    task: modelData
                    source: modelData.title || "Untitled"
                    when: Fmt.dueLabel(modelData.due, AppState.todayIso)
                    overdue: Fmt.dueGroup(modelData.due, AppState.todayIso) === "over"
                    onOpenRequested: AppState.openTask(modelData)
                    onToggled: AppState.setTaskDone(modelData, true)
                }
            }
            Text {
                visible: openCol.open.length === 0
                topPadding: 6
                text: "Nothing open in this list."
                color: Theme.c.muted
                font.pixelSize: 14
            }
        },
        Item { width: 1; height: 34 },
        SectionLabel { text: "Colour" },
        Item { width: 1; height: 10 },
        Flow {
            width: parent.width
            spacing: 10
            Repeater {
                model: Theme.pickerSwatches
                delegate: Item {
                    id: sw
                    required property var modelData
                    readonly property bool on: page.list.color === modelData.name
                    width: 22
                    height: 22
                    Rectangle {
                        visible: sw.on
                        anchors.centerIn: parent
                        width: 29
                        height: 29
                        radius: 14.5
                        color: "transparent"
                        border.width: 1.5
                        border.color: Theme.swatch(sw.modelData.name)
                    }
                    Rectangle { anchors.fill: parent; radius: 11; color: Theme.swatch(sw.modelData.name) }
                    MouseArea {
                        id: swArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: Store.updateList(page.listId, { color: sw.modelData.name })
                    }
                    Tip { visible: swArea.containsMouse; text: sw.modelData.label }
                }
            }
        }
    ]
}
