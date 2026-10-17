import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtQuick.Dialogs
import Noted
import "../Fmt.js" as Fmt

// The note page: title and meta row, the body in a centred column with equal
// gutters, "On this page" in a column of its own once there are two headings,
// and a 30px footer. Loads note content only when the open note changes (or
// an external write lands while idle), never in response to its own saves.
Item {
    id: pane

    property bool active: false
    readonly property var note: AppState.currentNote
    readonly property bool hasNote: active && !!note.id
    readonly property bool isPlain: note.note_type === "plain"
    readonly property bool inTrash: !!note.is_trashed
    // A file opened from disk: no title, tags, pin or lock — just its text.
    readonly property bool isFile: !!note.is_file
    readonly property bool locked: hasNote && AppState.isLocked(note)
    property string loadedId: ""
    readonly property string liveTitle: titleMerged ? rich.controller.leadingHeading : header.liveTitle
    // The note opens with an H1 that repeats its title: show it once (the
    // heading), and keep the title following that heading while it's edited.
    property bool titleMerged: false
    property string mergedHeading: ""   // the heading as loaded: opening a note never retitles it
    Connections {
        target: rich.controller
        function onStatsChanged() {
            if (!pane.titleMerged) return
            const h = rich.controller.leadingHeading
            if (h === "") { pane.titleMerged = false; return }
            if (h !== pane.mergedHeading && h !== pane.note.title) titleSync.restart()
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
    readonly property var outline: isPlain || locked ? [] : rich.controller.outline
    readonly property bool showOutline: outline.length >= 2 && scroller.width >= 900

    // ── grid ─────────────────────────────────────────────────────────
    // normal: minmax(48px,1fr) | clamp(680px, 62%, 960px) − 96px | minmax(48px,1fr) | outline
    // wide:   64px | 1fr | 64px | outline
    readonly property real outlineW: showOutline ? 200 : 0
    readonly property real columnWidth: AppState.fullWidth
        ? scroller.width - outlineW - 128
        : Math.min(scroller.width - outlineW - 96, Math.max(680, Math.min(960, scroller.width * 0.62)) - 96)
    readonly property real columnX: Math.round((scroller.width - outlineW - columnWidth) / 2)

    function flush() {
        rich.controller.flush()
        plain.flush()
    }
    function cleanAndFormat() { if (!isPlain) rich.controller.cleanAndFormat() }
    // Image files (paths or URLs) into the open note at its cursor.
    function insertImages(files) { return isPlain || locked ? 0 : rich.controller.insertImageFiles(files) }

    function loadCurrent(force) {
        if (!hasNote) {
            if (loadedId !== "") { flush(); rich.controller.unload(); plain.load("", ""); loadedId = "" }
            return
        }
        if (!force && loadedId === note.id) return
        flush()
        const n = AppState.noteData(note.id)
        if (locked) {
            rich.controller.unload()
            plain.load("", "")
            loadedId = ""
            Qt.callLater(lockPanel.focusPin)
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
        mergedHeading = titleMerged ? rich.controller.leadingHeading : ""
        const reloaded = loadedId === n.id
        loadedId = n.id
        if (!reloaded) scroller.contentY = 0
    }

    onHasNoteChanged: loadCurrent(false)
    Connections {
        target: AppState
        function onSelectedNoteIdChanged() { pane.loadCurrent(false) }
        function onFocusTitleRequested(selectAll) { if (pane.active) Qt.callLater(() => header.focusTitle(selectAll)) }
        function onFocusEditorRequested() { pane.focusBody() }
        function onEditorTaskToggleRequested(noteId, index) {
            if (!pane.hasNote || noteId !== pane.loadedId || pane.isPlain) return
            const t = pane.taskDecos
            if (index >= 0 && index < t.length) { rich.controller.toggleTask(t[index].block); AppState.claimTask() }
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
    function scrollToBlock(block) {
        const g = rich.controller.blockGeometry(block, rich.controller.layoutTick)
        const r = rich.textEdit.positionToRectangle(g.start || 0)
        const top = rich.textEdit.mapToItem(scroller.contentItem, 0, r.y).y
        scroller.contentY = Math.max(0, Math.min(scroller.contentHeight - scroller.height, top - 24))
    }

    PopupMenu { id: menu }
    PopoutManager { id: popouts }
    function popOut(id) { popouts.openNote(id) }

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
        flush()
        exportDialog.format = fmt
        exportDialog.nameFilters = [filters[fmt]]
        exportDialog.selectedFile = App.suggestedFileName(note.id, fmt)
        exportDialog.open()
    }

    // The header's More button.
    function openMore(button) {
        flush()
        const n = note
        const wide = { text: "Full width", checked: AppState.fullWidth, action: () => AppState.setFullWidth(!AppState.fullWidth) }
        let items
        if (isFile) items = [
            wide,
            { separator: true },
            { text: "Show in folder", action: () => App.revealFile(n.file_path) },
            { text: "Copy into notes", action: () => AppState.copyFileToNotes(n.id) },
            { separator: true },
            { text: "Close file", action: () => AppState.closeFile(n.id) }
        ]
        else if (inTrash) items = [
            { text: "Restore", action: () => AppState.restoreNote(n.id) },
            { separator: true },
            { text: "Delete forever", danger: true, action: () => AppState.deleteForever(n.id) }
        ]
        else items = [
            wide,
            { text: "Move to list…", action: () => header.openMove() },
            { text: "Copy as Markdown", disabled: locked, action: () => { if (App.copyAsMarkdown(n.id)) AppState.toast("Copied as Markdown") } },
            { text: "Export…", disabled: locked, children: [
                { text: "Markdown", action: () => exportAs("md") },
                { text: "PDF", action: () => exportAs("pdf") },
                { text: "Word document", action: () => exportAs("doc") },
                { text: "HTML", action: () => exportAs("html") },
                { text: "Plain text", action: () => exportAs("txt") }
            ] },
            n.is_locked ? (locked ? { text: "Locked with PIN", disabled: true } : { text: "Lock again", action: () => AppState.lockAgain(n.id) })
                        : { text: "Lock with PIN…", action: () => AppState.toggleLock(n.id) },
            ...(isPlain ? [{ text: "Turn into rich text", action: () => { flush(); AppState.convertToRich(n.id) } }] : []),
            { separator: true },
            { text: "Move to trash", danger: true, action: () => AppState.trashNote(n.id) }
        ]
        menu.openBelowRight(button, items)
    }

    // ── page ─────────────────────────────────────────────────────────
    Flickable {
        id: scroller
        anchors.top: findBar.visible ? findBar.bottom : parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: footer.top
        contentWidth: width
        contentHeight: body.y + body.implicitHeight + 96
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickDeceleration: 4000
        maximumFlickVelocity: 5000
        ScrollBar.vertical: ScrollBarThin {}
        onContentHeightChanged: pane.applyPendingScroll()

        Column {
            id: body
            width: pane.columnWidth
            x: pane.columnX
            y: 40
            spacing: 0

            // A file shows exactly as it is: no separate title.
            Flow {
                visible: pane.isFile
                width: parent.width
                spacing: 16
                bottomPadding: 28
                Row {
                    height: 20
                    spacing: 6
                    Icon { name: "file"; size: 14; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        textFormat: Text.PlainText
                        text: (/\.(md|markdown)$/i.test(pane.note.file_path || "") ? "Markdown" : "Plain text") + " file"
                        color: Theme.c.text
                        font.pixelSize: 13
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
                Text {
                    textFormat: Text.PlainText
                    width: Math.min(implicitWidth, 340)
                    height: 20
                    verticalAlignment: Text.AlignVCenter
                    text: pane.note.file_path || ""
                    color: Theme.c.muted
                    font.pixelSize: 13
                    elide: Text.ElideMiddle
                    MouseArea { id: pathArea; anchors.fill: parent; hoverEnabled: true }
                    Tip { visible: pathArea.containsMouse; text: pane.note.file_path || "" }
                }
                Text {
                    textFormat: Text.PlainText
                    height: 20
                    verticalAlignment: Text.AlignVCenter
                    text: "Saved " + Fmt.edited(pane.note.updated_at).toLowerCase().replace(/^yesterday$/, "yesterday")
                    color: Theme.c.muted
                    font.pixelSize: 13
                }
                TextButton { height: 20; variant: "link"; fontSize: 13; text: "Copy into notes"; onClicked: { pane.flush(); AppState.copyFileToNotes(pane.note.id) } }
            }

            NoteHeader {
                id: header
                visible: !pane.isFile
                width: parent.width
                note: pane.note
                readOnly: pane.inTrash
                tags: AppState.currentTags
                locked: pane.locked
                showTitle: !pane.titleMerged
                tasksDone: pane.taskDone
                tasksTotal: pane.taskTotal
                onEnterPressed: pane.focusBody()
            }
            Item { visible: !pane.isFile; width: 1; height: 30 }

            // In the trash: say so, and offer the way back.
            Rectangle {
                visible: pane.inTrash
                width: parent.width
                height: 52
                radius: 8
                color: Theme.c.folder
                border.color: Theme.c.lineStrong
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 14
                    anchors.rightMargin: 12
                    spacing: 12
                    Icon { name: "trash-2"; size: 16; color: Theme.c.muted }
                    Text { textFormat: Text.PlainText; Layout.fillWidth: true; text: "This note is in the trash."; color: Theme.c.ink; font.pixelSize: 14 }
                    TextButton { text: "Restore"; onClicked: AppState.restoreNote(pane.note.id) }
                }
            }
            Item { visible: pane.inTrash; width: 1; height: 30 }

            Item {
                visible: pane.locked
                width: parent.width
                height: lockPanel.height + 64
                LockPanel {
                    id: lockPanel
                    y: 64 - 30
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: Math.min(340, parent.width)
                    noteId: pane.note.id || ""
                    onUnlocked: pane.loadCurrent(true)
                }
            }

            RichEditor {
                id: rich
                visible: !pane.isPlain && !pane.locked
                readOnly: pane.inTrash
                width: parent.width
                minHeight: 120
                onCaretMoved: (r) => { if (textEdit.activeFocus) pane.ensureVisible(r, textEdit) }
            }
            PlainEditor {
                id: plain
                visible: pane.isPlain && !pane.locked
                width: parent.width
                onCaretMoved: (r) => { if (textEdit.activeFocus) pane.ensureVisible(r, textEdit) }
            }
        }

        // Clicking the empty space below the text focuses the end.
        MouseArea {
            visible: !pane.locked
            y: body.y + body.implicitHeight
            width: parent.width
            height: Math.max(0, scroller.contentHeight - y)
            cursorShape: Qt.IBeamCursor
            onClicked: pane.isPlain ? plain.focusEnd() : rich.focusEnd()
        }

        // On this page: sticky in its own column.
        Column {
            visible: pane.showOutline
            x: scroller.width - pane.outlineW
            y: Math.max(46, scroller.contentY + 24)
            width: pane.outlineW - 24
            Text {
                textFormat: Text.PlainText
                bottomPadding: 8
                text: "On this page"
                color: Theme.c.tertiary
                font.pixelSize: 12
                font.weight: Font.Medium
            }
            Repeater {
                model: pane.outline
                delegate: Text {
                    required property var modelData
                    width: parent.width
                    leftPadding: modelData.level === 3 ? 12 : 0
                    topPadding: 4
                    bottomPadding: 4
                    text: modelData.text
                    color: outArea.containsMouse ? Theme.c.ink : Theme.c.secondary
                    font.pixelSize: 13
                    elide: Text.ElideRight
                    MouseArea {
                        id: outArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: pane.scrollToBlock(parent.modelData.block)
                    }
                }
            }
        }
    }

    FindBar {
        id: findBar
        visible: pane.hasNote && AppState.findOpen && !pane.isPlain && !pane.locked
        anchors.top: parent.top
        width: parent.width
        editor: rich.controller
        onClosed: { AppState.findOpen = false; rich.controller.findQuery = ""; rich.textEdit.forceActiveFocus() }
        onVisibleChanged: if (visible) Qt.callLater(focusFind)
    }

    // Selection toolbar, 10px above the selection.
    SelectionToolbar {
        id: selBar
        editor: rich.controller
        readonly property var edit: rich.textEdit
        readonly property bool hasSelection: edit.selectionStart !== edit.selectionEnd
        readonly property rect a: { scroller.contentY; edit.width; return edit.positionToRectangle(edit.selectionStart) }
        readonly property rect b: { scroller.contentY; edit.width; return edit.positionToRectangle(edit.selectionEnd) }
        readonly property point selTop: { scroller.contentY; return edit.mapToItem(pane, a.x, a.y) }
        readonly property point selBottom: { scroller.contentY; return edit.mapToItem(pane, b.x, b.y + b.height) }
        visible: pane.hasNote && !pane.isPlain && !pane.locked && !pane.inTrash && hasSelection
                 && (edit.activeFocus || menuOpen) && selTop.y > scroller.y - 20 && selTop.y < footer.y
        x: Math.max(8, Math.min(pane.width - width - 8, (a.y === b.y ? (selTop.x + edit.mapToItem(pane, b.x, 0).x) / 2 : edit.mapToItem(pane, edit.width / 2, 0).x) - width / 2))
        y: selTop.y - height - 10 < scroller.y + 4 ? selBottom.y + 10 : selTop.y - height - 10
        z: 5
        onLinkRequested: rich.openLinkDialog()
    }

    // ── footer ───────────────────────────────────────────────────────
    Rectangle {
        id: footer
        visible: pane.hasNote
        anchors.bottom: parent.bottom
        width: parent.width
        height: visible ? 30 : 0
        color: Theme.c.bg
        Rectangle { width: parent.width; height: 1; color: Theme.c.lineFaint }
        Row {
            anchors.right: parent.right
            anchors.rightMargin: 16
            anchors.verticalCenter: parent.verticalCenter
            spacing: 18
            Text {
                textFormat: Text.PlainText
                visible: !pane.locked
                readonly property int words: pane.isPlain ? plain.wordCount : rich.controller.wordCount
                text: words.toLocaleString(Qt.locale("en_US"), "f", 0) + (words === 1 ? " word" : " words")
                color: Theme.c.muted
                font.pixelSize: 12
                font.features: { "tnum": 1 }
            }
            Text {
                textFormat: Text.PlainText
                text: {
                    if (pane.inTrash) return "In the trash"
                    if (rich.controller.dirty || plain.dirty) return "Saving…"
                    if (pane.isFile) return "Saved to disk"
                    // Live sync isn't in the Qt build yet: shared notes save here only.
                    if (pane.note.is_shared) return "Saved on this computer · sync isn’t in this build yet"
                    return "Saved"
                }
                color: Theme.c.muted
                font.pixelSize: 12
            }
        }
    }

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
