import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtQuick.Dialogs
import Noted

ApplicationWindow {
    id: window

    width: 1240
    height: 820
    minimumWidth: 820
    minimumHeight: 520
    visible: true
    title: (AppState.currentNote.title ? AppState.currentNote.title + " — " : "") + "noted."
    color: Theme.c.window
    flags: Qt.Window | Qt.FramelessWindowHint | Qt.WindowMinMaxButtonsHint

    readonly property bool showSidebar: !AppState.focusMode
    readonly property bool showList: !AppState.focusMode && !AppState.noteListCollapsed && AppState.view !== "todos"

    Component.onCompleted: {
        AppState.load()
        if (startupState !== "") {
            try {
                const s = JSON.parse(startupState)
                if (s.theme) Theme.mode = s.theme
                if (s.view) AppState.setView(s.view, s.viewId || "")
                if (s.note) AppState.selectNote(s.note)
                if (s.noteIndex !== undefined) AppState.selectNote(Notes.idAt(s.noteIndex))
                if (s.palette) AppState.paletteOpen = true
                if (s.settings) AppState.settingsOpen = true
                if (s.sidebarCollapsed !== undefined) AppState.sidebarCollapsed = s.sidebarCollapsed
                if (s.find) { AppState.findOpen = true; AppState.replaceOpen = !!s.replace }
                if (s.scroll) Qt.callLater(() => editorPane.scrollTo(s.scroll))
                if (s.width) window.width = s.width
                if (s.height) window.height = s.height
                if (s.clean || s.resizeTo) { devActions.s = s; devActions.start() }
            } catch (e) { console.warn("bad --state:", e) }
        }
        if (startupFiles.length > 0) openPaths(startupFiles)
        if (startupQuickCapture) quickCapture.showCentered()
    }

    onClosing: editorPane.flush()

    // --state extras for checking the editor (see scripts/shot.ps1): run
    // "Clean & format" and/or resize the window once the note has loaded.
    Timer {
        id: devActions
        property var s: ({})
        interval: 600
        onTriggered: {
            if (s.clean) editorPane.cleanAndFormat()
            if (s.resizeTo) window.width = s.resizeTo
            if (s.scroll) Qt.callLater(() => editorPane.scrollTo(s.scroll))
        }
    }

    function openPaths(paths) { AppState.openFiles(paths) }

    Connections {
        target: App
        function onQuickCaptureRequested() { quickCapture.showCentered() }
        function onActivateRequested() { window.show(); window.raise(); window.requestActivate() }
        function onFilesOpened(paths) { window.openPaths(paths) }
    }
    Connections {
        target: AppState
        function onPaletteOpenChanged() { if (AppState.paletteOpen) commandPalette.open(); else commandPalette.close() }
        function onSettingsOpenChanged() { if (AppState.settingsOpen) settings.open(); else settings.close() }
        function onPinPromptRequested(mode, noteId) { pinDialog.openFor(mode, noteId) }
        function onToast(message) { toast.show(message) }
    }

    // ── layout ──────────────────────────────────────────────────────
    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            Sidebar {
                visible: window.showSidebar
                Layout.fillHeight: true
                Layout.preferredWidth: width
                onExportAllRequested: (fmt) => { exportAllDialog.format = fmt; exportAllDialog.nameFilters = [fmt.toUpperCase() + " (*." + fmt + ")"]; exportAllDialog.selectedFile = "noted-export." + fmt; exportAllDialog.open() }
            }

            NoteListPane {
                id: listPane
                visible: window.showList
                Layout.fillHeight: true
                Layout.preferredWidth: AppState.noteListWidth
                onImportRequested: importDialog.open()

                Rectangle {
                    anchors.right: parent.right
                    width: 1
                    height: parent.height
                    color: Theme.c.divider
                }
                // Drag to resize; snaps back to 328.
                MouseArea {
                    id: resizer
                    anchors.right: parent.right
                    anchors.rightMargin: -3
                    width: 7
                    height: parent.height
                    cursorShape: Qt.SplitHCursor
                    hoverEnabled: true
                    property real startX: 0
                    property real startW: 0
                    onPressed: (e) => { startX = mapToItem(null, e.x, 0).x; startW = AppState.noteListWidth }
                    onPositionChanged: (e) => {
                        if (!pressed) return
                        let w = startW + mapToItem(null, e.x, 0).x - startX
                        w = Math.max(240, Math.min(520, w))
                        if (Math.abs(w - 328) < 8) w = 328
                        AppState.noteListWidth = w
                    }
                    onReleased: AppState.setNoteListWidth(AppState.noteListWidth)
                    onDoubleClicked: AppState.setNoteListWidth(328)
                    Rectangle {
                        anchors.horizontalCenter: parent.horizontalCenter
                        width: 2
                        height: parent.height
                        color: Theme.c.accent
                        opacity: resizer.pressed ? 0.5 : (resizer.containsMouse ? 0.25 : 0)
                        Behavior on opacity { NumberAnimation { duration: 120 } }
                    }
                }
            }

            EditorPane {
                id: editorPane
                visible: AppState.view !== "todos"
                Layout.fillWidth: true
                Layout.fillHeight: true
            }
            TodoView {
                visible: AppState.view === "todos"
                Layout.fillWidth: true
                Layout.fillHeight: true
            }
        }
    }

    // No title bar: each pane's header drags the window, and these float
    // over the top-right corner.
    WindowButtons {
        window: window
        anchors.top: parent.top
        anchors.right: parent.right
        z: 50
    }

    ResizeFrame { window: window }

    // ── overlays ────────────────────────────────────────────────────
    CommandPalette {
        id: commandPalette
        onImportRequested: importDialog.open()
        onExportCurrentRequested: (fmt) => editorPane.exportAs(fmt)
    }
    SettingsDialog {
        id: settings
        onPinRequested: (mode) => pinDialog.openFor(mode, "")
    }
    PinDialog { id: pinDialog }
    QuickCapture { id: quickCapture }

    FileDialog {
        id: importDialog
        title: "Open files"
        fileMode: FileDialog.OpenFiles
        nameFilters: ["Notes (*.md *.markdown *.txt *.text)", "All files (*)"]
        onAccepted: AppState.openFiles(selectedFiles)
    }
    FileDialog {
        id: exportAllDialog
        property string format: "json"
        title: "Export all notes"
        fileMode: FileDialog.SaveFile
        onAccepted: {
            const err = App.exportAll(format, selectedFile)
            AppState.toast(err === "" ? "Export complete" : "Export failed: " + err)
        }
    }

    // Toast
    Rectangle {
        id: toast
        property string message: ""
        function show(m) { message = m; opacity = 1; toastTimer.restart() }
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 28
        width: toastText.implicitWidth + 28
        height: 36
        radius: 18
        color: Theme.dark ? "#f4f4f5" : "#18181b"
        opacity: 0
        visible: opacity > 0
        Behavior on opacity { NumberAnimation { duration: 180 } }
        Text {
            id: toastText
            anchors.centerIn: parent
            text: toast.message
            color: Theme.dark ? "#18181b" : "#f4f4f5"
            font.pixelSize: Theme.fontMd
            font.weight: Font.Medium
        }
        Timer { id: toastTimer; interval: 2200; onTriggered: toast.opacity = 0 }
    }

    // ── global shortcuts ────────────────────────────────────────────
    Shortcut { sequences: ["Ctrl+P", "Ctrl+Shift+F"]; onActivated: AppState.paletteOpen = !AppState.paletteOpen }
    Shortcut { sequences: ["Ctrl+N"]; onActivated: AppState.newNote() }
    Shortcut { sequences: ["Ctrl+Shift+N"]; onActivated: AppState.newNote({ type: "plain" }) }
    Shortcut { sequences: ["Ctrl+O"]; onActivated: importDialog.open() }
    Shortcut { sequences: ["Ctrl+,"]; onActivated: AppState.settingsOpen = true }
    Shortcut { sequences: ["Ctrl+."]; onActivated: AppState.setView("today") }
    Shortcut { sequences: ["Ctrl+["]; onActivated: AppState.noteListCollapsed = !AppState.noteListCollapsed }
    Shortcut { sequences: ["Ctrl+\\"]; onActivated: AppState.setSidebarCollapsed(!AppState.sidebarCollapsed) }
    Shortcut { sequences: ["F11"]; onActivated: AppState.focusMode = !AppState.focusMode }
    Shortcut { sequences: ["Alt+Left"]; onActivated: AppState.goBack() }
    Shortcut { sequences: ["Alt+Right"]; onActivated: AppState.goForward() }
    Shortcut { sequences: ["Ctrl+=", "Ctrl++"]; onActivated: AppState.setTextScale(Theme.textScale + 0.1) }
    Shortcut { sequences: ["Ctrl+-"]; onActivated: AppState.setTextScale(Theme.textScale - 0.1) }
    Shortcut { sequences: ["Ctrl+0"]; onActivated: AppState.setTextScale(1) }
    function cycleNotes(back) {
        if (Notes.count === 0) return
        let i = Notes.indexOf(AppState.selectedNoteId)
        i = i < 0 ? 0 : (i + (back ? Notes.count - 1 : 1)) % Notes.count
        AppState.selectNote(Notes.idAt(i))
    }
    Shortcut { sequences: ["Ctrl+Tab"]; onActivated: window.cycleNotes(false) }
    Shortcut { sequences: ["Ctrl+Shift+Tab", "Ctrl+Backtab"]; onActivated: window.cycleNotes(true) }
    Shortcut {
        sequences: ["Ctrl+Down"]
        onActivated: { const i = Notes.indexOf(AppState.selectedNoteId); if (i < Notes.count - 1) AppState.selectNote(Notes.idAt(i + 1)) }
    }
    Shortcut {
        sequences: ["Ctrl+Up"]
        onActivated: { const i = Notes.indexOf(AppState.selectedNoteId); if (i > 0) AppState.selectNote(Notes.idAt(i - 1)) }
    }
    Shortcut {
        sequences: ["Escape"]
        enabled: AppState.focusMode
        onActivated: AppState.focusMode = false
    }
}
