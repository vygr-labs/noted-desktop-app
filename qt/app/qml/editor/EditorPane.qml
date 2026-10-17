import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtQuick.Dialogs
import Noted

// Right column: note chrome + editor. Loads note content only when the
// selected note changes (or an external write lands while idle), never in
// response to its own saves.
Rectangle {
    id: pane
    color: Theme.c.window

    readonly property var note: AppState.currentNote
    readonly property bool hasNote: !!note.id
    readonly property bool isPlain: note.note_type === "plain"
    readonly property bool inTrash: !!note.is_trashed
    // A file opened from disk: no title, tags, pin or lock — just its text.
    readonly property bool isFile: !!note.is_file
    readonly property bool locked: hasNote && !!note.is_locked && !unlockedTick && !Store.isUnlocked(note.id)
    property bool unlockedTick: false
    property string loadedId: ""
    // The note opens with an H1 that repeats its title: show it once (the
    // heading), and keep the title following that heading while it's edited.
    property bool titleMerged: false
    Connections {
        target: rich.controller
        function onStatsChanged() {
            if (!pane.titleMerged) return
            const h = rich.controller.leadingHeading
            if (h === "") { pane.titleMerged = false; return }
            if (h !== pane.note.title) titleSync.restart()
        }
    }
    Timer {
        id: titleSync
        interval: 500
        onTriggered: {
            const h = rich.controller.leadingHeading
            if (pane.titleMerged && h !== "" && pane.hasNote && pane.loadedId === pane.note.id && h !== pane.note.title)
                Store.updateNote(pane.note.id, { title: h })
        }
    }
    readonly property var taskDecos: pane.isPlain ? [] : rich.controller.decorations.filter(d => d.k === "task")
    readonly property int taskTotal: taskDecos.length
    readonly property int taskDone: taskDecos.filter(d => d.checked).length
    // Room left for the floating window buttons (see Main.qml).
    property real chromeRight: 138
    // Minimum gap between the text and the pane's edges.
    readonly property real textInset: 56
    // The text column, centred unless "Full width" is on. It grows with the
    // pane (about 62% of it) so a wide monitor isn't mostly margin, but stays
    // between ~75 and ~105 characters so lines remain easy to follow.
    readonly property real columnWidth: AppState.fullWidth
        ? scroller.width - 2 * textInset
        : Math.min(scroller.width - 2 * textInset,
                   Math.max(680 * Theme.textScale, Math.min(960 * Theme.textScale, Math.round(scroller.width * 0.62))))
    // Left edge of the text (and of the toolbar and status line).
    readonly property real columnX: Math.max(textInset, Math.round((scroller.width - columnWidth) / 2))
    readonly property string tbPos: AppState.toolbarPosition
    readonly property bool showToolbar: hasNote && !isPlain && !inTrash && !locked && tbPos !== "hidden"

    function flush() {
        rich.controller.flush()
        plain.flush()
    }
    function cleanAndFormat() { if (!isPlain) rich.controller.cleanAndFormat() }

    function loadCurrent(force) {
        if (!hasNote) {
            if (loadedId !== "") { flush(); rich.controller.unload(); loadedId = "" }
            return
        }
        if (!force && loadedId === note.id) return
        flush()
        const n = AppState.noteData(note.id)
        if (locked) {
            rich.controller.unload()
            plain.load("", "")
            loadedId = ""
            return
        }
        if (n.note_type === "plain") {
            rich.controller.unload()
            plain.load(n.id, n.content || "")
        } else {
            plain.load("", "")
            rich.load(n.id, n.content || "")
        }
        titleSync.stop()
        titleMerged = !n.is_file && n.note_type !== "plain" && (n.title || "") !== ""
                      && rich.controller.leadingHeading.toLowerCase() === n.title.replace(/\s+/g, " ").trim().toLowerCase()
        const reloaded = loadedId === n.id
        loadedId = n.id
        if (!reloaded) scroller.contentY = 0
    }

    Connections {
        target: AppState
        function onSelectedNoteIdChanged() { pane.unlockedTick = false; pane.loadCurrent(false) }
        function onFocusTitleRequested(selectAll) { Qt.callLater(() => header.focusTitle(selectAll)) }
        function onFocusEditorRequested() { pane.focusBody() }
        function onEditorTaskToggleRequested(index) {
            const t = pane.taskDecos
            if (index >= 0 && index < t.length && !t[index].checked) rich.controller.toggleTask(t[index].block)
        }
    }
    Connections {
        target: Store
        // noted-cli (or another instance) wrote to the database.
        function onExternalChange() {
            if (!pane.hasNote) return
            if (!rich.controller.dirty && !plain.dirty) pane.loadCurrent(true)
        }
    }
    Connections {
        target: Files
        // Another program changed the open file. Unsaved edits here win (they
        // save over it); otherwise show what's on disk now.
        function onExternallyChanged(id) {
            if (id !== pane.note.id) return
            if (rich.controller.dirty || plain.dirty) AppState.toast(pane.note.title + " changed on disk; your edits here will replace it")
            else pane.loadCurrent(true)
        }
    }
    onIsPlainChanged: if (hasNote) loadCurrent(true)
    onLockedChanged: loadCurrent(true)
    Component.onCompleted: loadCurrent(false)

    property real pendingScroll: -1
    function scrollTo(y) { pendingScroll = y; applyPendingScroll() }
    function applyPendingScroll() {
        if (pendingScroll < 0 || scroller.contentHeight < pendingScroll + scroller.height) return
        scroller.contentY = pendingScroll
        pendingScroll = -1
    }

    function focusBody() {
        if (isPlain) plain.focusEnd()
        else rich.focusStart()
    }

    function ensureVisible(r, editorItem) {
        const top = editorItem.mapToItem(scroller.contentItem, 0, r.y).y
        const margin = 60
        if (top < scroller.contentY + margin) scroller.contentY = Math.max(0, top - margin)
        else if (top + r.height > scroller.contentY + scroller.height - margin)
            scroller.contentY = Math.min(scroller.contentHeight - scroller.height, top + r.height - scroller.height + margin)
    }

    PopupMenu { id: menu }

    FileDialog {
        id: exportDialog
        property string format: "md"
        fileMode: FileDialog.SaveFile
        title: "Export note"
        onAccepted: {
            const err = App.exportNote(pane.note.id, format, selectedFile)
            AppState.toast(err === "" ? "Exported" : "Export failed: " + err)
        }
    }
    function exportAs(fmt) {
        const filters = { pdf: "PDF (*.pdf)", doc: "Word document (*.doc)", html: "HTML (*.html)", md: "Markdown (*.md)", txt: "Text (*.txt)" }
        exportDialog.format = fmt
        exportDialog.nameFilters = [filters[fmt]]
        exportDialog.selectedFile = App.suggestedFileName(note.id, fmt)
        exportDialog.open()
    }

    DragArea {
        visible: !pane.hasNote
        width: parent.width
        height: 52
    }

    // ── empty state ──────────────────────────────────────────────────
    ColumnLayout {
        visible: !pane.hasNote
        anchors.centerIn: parent
        spacing: 10
        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            width: 64
            height: 64
            radius: Theme.radiusXl
            color: Theme.c.hover
            Icon { anchors.centerIn: parent; name: "pen-line"; size: 26; color: Theme.c.subtle }
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "No note selected"
            color: Theme.c.text
            font.pixelSize: Theme.fontXl
            font.weight: Font.DemiBold
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "Pick a note from the list, or start a new one."
            color: Theme.c.muted
            font.pixelSize: Theme.fontMd
        }
        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 6
            spacing: 8
            TextButton { text: "New note"; icon: "plus"; variant: "primary"; onClicked: AppState.newNote() }
            TextButton { text: "Search"; icon: "search"; onClicked: AppState.paletteOpen = true }
        }
        Row {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 10
            spacing: 14
            Repeater {
                model: [["Ctrl N", "new note"], ["Ctrl P", "search"], ["Ctrl .", "today"]]
                delegate: Row {
                    required property var modelData
                    spacing: 6
                    Kbd { text: parent.modelData[0] }
                    Text { text: parent.modelData[1]; color: Theme.c.subtle; font.pixelSize: Theme.fontSm; anchors.verticalCenter: parent.verticalCenter }
                }
            }
        }
    }

    IconButton {
        visible: !pane.hasNote && AppState.noteListCollapsed
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.margins: 10
        icon: "chevrons-right"
        tooltip: "Show note list"
        onClicked: AppState.noteListCollapsed = false
    }

    // ── note ─────────────────────────────────────────────────────────
    ColumnLayout {
        anchors.fill: parent
        spacing: 0
        visible: pane.hasNote

        // Header: history, breadcrumb (list / title), note actions. Drags
        // the window; the window buttons float over its right end.
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 52
            z: 2
            DragArea { anchors.fill: parent }
            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: Theme.c.divider
                opacity: scroller.contentY > 2 && !(pane.showToolbar && pane.tbPos === "top") ? 1 : 0
                Behavior on opacity { NumberAnimation { duration: 150 } }
            }
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 14
                anchors.rightMargin: pane.chromeRight + 8
                spacing: 2

                IconButton {
                    visible: AppState.noteListCollapsed || AppState.focusMode
                    icon: "chevrons-right"
                    size: 28
                    tooltip: AppState.focusMode ? "Exit focus mode" : "Show note list"
                    shortcut: AppState.focusMode ? "F11" : "Ctrl+["
                    dim: true
                    onClicked: { AppState.focusMode = false; AppState.noteListCollapsed = false }
                }
                IconButton {
                    icon: "arrow-left"
                    size: 28
                    iconSize: 15
                    dim: true
                    tooltip: "Back"
                    shortcut: "Alt+Left"
                    enabled: AppState.historyIndex > 0
                    onClicked: AppState.goBack()
                }
                IconButton {
                    icon: "arrow-right"
                    size: 28
                    iconSize: 15
                    dim: true
                    tooltip: "Forward"
                    shortcut: "Alt+Right"
                    enabled: AppState.historyIndex < AppState.history.length - 1
                    onClicked: AppState.goForward()
                }
                Item { Layout.preferredWidth: 8 }

                // Breadcrumb
                RowLayout {
                    id: crumbs
                    Layout.fillWidth: true
                    spacing: 6
                    readonly property var list: {
                        const id = pane.note.list_id
                        if (!id) return null
                        for (const l of AppState.lists.concat(AppState.hiddenLists)) if (l.id === id) return l
                        return null
                    }
                    // The title is already on the page; repeat it here only once it scrolls off.
                    // A file has no title on the page, so its name always shows.
                    readonly property bool showTitle: pane.isFile || scroller.contentY > 90
                    // A file's folder, e.g. "Documents".
                    readonly property string folder: pane.isFile ? (pane.note.file_path || "").split(/[\\/]/).slice(-2, -1)[0] || "" : ""
                    readonly property string root: pane.isFile ? crumbs.folder : pane.inTrash ? "Trash" : pane.note.is_daily ? "Daily notes" : crumbs.list ? crumbs.list.name : "All Notes"
                    Rectangle {
                        visible: crumbs.list !== null && !pane.inTrash && !pane.note.is_daily
                        width: 7
                        height: 7
                        radius: 2
                        color: Theme.swatch(crumbs.list ? crumbs.list.color : "gray")
                    }
                    Text {
                        text: crumbs.root
                        color: rootArea.containsMouse ? Theme.c.text : Theme.c.muted
                        font.pixelSize: 13
                        elide: Text.ElideRight
                        Layout.maximumWidth: 200
                        MouseArea {
                            id: rootArea
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (pane.isFile) App.revealFile(pane.note.file_path)
                                else if (pane.inTrash) AppState.setView("trash")
                                else if (pane.note.is_daily) AppState.setView("today")
                                else if (crumbs.list) AppState.setView("list", crumbs.list.id)
                                else AppState.setView("all")
                            }
                        }
                    }
                    Text { visible: crumbs.showTitle; text: "/"; color: Theme.c.faint; font.pixelSize: 13 }
                    Text {
                        opacity: crumbs.showTitle ? 1 : 0
                        Behavior on opacity { NumberAnimation { duration: 150 } }
                        text: (pane.titleMerged ? rich.controller.leadingHeading : header.liveTitle) || "Untitled"
                        color: Theme.c.text
                        font.pixelSize: 13
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }

                IconButton {
                    visible: !pane.inTrash && !pane.isFile
                    icon: pane.note.is_pinned ? "pin-off" : "pin"
                    checked: !!pane.note.is_pinned
                    size: 30
                    dim: true
                    tooltip: pane.note.is_pinned ? "Unpin" : "Pin to top"
                    onClicked: Store.setPinned(pane.note.id, !pane.note.is_pinned)
                }
                IconButton {
                    visible: !pane.inTrash && !pane.isFile
                    icon: pane.note.is_locked ? "lock" : "lock-open"
                    checked: !!pane.note.is_locked
                    size: 30
                    dim: true
                    tooltip: pane.note.is_locked ? "Unlock note" : "Lock note"
                    onClicked: AppState.toggleLock(pane.note.id)
                }
                IconButton {
                    visible: pane.isPlain && !pane.inTrash && !pane.isFile
                    icon: "type"
                    size: 30
                    dim: true
                    tooltip: "Convert to rich text"
                    onClicked: { pane.flush(); AppState.convertToRich(pane.note.id) }
                }
                IconButton {
                    id: exportButton
                    visible: !pane.locked && !pane.isFile
                    icon: "download"
                    size: 30
                    dim: true
                    tooltip: "Export"
                    onClicked: {
                        pane.flush()
                        menu.openBelow(exportButton, [
                            { header: "Export as" },
                            { text: "PDF document", icon: "file-text", action: () => pane.exportAs("pdf") },
                            { text: "Word document", icon: "file-text", action: () => pane.exportAs("doc") },
                            { text: "HTML file", icon: "code-xml", action: () => pane.exportAs("html") },
                            { text: "Markdown", icon: "hash", action: () => pane.exportAs("md") },
                            { text: "Plain text", icon: "type", action: () => pane.exportAs("txt") }
                        ])
                    }
                }
                IconButton {
                    id: moreButton
                    icon: "ellipsis"
                    size: 30
                    dim: true
                    tooltip: "More"
                    onClicked: {
                        const pos = ["top", "right", "bottom", "left", "hidden"]
                        const tb = pos.map(p => ({ text: p === "hidden" ? "Hidden" : p.charAt(0).toUpperCase() + p.slice(1),
                                                    checked: pane.tbPos === p, action: () => AppState.setToolbarPosition(p) }))
                        const view = [
                            { text: "Toolbar position", icon: "panel-top", children: tb },
                            { text: "Full width", icon: "columns-2", checked: AppState.fullWidth, action: () => AppState.setFullWidth(!AppState.fullWidth) },
                            { text: AppState.focusMode ? "Exit focus mode" : "Focus mode", icon: AppState.focusMode ? "minimize-2" : "maximize-2", shortcut: "F11", action: () => AppState.focusMode = !AppState.focusMode }
                        ]
                        const find = [
                            { text: "Find in note", icon: "search", shortcut: "Ctrl+F", action: () => { AppState.replaceOpen = false; AppState.findOpen = true } },
                            { text: "Find & replace", icon: "pencil", shortcut: "Ctrl+H", action: () => { AppState.replaceOpen = true; AppState.findOpen = true } },
                            ...(pane.isPlain ? [] : [{ text: "Clean & format", icon: "sparkles", action: () => pane.cleanAndFormat() }])
                        ]
                        const items = pane.isFile ? [
                            ...find,
                            { separator: true },
                            ...view,
                            { separator: true },
                            { text: "Show in folder", icon: "folder-open", action: () => App.revealFile(pane.note.file_path) },
                            { text: "Copy into notes", icon: "copy", action: () => { pane.flush(); AppState.copyFileToNotes(pane.note.id) } },
                            { text: "Close file", icon: "x", action: () => AppState.closeFile(pane.note.id) }
                        ] : pane.inTrash ? [
                            { text: "Restore", icon: "rotate-ccw", action: () => AppState.restoreNote(pane.note.id) },
                            { text: "Delete permanently", icon: "trash-2", danger: true, action: () => AppState.deleteForever(pane.note.id) }
                        ] : [
                            ...find,
                            { separator: true },
                            ...view,
                            { text: "Pop out", icon: "external-link", action: () => popouts.openNote(pane.note.id) },
                            { separator: true },
                            { text: "Duplicate", icon: "copy", action: () => AppState.duplicate(pane.note.id) },
                            { text: "Delete", icon: "trash-2", danger: true, action: () => AppState.trashNote(pane.note.id) }
                        ]
                        menu.openBelow(moreButton, items)
                    }
                }
                Rectangle { width: 1; height: 16; color: Theme.c.divider; Layout.leftMargin: 6 }
            }
        }

        // Toolbar (top position): a centred pill.
        Item {
            visible: pane.showToolbar && pane.tbPos === "top"
            Layout.fillWidth: true
            Layout.preferredHeight: 44
            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: Theme.c.divider
                opacity: scroller.contentY > 2 ? 1 : 0
                Behavior on opacity { NumberAnimation { duration: 150 } }
            }
            Flickable {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                anchors.bottomMargin: 6
                contentWidth: Math.max(width, topToolbar.implicitWidth)
                clip: true
                interactive: topToolbar.implicitWidth > width
                boundsBehavior: Flickable.StopAtBounds
                EditorToolbar {
                    id: topToolbar
                    editor: rich.controller
                    x: Math.max(0, pane.columnX - 26)
                    width: implicitWidth
                    height: 38
                    onLinkRequested: rich.openLinkDialog()
                }
            }
        }

        FindBar {
            id: findBar
            visible: AppState.findOpen && !pane.isPlain && !pane.locked
            Layout.fillWidth: true
            editor: rich.controller
            onClosed: { AppState.findOpen = false; rich.controller.findQuery = ""; rich.textEdit.forceActiveFocus() }
            onVisibleChanged: if (visible) Qt.callLater(focusFind)
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            EditorToolbar {
                visible: pane.showToolbar && pane.tbPos === "left"
                vertical: true
                editor: rich.controller
                Layout.topMargin: 4
                Layout.bottomMargin: 12
                Layout.leftMargin: 10
                Layout.alignment: Qt.AlignTop
                Layout.fillHeight: false
                onLinkRequested: rich.openLinkDialog()
            }

            Item {
                Layout.fillWidth: true
                Layout.fillHeight: true

                Flickable {
                    id: scroller
                    anchors.fill: parent
                    contentWidth: width
                    contentHeight: body.implicitHeight + 160
                    clip: true
                    boundsBehavior: Flickable.StopAtBounds
                    flickDeceleration: 4000
                    maximumFlickVelocity: 5000
                    ScrollBar.vertical: ScrollBarThin {}
                    visible: !pane.locked
                    onContentHeightChanged: pane.applyPendingScroll()

                    ColumnLayout {
                        id: body
                        width: pane.columnWidth
                        x: pane.columnX
                        y: pane.showToolbar && pane.tbPos === "top" ? 24 : 12
                        spacing: 14

                        Rectangle {
                            visible: pane.inTrash
                            Layout.fillWidth: true
                            Layout.preferredHeight: 40
                            radius: Theme.radiusLg
                            color: Qt.alpha(Theme.c.danger, 0.08)
                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 12
                                anchors.rightMargin: 6
                                Icon { name: "trash-2"; size: 14; color: Theme.c.dangerText }
                                Text { text: "This note is in the trash."; color: Theme.c.dangerText; font.pixelSize: Theme.fontMd; Layout.fillWidth: true }
                                TextButton { text: "Restore"; compact: true; onClicked: AppState.restoreNote(pane.note.id) }
                            }
                        }

                        Rectangle {
                            visible: !!pane.note.is_shared && !pane.inTrash
                            Layout.fillWidth: true
                            Layout.preferredHeight: 36
                            radius: Theme.radiusLg
                            color: Theme.c.accentSubtle
                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 12
                                anchors.rightMargin: 12
                                Icon { name: "share-2"; size: 14; color: Theme.c.accentText }
                                Text {
                                    text: "Shared note — live sync isn't in the Qt build yet, so edits here stay on this device."
                                    color: Theme.c.accentText
                                    font.pixelSize: Theme.fontSm
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                            }
                        }

                        NoteHeader {
                            id: header
                            visible: !pane.isFile
                            Layout.fillWidth: true
                            note: pane.note
                            readOnly: pane.inTrash
                            tags: AppState.currentTags
                            showTitle: !pane.titleMerged
                            onEnterPressed: pane.focusBody()
                        }
                        Item { visible: !pane.isFile; Layout.preferredHeight: 8 }

                        RichEditor {
                            id: rich
                            visible: !pane.isPlain
                            readOnly: pane.inTrash
                            Layout.fillWidth: true
                            onCaretMoved: (r) => { if (textEdit.activeFocus) pane.ensureVisible(r, textEdit) }
                        }
                        PlainEditor {
                            id: plain
                            visible: pane.isPlain
                            Layout.fillWidth: true
                            onCaretMoved: (r) => { if (textEdit.activeFocus) pane.ensureVisible(r, textEdit) }
                        }
                    }

                    // Clicking the empty space below the text focuses the end.
                    MouseArea {
                        y: body.y + body.implicitHeight
                        width: parent.width
                        height: Math.max(0, scroller.contentHeight - y)
                        cursorShape: Qt.IBeamCursor
                        onClicked: pane.isPlain ? plain.focusEnd() : rich.focusEnd()
                    }
                }

                LockOverlay {
                    anchors.fill: parent
                    visible: pane.locked
                    noteId: pane.note.id || ""
                    onUnlocked: pane.unlockedTick = true
                }
            }

            EditorToolbar {
                visible: pane.showToolbar && pane.tbPos === "right"
                vertical: true
                editor: rich.controller
                Layout.topMargin: 4
                Layout.bottomMargin: 12
                Layout.rightMargin: 10
                Layout.alignment: Qt.AlignTop
                Layout.fillHeight: false
                onLinkRequested: rich.openLinkDialog()
            }
        }

        Item {
            visible: pane.showToolbar && pane.tbPos === "bottom"
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            Flickable {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                anchors.topMargin: 5
                contentWidth: Math.max(width, bottomToolbar.implicitWidth)
                clip: true
                interactive: bottomToolbar.implicitWidth > width
                EditorToolbar {
                    id: bottomToolbar
                    editor: rich.controller
                    x: Math.max(0, pane.columnX - 26)
                    width: implicitWidth
                    height: 38
                    onLinkRequested: rich.openLinkDialog()
                }
            }
        }

        // Status line: checklist progress, length, save state.
        Rectangle {
            visible: !pane.locked
            Layout.fillWidth: true
            Layout.preferredHeight: 30
            color: pane.color
            Rectangle { width: parent.width; height: 1; color: Theme.c.divider }
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: pane.columnX
                anchors.rightMargin: Math.max(20, parent.width - pane.columnX - pane.columnWidth)
                spacing: 16
                Text {
                    visible: pane.taskTotal > 0
                    text: pane.taskDone + " / " + pane.taskTotal + " done"
                    color: pane.taskDone === pane.taskTotal ? Theme.c.successText : Theme.c.subtle
                    font.pixelSize: 12
                    font.features: { "tnum": 1 }
                }
                Text {
                    readonly property int words: pane.isPlain ? plain.wordCount : rich.controller.wordCount
                    text: words.toLocaleString(Qt.locale("en_US"), "f", 0) + (words === 1 ? " word" : " words")
                          + (words > 200 ? "  \u00b7  " + Math.max(1, Math.round(words / 230)) + " min read" : "")
                    color: Theme.c.subtle
                    font.pixelSize: 12
                    font.features: { "tnum": 1 }
                }
                Text {
                    visible: pane.isPlain
                    text: "Plain text"
                    color: Theme.c.subtle
                    font.pixelSize: 12
                    font.features: { "tnum": 1 }
                }
                Item { Layout.fillWidth: true }
                Text {
                    text: {
                        const n = pane.note
                        const edited = "Edited " + Dates.relative(n.updated_at || "")
                        return n.is_daily ? edited : "Created " + Dates.shortDate(n.created_at || "") + "  ·  " + edited
                    }
                    color: Theme.c.subtle
                    font.pixelSize: 12
                    font.features: { "tnum": 1 }
                    MouseArea { id: datesArea; anchors.fill: parent; hoverEnabled: true }
                    Tip {
                        visible: datesArea.containsMouse
                        text: "Created " + Dates.full(pane.note.created_at || "") + "
Edited " + Dates.full(pane.note.updated_at || "")
                    }
                }
                Text {
                    text: pane.inTrash ? "In trash" : (rich.controller.dirty || plain.dirty ? "Saving\u2026" : "Saved")
                    color: Theme.c.subtle
                    font.pixelSize: 12
                    font.features: { "tnum": 1 }
                }
            }
        }
    }

    PopoutManager { id: popouts }

    Shortcut {
        sequences: ["Ctrl+F"]
        enabled: pane.hasNote && !pane.isPlain && !pane.locked
        onActivated: { AppState.replaceOpen = false; AppState.findOpen = true; findBar.focusFind() }
    }
    Shortcut {
        sequences: ["Ctrl+H"]
        enabled: pane.hasNote && !pane.isPlain && !pane.locked
        onActivated: { AppState.replaceOpen = true; AppState.findOpen = true; findBar.focusFind() }
    }
}
