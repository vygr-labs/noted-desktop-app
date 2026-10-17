import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtQuick.Dialogs
import Noted

ApplicationWindow {
    id: window

    width: 1240
    height: 820
    minimumWidth: 720
    minimumHeight: 520
    visible: !screenshotMode           // main.cpp shows it, placed, for --screenshot
    title: (AppState.view === "note" && AppState.currentNote.title ? AppState.currentNote.title + " — " : "") + "noted"
    color: Theme.c.bg
    flags: Qt.Window | Qt.FramelessWindowHint | Qt.WindowMinMaxButtonsHint | (screenshotMode ? Qt.WindowDoesNotAcceptFocus : 0)
    font.family: Theme.fontFamily

    // Under ~720px the sidebar folds away to its toggle.
    readonly property bool showSidebar: !AppState.focusMode && !AppState.sidebarCollapsed && width >= 720

    Component.onCompleted: {
        AppState.load()
        if (startupState !== "") {
            try {
                const s = JSON.parse(startupState)
                if (s.theme) Theme.mode = s.theme
                if (s.accent) Theme.accentChoice = s.accent
                if (s.view) AppState.go(s.view, s.viewId || "")
                if (s.note) AppState.openNote(s.note)
                if (s.unlock) Store.markUnlocked(s.unlock)
                if (s.expand) for (const id of s.expand) AppState.setListExpanded(id, true)
                if (s.tabs) for (const t of s.tabs) AppState.openInNewTab(t.view, t.viewId || "", t.note || "")
                if (s.activeTab !== undefined) AppState.switchTab(s.activeTab)
                if (s.palette) AppState.paletteOpen = true
                if (s.sidebarCollapsed !== undefined) AppState.sidebarCollapsed = s.sidebarCollapsed
                if (s.find) { AppState.findOpen = true; AppState.replaceOpen = !!s.replace }
                if (s.scroll) Qt.callLater(() => notePage.scrollTo(s.scroll))
                if (s.width) window.width = s.width
                if (s.height) window.height = s.height
                if (s.clean || s.resizeTo || s.more || s.sideScroll) { devActions.s = s; devActions.start() }
            } catch (e) { console.warn("bad --state:", e) }
        }
        if (startupFiles.length > 0) openPaths(startupFiles)
        if (startupQuickCapture) quickCapture.showCentered()
    }

    onClosing: { notePage.flush(); deskPage.flush() }

    // --state extras for checking the UI (see scripts/shot.ps1).
    Timer {
        id: devActions
        property var s: ({})
        interval: 600
        onTriggered: {
            if (s.clean) notePage.cleanAndFormat()
            if (s.resizeTo) window.width = s.resizeTo
            if (s.scroll) Qt.callLater(() => notePage.scrollTo(s.scroll))
            if (s.more) header.moreRequested(header.moreButton)
            if (s.sideScroll) sidebar.scrollTree(s.sideScroll)
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
        function onPinPromptRequested(mode, noteId) { pinDialog.openFor(mode, noteId) }
        function onToast(message) { toast.show(message) }
        function onPopOutRequested(id) { notePage.popOut(id) }
    }

    // ── layout ──────────────────────────────────────────────────────
    RowLayout {
        anchors.fill: parent
        spacing: 0

        Sidebar {
            id: sidebar
            visible: window.showSidebar
            Layout.fillHeight: true
            Layout.preferredWidth: width
            onOpenFileRequested: importDialog.open()
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            TabStrip {
                visible: AppState.tabs.length > 1
                Layout.fillWidth: true
                Layout.preferredHeight: visible ? implicitHeight : 0
                window: window
                liveTitle: notePage.liveTitle
            }
            Header {
                id: header
                Layout.fillWidth: true
                Layout.preferredHeight: 44
                window: window
                showCaption: AppState.tabs.length < 2
                liveTitle: notePage.liveTitle
                onMoreRequested: (button) => notePage.openMore(button)
            }

            Item {
                Layout.fillWidth: true
                Layout.fillHeight: true

                DeskPage {
                    id: deskPage
                    anchors.fill: parent
                    active: AppState.view === "desk"
                    visible: active
                    onOpenFileRequested: importDialog.open()
                }
                EditorPane {
                    id: notePage
                    anchors.fill: parent
                    active: AppState.view === "note"
                    visible: active
                }
                ListPage {
                    anchors.fill: parent
                    active: AppState.view === "list"
                    visible: active
                }
                TodosPage {
                    anchors.fill: parent
                    active: AppState.view === "todos"
                    visible: active
                }
                SearchPage {
                    anchors.fill: parent
                    active: AppState.view === "search"
                    visible: active
                }
                SettingsPage {
                    anchors.fill: parent
                    active: AppState.view === "settings"
                    visible: active
                    onExportRequested: (fmt) => window.exportAll(fmt)
                    onPinRequested: (mode) => pinDialog.openFor(mode, "")
                }
                TrashPage {
                    anchors.fill: parent
                    active: AppState.view === "trash"
                    visible: active
                }
            }
        }
    }

    ResizeFrame { window: window }

    // Drop text or markdown files anywhere to open them here. (Images dropped
    // on a note's text go into the note: its own DropArea takes those.)
    DropArea {
        id: fileDrop
        anchors.fill: parent
        property bool wanted: false
        property bool images: false   // image files, onto the open note
        onEntered: (drag) => {
            const urls = drag.hasUrls ? drag.urls.map(String) : []
            images = notePage.active && notePage.takesImages && urls.some(u => App.isImageFile(u))
            wanted = urls.some(u => Files.canOpen(u))
            drag.accepted = wanted || images
        }
        onExited: wanted = false
        onDropped: (drop) => {
            wanted = false
            const urls = drop.urls.map(String)
            const paths = urls.filter(u => Files.canOpen(u))
            const pics = images ? urls.filter(u => App.isImageFile(u)) : []
            if (pics.length > 0) notePage.dropImages(pics, fileDrop, drop.x, drop.y)
            if (paths.length > 0) AppState.openFiles(paths)
            if (pics.length > 0 || paths.length > 0) drop.acceptProposedAction()
        }
        Rectangle {
            visible: fileDrop.wanted
            anchors.fill: parent
            anchors.margins: 6
            radius: 12
            color: Qt.alpha(Theme.c.accent, 0.06)
            border.width: 2
            border.color: Qt.alpha(Theme.c.accent, 0.5)
            Text {
                anchors.centerIn: parent
                textFormat: Text.PlainText
                text: "Drop to open"
                color: Theme.c.ink
                font.pixelSize: 15
                font.weight: Font.Medium
            }
        }
    }

    // ── overlays ────────────────────────────────────────────────────
    QuickFind {
        id: commandPalette
        onImportRequested: importDialog.open()
        onExportCurrentRequested: (fmt) => notePage.exportAs(fmt)
    }
    PinDialog { id: pinDialog }
    SyncSetupDialog { id: syncSetup }
    ShareListDialog { id: shareList }
    JoinListDialog { id: joinList }
    Connections {
        target: AppState
        function onSyncSetupRequested() { syncSetup.openDialog() }
        function onShareListRequested(list) { shareList.openFor(list) }
        function onJoinListRequested() { joinList.openDialog() }
        function onFlushRequested() { notePage.flush(); deskPage.flush() }
    }
    Connections {
        target: Sync
        // Changes from another computer are about to be written: anything
        // still being typed is saved first, so it's merged, not overwritten.
        function onAboutToApply() { notePage.flush(); deskPage.flush() }
    }
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
    function exportAll(fmt) {
        exportAllDialog.format = fmt
        exportAllDialog.nameFilters = [fmt.toUpperCase() + " (*." + fmt + ")"]
        exportAllDialog.selectedFile = "noted-export." + fmt
        exportAllDialog.open()
    }

    // Toast: one quiet line near the bottom.
    Rectangle {
        id: toast
        property string message: ""
        function show(m) { message = m; opacity = 1; toastTimer.restart() }
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 44
        width: toastText.implicitWidth + 28
        height: 36
        radius: 8
        color: Theme.c.ink
        opacity: 0
        visible: opacity > 0
        Behavior on opacity { NumberAnimation { duration: 180 } }
        Text {
            textFormat: Text.PlainText
            id: toastText
            anchors.centerIn: parent
            text: toast.message
            color: Theme.c.bg
            font.pointSize: Theme.pt(13.5)
        }
        Timer { id: toastTimer; interval: 2200; onTriggered: toast.opacity = 0 }
    }

    // ── global shortcuts ────────────────────────────────────────────
    Shortcut { sequences: ["Ctrl+K", "Ctrl+P"]; onActivated: AppState.paletteOpen = !AppState.paletteOpen }
    Shortcut { sequences: ["Ctrl+Shift+F"]; onActivated: { AppState.paletteOpen = false; AppState.openSearch("") } }
    Shortcut { sequences: ["Ctrl+N"]; onActivated: AppState.newNote() }
    Shortcut { sequences: ["Ctrl+T"]; onActivated: AppState.newTab() }
    Shortcut { sequences: ["Ctrl+W"]; enabled: AppState.tabs.length > 1; onActivated: AppState.closeTab(AppState.activeTab) }
    Shortcut { sequences: ["Ctrl+Tab", "Ctrl+PgDown"]; onActivated: AppState.cycleTab(1) }
    Shortcut { sequences: ["Ctrl+Shift+Tab", "Ctrl+PgUp"]; onActivated: AppState.cycleTab(-1) }
    Shortcut { sequences: ["Ctrl+Shift+N"]; onActivated: AppState.newNote({ type: "plain" }) }
    Shortcut { sequences: ["Ctrl+O"]; onActivated: importDialog.open() }
    Shortcut { sequences: ["Ctrl+,"]; onActivated: AppState.openSettings() }
    Shortcut { sequences: ["Ctrl+."]; onActivated: AppState.go("desk") }
    Shortcut { sequences: ["Ctrl+\\"]; onActivated: AppState.setSidebarCollapsed(!AppState.sidebarCollapsed) }
    Shortcut { sequences: ["F11"]; onActivated: AppState.focusMode = !AppState.focusMode }
    Shortcut { sequences: ["Alt+Left"]; onActivated: AppState.goBack() }
    Shortcut { sequences: ["Alt+Right"]; onActivated: AppState.goForward() }
    Shortcut { sequences: ["Ctrl+=", "Ctrl++"]; onActivated: AppState.setTextScale(Theme.textScale + 0.0625) }
    Shortcut { sequences: ["Ctrl+-"]; onActivated: AppState.setTextScale(Theme.textScale - 0.0625) }
    Shortcut { sequences: ["Ctrl+0"]; onActivated: AppState.setTextScale(1) }
    Shortcut {
        sequences: ["Escape"]
        enabled: AppState.focusMode
        onActivated: AppState.focusMode = false
    }
}
