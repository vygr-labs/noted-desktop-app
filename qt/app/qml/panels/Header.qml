import QtQuick
import QtQuick.Layouts
import Noted

// The main area's 44px header: sidebar toggle (when hidden), breadcrumb,
// page actions and the window's caption buttons. Empty space drags the window.
Item {
    id: header

    property var window
    // The open note's title as it's typed (the page passes it up).
    property string liveTitle: ""
    signal moreRequested(Item button)
    property alias moreButton: moreButton

    readonly property var note: AppState.currentNote
    readonly property bool noteOpen: AppState.view === "note" && !!note.id
    readonly property bool isFile: noteOpen && !!note.is_file
    readonly property var crumbList: noteOpen ? AppState.listById(note.list_id) : (AppState.view === "list" ? AppState.listById(AppState.viewId) : null)

    readonly property string crumb: {
        switch (AppState.view) {
        case "todos": return "To-dos"
        case "settings": return "Settings"
        case "search": return "Search"
        case "trash": return "Trash"
        case "list": return crumbList ? crumbList.name : "List"
        case "note":
            if (isFile) return (note.file_path || "").split(/[\\/]/).slice(-2, -1)[0] || "Files"
            if (note.is_trashed) return "Trash"
            if (crumbList) return crumbList.name
            return note.is_daily ? "Daily notes" : "Notes"
        default: return "Daily notes"
        }
    }

    implicitHeight: 44

    DragArea { anchors.fill: parent }

    WindowButtons {
        id: caption
        window: header.window
        anchors.right: parent.right
        height: parent.height
    }

    RowLayout {
        anchors.left: parent.left
        anchors.right: caption.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.leftMargin: 16
        spacing: 8

        IconButton {
            visible: AppState.sidebarCollapsed || AppState.focusMode
            size: 30
            iconSize: 17
            icon: "panel-left"
            tooltip: "Show sidebar"
            shortcut: "Ctrl+\\"
            onClicked: { AppState.focusMode = false; AppState.setSidebarCollapsed(false) }
        }

        // Breadcrumb: list folder (or file) / title.
        RowLayout {
            Layout.fillWidth: true
            Layout.minimumWidth: 0
            spacing: 6
            Icon {
                visible: header.crumbList !== null && !(header.noteOpen && header.note.is_trashed)
                name: "folder"
                size: 15
                color: header.crumbList ? Theme.swatch(header.crumbList.color) : "transparent"
            }
            Icon {
                visible: header.isFile
                name: "file"
                size: 15
                color: Theme.c.muted
            }
            Text {
                text: header.crumb
                color: crumbArea.containsMouse && crumbArea.enabled ? Theme.c.ink : Theme.c.muted
                font.pointSize: Theme.pt(13.5)
                MouseArea {
                    id: crumbArea
                    anchors.fill: parent
                    hoverEnabled: true
                    enabled: header.noteOpen
                    cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                    onClicked: {
                        const n = header.note
                        if (header.isFile) App.revealFile(n.file_path)
                        else if (n.is_trashed) AppState.go("trash")
                        else if (header.crumbList) AppState.go("list", header.crumbList.id)
                        else AppState.go("desk")
                    }
                }
            }
            Text {
                visible: header.noteOpen
                text: "/"
                color: Theme.c.faintest
                font.pointSize: Theme.pt(13.5)
            }
            Text {
                visible: header.noteOpen
                Layout.fillWidth: true
                Layout.minimumWidth: 0
                text: header.isFile ? (header.note.title || "") : (header.liveTitle || header.note.title || "Untitled")
                color: Theme.c.text
                font.pointSize: Theme.pt(13.5)
                elide: Text.ElideRight
            }
        }

        IconButton {
            visible: header.noteOpen && !header.isFile && !header.note.is_trashed
            icon: "pin"
            iconColor: header.note.is_pinned ? Theme.c.ink : Theme.c.secondary
            checked: !!header.note.is_pinned
            tooltip: header.note.is_pinned ? "Unpin" : "Pin"
            onClicked: Store.setPinned(header.note.id, !header.note.is_pinned)
        }
        IconButton {
            id: moreButton
            visible: header.noteOpen
            Layout.rightMargin: 8
            icon: "ellipsis"
            tooltip: "More"
            onClicked: header.moreRequested(moreButton)
        }
    }
}
