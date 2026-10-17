import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Search everything: notes, to-dos and open files, with tabs, list and tag
// filters on the right, and recent searches when the field is empty.
// `#name` shows the notes with that tag.
PageColumns {
    id: page

    property bool active: false
    property string query: ""
    property string tab: "all"
    property var listFilter: ({})   // list id ("" = daily notes) -> true
    property var tagFilter: ({})    // tag name -> true
    property var recent: []
    asideTop: 106

    onActiveChanged: {
        if (!active) return
        query = AppState.viewId
        field.text = query
        tab = "all"
        listFilter = ({})
        tagFilter = ({})
        try { recent = JSON.parse(Store.setting("qt.recentSearches", "[]")) } catch (e) { recent = [] }
        run()
        Qt.callLater(() => { field.forceActiveFocus(); field.selectAll() })
    }
    Connections {
        target: AppState
        function onViewIdChanged() { if (page.active && AppState.viewId !== page.query) { page.query = AppState.viewId; field.text = page.query; page.run() } }
    }
    Connections {
        target: Store
        function onNotesChanged() { if (page.active && page.query.trim() !== "") rerun.restart() }
    }
    Timer { id: rerun; interval: 300; onTriggered: page.run() }
    Timer { id: typing; interval: 140; onTriggered: { page.query = field.text; page.tab = "all"; page.run() } }

    function remember(q) {
        q = q.trim()
        if (q === "") return
        const r = [q].concat(recent.filter(x => x.toLowerCase() !== q.toLowerCase())).slice(0, 6)
        recent = r
        AppState.save("qt.recentSearches", JSON.stringify(r))
    }
    function open(id) { remember(query); AppState.openNote(id) }

    // ── results ──────────────────────────────────────────────────────
    readonly property string q: query.trim()
    readonly property bool tagMode: /^#\S+$/.test(q)
    readonly property string needle: tagMode ? "" : q
    property var noteHits: []
    function run() {
        if (q === "") { noteHits = []; return }
        if (tagMode) {
            noteHits = Store.notesWithTag(q.slice(1).toLowerCase()).map(n => Object.assign({}, n, {
                is_locked: AppState.isLocked(n), snippet: AppState.isLocked(n) ? "" : (n.preview || "").replace(/\s+/g, " ").slice(0, 200), hits: 0
            }))
        } else noteHits = Store.searchNotes(q, 200)
    }
    readonly property bool anyList: Object.keys(listFilter).length > 0
    readonly property bool anyTag: Object.keys(tagFilter).length > 0
    function listKey(n) { return n.is_daily || !n.list_id ? "" : n.list_id }
    function passes(listKeyV, tags) {
        if (anyList && !listFilter[listKeyV]) return false
        if (anyTag && !(tags || []).some(t => tagFilter[t])) return false
        return true
    }
    readonly property var notes: noteHits.filter(n => passes(listKey(n), n.tags))
    readonly property var todos: {
        if (needle === "") return []
        const low = needle.toLowerCase()
        return AppState.tasks.filter(t => t.text.toLowerCase().indexOf(low) >= 0)
            .filter(t => passes(t.isDaily || !t.listId ? "" : t.listId, (noteHits.find(n => n.id === t.noteId) || {}).tags || []))
    }
    readonly property var files: {
        if (needle === "" || anyList || anyTag) return []
        const low = needle.toLowerCase()
        const out = []
        for (const f of Files.files) {
            const n = Files.note(f.id)
            const text = n.content || ""
            const at = text.toLowerCase().indexOf(low)
            if (f.name.toLowerCase().indexOf(low) < 0 && at < 0) continue
            const flat = text.replace(/\s+/g, " ")
            const fa = flat.toLowerCase().indexOf(low)
            const from = fa > 60 ? flat.lastIndexOf(" ", fa - 40) + 1 : 0
            out.push({ id: f.id, name: f.name, path: f.path, updated_at: n.updated_at,
                       snippet: (from > 0 ? "…" : "") + flat.slice(from, from + 180) })
        }
        return out
    }
    readonly property int total: notes.length + todos.length + files.length

    // Filter counts follow the query, not the filters.
    readonly property var listCounts: { const m = {}; for (const n of noteHits) { const k = listKey(n); m[k] = (m[k] || 0) + 1 } return m }
    readonly property var tagCounts: { const m = {}; for (const n of noteHits) for (const t of (n.tags || [])) m[t] = (m[t] || 0) + 1; return m }

    readonly property var sections: {
        const cap = tab === "all"
        const s = []
        if ((tab === "all" || tab === "notes") && notes.length) s.push({ id: "notes", heading: "Notes", all: notes, items: cap ? notes.slice(0, 4) : notes })
        if ((tab === "all" || tab === "todos") && todos.length) s.push({ id: "todos", heading: "To-dos", all: todos, items: cap ? todos.slice(0, 3) : todos })
        if ((tab === "all" || tab === "files") && files.length) s.push({ id: "files", heading: "Files", all: files, items: cap ? files.slice(0, 3) : files })
        return s
    }

    function hl(text) { return Fmt.highlight(text, page.needle, Theme.c.hl, Theme.c.ink) }

    // ── field ────────────────────────────────────────────────────────
    Text {
        textFormat: Text.PlainText
        text: page.q === "" ? "Search" : "Search · " + Fmt.plural(page.total, "result")
        color: Theme.c.muted
        font.pixelSize: 13
        font.features: { "tnum": 1 }
    }
    Item { width: 1; height: 8 }
    Rectangle {
        width: parent.width
        height: 54
        radius: 10
        color: Theme.c.field
        border.color: field.activeFocus ? Theme.c.accent : Theme.c.lineStrong
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 16
            anchors.rightMargin: 10
            spacing: 12
            Icon { name: "search"; size: 18; color: Theme.c.muted }
            Field {
                id: field
                Layout.fillWidth: true
                bare: true
                implicitHeight: 44
                font.pixelSize: 20
                font.weight: Font.Medium
                font.letterSpacing: -0.2
                placeholderText: "Search notes, to-dos and files"
                onTextEdited: typing.restart()
                onAccepted: { typing.stop(); page.query = text; page.run(); page.remember(text) }
                Keys.onEscapePressed: (e) => { if (text !== "") { text = ""; page.query = ""; page.run(); e.accepted = true } else e.accepted = false }
            }
            IconButton {
                visible: field.text !== ""
                size: 30
                iconSize: 14
                icon: "x"
                tooltip: "Clear search"
                onClicked: { field.text = ""; page.query = ""; page.run(); field.forceActiveFocus() }
            }
        }
    }

    Item { visible: page.q !== ""; width: 1; height: 20 }
    Tabs {
        visible: page.q !== ""
        width: parent.width
        current: page.tab
        tabs: [
            { id: "all", label: "All", count: String(page.total) },
            { id: "notes", label: "Notes", count: String(page.notes.length) },
            { id: "todos", label: "To-dos", count: String(page.todos.length) },
            { id: "files", label: "Files", count: String(page.files.length) }
        ]
        onPicked: (id) => page.tab = id
    }

    Repeater {
        model: page.sections
        delegate: Column {
            id: sec
            required property var modelData
            required property int index
            width: parent.width
            topPadding: index ? 34 : (page.tab === "all" ? 26 : 14)

            Row {
                visible: page.tab === "all"
                spacing: 8
                bottomPadding: 4
                SectionLabel { text: sec.modelData.heading }
                Text { textFormat: Text.PlainText; text: sec.modelData.all.length; color: Theme.c.muted; font.pixelSize: 13; font.features: { "tnum": 1 } }
            }

            Repeater {
                model: sec.modelData.items
                delegate: Loader {
                    required property var modelData
                    width: sec.width
                    sourceComponent: sec.modelData.id === "todos" ? todoResult : (sec.modelData.id === "files" ? fileResult : noteResult)
                    property var item_: modelData
                }
            }
            Item { visible: sec.modelData.all.length > sec.modelData.items.length; width: 1; height: 6 }
            TextButton {
                visible: sec.modelData.all.length > sec.modelData.items.length
                variant: "link"
                fontSize: 13.5
                text: "Show all " + sec.modelData.all.length + " " + sec.modelData.heading.toLowerCase()
                onClicked: page.tab = sec.modelData.id
            }
        }
    }

    Component {
        id: noteResult
        Rectangle {
            readonly property var n: parent ? parent.item_ : ({})
            readonly property var list: AppState.listById(n.list_id)
            readonly property string extra: [n.hits > 1 ? n.hits + " matches" : "", (n.tags || []).map(t => "#" + t).join(" ")].filter(s => s).join(" · ")
            x: -12
            width: parent ? parent.width + 24 : 0
            height: noteCol.implicitHeight + 24
            radius: 8
            color: noteArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.5) : "transparent"
            ColumnLayout {
                id: noteCol
                x: 12
                y: 12
                width: parent.width - 24
                spacing: 0
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 12
                    Text {
                        Layout.fillWidth: true
                        text: page.hl(n.title || "Untitled")
                        textFormat: Text.RichText
                        color: Theme.c.ink
                        font.pixelSize: 15
                        font.weight: Font.Medium
                        elide: Text.ElideRight
                    }
                    Text { textFormat: Text.PlainText; text: Fmt.edited(n.updated_at); color: Theme.c.muted; font.pointSize: Theme.pt(12.5); font.features: { "tnum": 1 } }
                }
                RowLayout {
                    Layout.fillWidth: true
                    Layout.topMargin: 4
                    spacing: 6
                    Icon { visible: !!n.is_locked; name: "lock"; size: 12; color: Theme.c.tertiary; Layout.alignment: Qt.AlignTop; Layout.topMargin: 3 }
                    Text {
                        Layout.fillWidth: true
                        text: n.is_locked ? "Locked" : page.hl(n.snippet || "")
                        textFormat: Text.RichText
                        color: Theme.c.tertiary
                        font.pointSize: Theme.pt(13.5)
                        lineHeightMode: Text.FixedHeight
                        lineHeight: 21
                        wrapMode: Text.Wrap
                        maximumLineCount: 2
                        elide: Text.ElideRight
                    }
                }
                Row {
                    Layout.topMargin: 6
                    spacing: 7
                    Rectangle {
                        width: 7
                        height: 7
                        radius: 3.5
                        anchors.verticalCenter: parent.verticalCenter
                        color: list ? Theme.swatch(list.color) : Theme.c.faint
                    }
                    Text {
                        textFormat: Text.PlainText
                        text: (list ? list.name : (n.is_daily ? "Daily notes" : "Notes")) + (extra ? "  ·  " + extra : "")
                        color: Theme.c.muted
                        font.pointSize: Theme.pt(12.5)
                    }
                }
            }
            MouseArea {
                id: noteArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: page.open(n.id)
            }
        }
    }

    Component {
        id: todoResult
        Item {
            id: todo
            readonly property var t: parent ? parent.item_ : ({})
            property bool done: !!t.checked
            readonly property string dueKey: Fmt.dueGroup(t.due, AppState.todayIso)
            width: parent ? parent.width : 0
            height: todoCol.implicitHeight + 20
            Checkbox {
                y: 12
                checked: todo.done
                onToggled: { todo.done = !todo.done; AppState.setTaskDone(todo.t, todo.done) }
            }
            ColumnLayout {
                id: todoCol
                x: 30
                y: 10
                width: parent.width - 30
                spacing: 2
                Text {
                    Layout.fillWidth: true
                    text: page.hl(todo.t.text)
                    textFormat: Text.RichText
                    color: todo.done ? Theme.c.muted : Theme.c.ink2
                    font.pixelSize: 15
                    font.strikeout: todo.done
                    wrapMode: Text.Wrap
                }
                Text {
                    textFormat: Text.PlainText
                    text: (todo.t.isDaily && todo.t.dailyDate === AppState.todayIso ? "Today’s note" : (todo.t.title || "Untitled"))
                          + (todo.done ? "  ·  Done" : (todo.t.due ? "  ·  " + Fmt.dueLabel(todo.t.due, AppState.todayIso) : ""))
                    color: todo.dueKey === "over" && !todo.done ? Theme.c.red : Theme.c.muted
                    font.pointSize: Theme.pt(12.5)
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: { page.remember(page.query); AppState.openTask(todo.t) }
                    }
                }
            }
        }
    }

    Component {
        id: fileResult
        Rectangle {
            readonly property var f: parent ? parent.item_ : ({})
            x: -12
            width: parent ? parent.width + 24 : 0
            height: fileCol.implicitHeight + 24
            radius: 8
            color: fileArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.5) : "transparent"
            ColumnLayout {
                id: fileCol
                x: 12
                y: 12
                width: parent.width - 24
                spacing: 0
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 12
                    Text { Layout.fillWidth: true; text: page.hl(f.name); textFormat: Text.RichText; color: Theme.c.ink; font.pixelSize: 15; font.weight: Font.Medium; elide: Text.ElideRight }
                    Text { textFormat: Text.PlainText; text: Fmt.edited(f.updated_at); color: Theme.c.muted; font.pointSize: Theme.pt(12.5) }
                }
                Text {
                    Layout.fillWidth: true
                    Layout.topMargin: 4
                    text: page.hl(f.snippet)
                    textFormat: Text.RichText
                    color: Theme.c.tertiary
                    font.pointSize: Theme.pt(13.5)
                    lineHeightMode: Text.FixedHeight
                    lineHeight: 21
                    wrapMode: Text.Wrap
                    maximumLineCount: 2
                    elide: Text.ElideRight
                }
                Row {
                    Layout.topMargin: 6
                    Layout.fillWidth: true
                    spacing: 7
                    Icon { name: "file"; size: 13; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
                    Text { textFormat: Text.PlainText; width: fileCol.width - 20; text: f.path; color: Theme.c.muted; font.pointSize: Theme.pt(12.5); elide: Text.ElideMiddle }
                }
            }
            MouseArea {
                id: fileArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: page.open(f.id)
            }
        }
    }

    // ── nothing found ────────────────────────────────────────────────
    Column {
        visible: page.q !== "" && page.sections.length === 0
        width: parent.width
        topPadding: 32
        Text {
            textFormat: Text.PlainText
            width: parent.width
            text: "Nothing matches “" + page.q + "”" + (page.anyList || page.anyTag ? " with these filters." : ".")
            color: Theme.c.text
            font.pixelSize: 15
            wrapMode: Text.Wrap
        }
        Text {
            textFormat: Text.PlainText
            width: Math.min(parent.width, 460)
            topPadding: 4
            text: page.anyList || page.anyTag ? "Try clearing the filters on the right." : "Check the spelling, or try a shorter word. Locked notes are matched by title only."
            color: Theme.c.muted
            font.pixelSize: 14
            lineHeightMode: Text.FixedHeight
            lineHeight: 22
            wrapMode: Text.Wrap
        }
        Item { visible: page.anyList || page.anyTag; width: 1; height: 16 }
        TextButton { visible: page.anyList || page.anyTag; text: "Clear filters"; onClicked: { page.listFilter = ({}); page.tagFilter = ({}) } }
    }

    // ── empty field ──────────────────────────────────────────────────
    Column {
        visible: page.q === ""
        width: parent.width
        Item { visible: page.recent.length > 0; width: 1; height: 32 }
        SectionLabel { visible: page.recent.length > 0; text: "Recent searches"; bottomPadding: 6 }
        Repeater {
            model: page.recent
            delegate: Rectangle {
                required property string modelData
                x: -12
                width: parent.width + 24
                height: 38
                radius: 7
                color: recentArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent"
                Row {
                    x: 12
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 12
                    Icon { name: "history"; size: 15; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
                    Text { textFormat: Text.PlainText; text: modelData; color: Theme.c.ink2; font.pointSize: Theme.pt(14.5); anchors.verticalCenter: parent.verticalCenter }
                }
                MouseArea {
                    id: recentArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: { field.text = modelData; page.query = modelData; page.run() }
                }
            }
        }
        Text {
            textFormat: Text.PlainText
            width: Math.min(parent.width, 480)
            topPadding: 22
            text: "Searches titles, text and to-dos in every list, plus the files you have open. Locked notes are matched by title only."
            color: Theme.c.muted
            font.pointSize: Theme.pt(13.5)
            lineHeightMode: Text.FixedHeight
            lineHeight: 21
            wrapMode: Text.Wrap
        }
    }

    // ── filters ──────────────────────────────────────────────────────
    asideContent: [
        Column {
            visible: page.q !== "" && !page.tagMode
            width: parent.width
            spacing: 30
            Column {
                width: parent.width
                SectionLabel { text: "Lists"; bottomPadding: 6 }
                Repeater {
                    model: [{ id: "", name: "Daily notes", color: "" }].concat(AppState.lists).filter(l => page.listCounts[l.id] || page.listFilter[l.id])
                    delegate: FilterRow {
                        required property var modelData
                        width: parent.width
                        folderColor: modelData.color ? Theme.swatch(modelData.color) : Theme.c.faint
                        label: modelData.name
                        count: page.listCounts[modelData.id] || 0
                        checked: !!page.listFilter[modelData.id]
                        onToggled: {
                            const m = Object.assign({}, page.listFilter)
                            if (m[modelData.id]) delete m[modelData.id]
                            else m[modelData.id] = true
                            page.listFilter = m
                        }
                    }
                }
            }
            Column {
                visible: Object.keys(page.tagCounts).length > 0
                width: parent.width
                SectionLabel { text: "Tags"; bottomPadding: 6 }
                Repeater {
                    model: Object.keys(page.tagCounts).sort((a, b) => page.tagCounts[b] - page.tagCounts[a] || a.localeCompare(b)).slice(0, 6)
                    delegate: FilterRow {
                        required property string modelData
                        width: parent.width
                        label: "#" + modelData
                        count: page.tagCounts[modelData]
                        checked: !!page.tagFilter[modelData]
                        onToggled: {
                            const m = Object.assign({}, page.tagFilter)
                            if (m[modelData]) delete m[modelData]
                            else m[modelData] = true
                            page.tagFilter = m
                        }
                    }
                }
            }
            TextButton {
                visible: page.anyList || page.anyTag
                variant: "link"
                fontSize: 13.5
                text: "Clear filters"
                onClicked: { page.listFilter = ({}); page.tagFilter = ({}) }
            }
        }
    ]

    component FilterRow: Item {
        id: fr
        property string label: ""
        property int count: 0
        property bool checked: false
        property color folderColor: "transparent"
        signal toggled()
        height: 32
        Row {
            anchors.verticalCenter: parent.verticalCenter
            spacing: 10
            Checkbox { small: true; checked: fr.checked; anchors.verticalCenter: parent.verticalCenter; onToggled: fr.toggled() }
            Icon { visible: fr.folderColor.a > 0; name: "folder"; size: 15; color: fr.folderColor; anchors.verticalCenter: parent.verticalCenter }
            Text { textFormat: Text.PlainText; text: fr.label; color: Theme.c.ink2; font.pixelSize: 14; anchors.verticalCenter: parent.verticalCenter }
        }
        Text {
            textFormat: Text.PlainText
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: fr.count
            color: Theme.c.muted
            font.pointSize: Theme.pt(12.5)
            font.features: { "tnum": 1 }
        }
        MouseArea { anchors.fill: parent; anchors.leftMargin: 26; cursorShape: Qt.PointingHandCursor; onClicked: fr.toggled() }
    }
}
