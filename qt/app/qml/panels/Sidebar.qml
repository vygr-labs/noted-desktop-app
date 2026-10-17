import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Effects
import QtQuick.Layouts
import Noted

// Left navigation: brand, search, views, lists, tags, and a footer with
// trash and app actions. Collapses to an icon rail.
Rectangle {
    id: side

    readonly property bool collapsed: AppState.sidebarCollapsed
    signal exportAllRequested(string format)

    width: collapsed ? 56 : 228
    color: Theme.c.sidebar
    clip: true
    Behavior on width { NumberAnimation { duration: 200; easing.type: Easing.OutCubic } }

    Rectangle {
        anchors.right: parent.right
        width: 1
        height: parent.height
        color: Theme.c.divider
    }

    PopupMenu { id: menu }

    component MonoLabel: Text {
        color: Theme.c.subtle
        font.pixelSize: 12
        font.weight: Font.Medium
    }

    // ── one navigation row ─────────────────────────────────────────────
    component NavItem: Rectangle {
        id: nav
        property string icon: ""
        property string label: ""
        property string countText: ""
        property bool accentCount: false
        property bool active: false
        property string swatch: ""      // list colour: a small square instead of an icon
        property bool muted: false
        property bool quietCount: false  // lists and tags: count only on hover
        signal clicked()
        signal contextRequested(real x, real y)

        Layout.fillWidth: true
        Layout.preferredHeight: side.collapsed ? 38 : 32
        radius: Theme.radius
        color: active ? Theme.c.navActive : (navArea.containsMouse ? Theme.c.hover : "transparent")

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: side.collapsed ? 0 : 10
            anchors.rightMargin: side.collapsed ? 0 : 10
            spacing: 10
            Item {
                visible: side.collapsed || nav.swatch !== ""
                Layout.preferredWidth: side.collapsed ? parent.width : 8
                Layout.preferredHeight: 16
                Icon {
                    visible: nav.swatch === "" || side.collapsed && nav.icon !== ""
                    anchors.centerIn: parent
                    name: nav.icon
                    size: 17
                    color: nav.active ? Theme.c.text : Theme.c.muted
                    opacity: nav.muted ? 0.6 : 1
                }
                // Lists: a colour square, or a lettered tile in the icon rail.
                Rectangle {
                    readonly property bool tile: side.collapsed && nav.icon === ""
                    visible: nav.swatch !== "" && !(side.collapsed && nav.icon !== "")
                    anchors.centerIn: parent
                    width: tile ? 22 : 8
                    height: tile ? 22 : 8
                    radius: tile ? 6 : 2
                    color: tile ? Qt.alpha(Theme.swatch(nav.swatch), nav.active ? 0.3 : 0.16) : Theme.swatch(nav.swatch)
                    opacity: nav.muted ? 0.5 : 1
                    Text {
                        visible: parent.tile
                        anchors.centerIn: parent
                        text: nav.label.charAt(0).toUpperCase()
                        color: Theme.dark ? Qt.lighter(Theme.swatch(nav.swatch), 1.4) : Qt.darker(Theme.swatch(nav.swatch), 1.35)
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                }
            }
            Text {
                visible: !side.collapsed
                Layout.fillWidth: true
                text: nav.label
                color: nav.active ? Theme.c.text : (nav.muted ? Theme.c.subtle : Theme.c.body)
                font.pixelSize: 14
                font.weight: nav.active ? Font.DemiBold : Font.Normal
                elide: Text.ElideRight
            }
            Text {
                visible: !side.collapsed && nav.countText !== "" && (!nav.quietCount || nav.active || navArea.containsMouse)
                text: nav.countText
                color: Theme.c.subtle
                font.pixelSize: 12
                font.features: { "tnum": 1 }
            }
        }
        Rectangle {
            visible: side.collapsed && nav.accentCount && nav.countText !== "" && nav.countText !== "0"
            width: 6
            height: 6
            radius: 3
            color: Theme.c.accent
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.rightMargin: 9
            anchors.topMargin: 8
        }

        MouseArea {
            id: navArea
            anchors.fill: parent
            hoverEnabled: true
            acceptedButtons: Qt.LeftButton | Qt.RightButton
            cursorShape: Qt.PointingHandCursor
            onClicked: (e) => e.button === Qt.RightButton ? nav.contextRequested(e.x, e.y) : nav.clicked()
        }
        Tip {
            visible: side.collapsed && navArea.containsMouse
            text: nav.label + (nav.countText !== "" ? "  ·  " + nav.countText : "")
        }
    }

    component SectionHeader: Item {
        id: sh
        property string label: ""
        property bool canAdd: false
        property bool collapsible: false
        property bool open: true
        signal addClicked()
        signal toggled()
        visible: !side.collapsed
        Layout.fillWidth: true
        Layout.preferredHeight: 30
        Layout.topMargin: 16

        Row {
            anchors.left: parent.left
            anchors.leftMargin: 10
            anchors.bottom: parent.bottom
            anchors.bottomMargin: 6
            spacing: 4
            MonoLabel { text: sh.label }
            Icon {
                visible: sh.collapsible
                name: "chevron-right"
                size: 11
                color: Theme.c.subtle
                rotation: sh.open ? 90 : 0
                anchors.verticalCenter: parent.verticalCenter
                Behavior on rotation { NumberAnimation { duration: Theme.fast } }
            }
        }
        MouseArea {
            anchors.fill: parent
            enabled: sh.collapsible
            cursorShape: Qt.PointingHandCursor
            onClicked: sh.toggled()
        }
        IconButton {
            visible: sh.canAdd
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.bottomMargin: 1
            icon: "plus"
            size: 24
            iconSize: 14
            tooltip: "New list"
            onClicked: sh.addClicked()
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.leftMargin: 10
        anchors.rightMargin: 10
        anchors.bottomMargin: 8
        spacing: 2

        // ── brand row (drags the window) ────────────────────────────────
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            DragArea { anchors.fill: parent }
            Image {
                visible: !side.collapsed
                anchors.left: parent.left
                anchors.leftMargin: 8
                anchors.verticalCenter: parent.verticalCenter
                source: "qrc:/brand/noted-logo.svg"
                sourceSize.height: 19
                height: 19
                fillMode: Image.PreserveAspectFit
                smooth: true
                // The wordmark is dark red; lift it on dark surfaces.
                layer.enabled: Theme.dark
                layer.effect: MultiEffect { colorization: 1; colorizationColor: Theme.c.accentText }
            }
            IconButton {
                anchors.right: parent.right
                anchors.rightMargin: side.collapsed ? (parent.width - width) / 2 : 0
                anchors.verticalCenter: parent.verticalCenter
                icon: side.collapsed ? "panel-left-open" : "panel-left-close"
                size: 28
                iconSize: 16
                dim: true
                tooltip: side.collapsed ? "Expand sidebar" : "Collapse sidebar"
                shortcut: "Ctrl+\\"
                onClicked: AppState.setSidebarCollapsed(!side.collapsed)
            }
        }

        // ── search ────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 34
            Layout.bottomMargin: 10
            radius: Theme.radiusLg
            color: Theme.c.raised
            border.color: searchArea.containsMouse ? Theme.c.faint : Theme.c.border
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: side.collapsed ? 0 : 10
                anchors.rightMargin: 10
                spacing: 8
                Icon {
                    visible: side.collapsed
                    name: "search"
                    size: 15
                    color: Theme.c.subtle
                    Layout.preferredWidth: parent.width
                }
                Text {
                    visible: !side.collapsed
                    text: "Search"
                    color: Theme.c.subtle
                    font.pixelSize: 14
                    Layout.fillWidth: true
                }
                Text {
                    visible: !side.collapsed
                    text: "Ctrl P"
                    color: Theme.c.faint
                    font.pixelSize: 12
                }
            }
            MouseArea {
                id: searchArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: AppState.paletteOpen = true
            }
            Tip { visible: side.collapsed && searchArea.containsMouse; text: "Search"; shortcut: "Ctrl+P" }
        }

        NavItem {
            icon: "calendar"
            label: "Today"
            countText: Qt.formatDate(new Date(AppState.todayIso + "T12:00:00"), "ddd d")
            active: AppState.view === "today"
            onClicked: AppState.setView("today")
        }
        NavItem {
            icon: "file-text"
            label: "All Notes"
            active: AppState.view === "all"
            countText: String(AppState.counts.all || 0)
            onClicked: AppState.setView("all")
        }
        NavItem {
            icon: "square-check"
            label: "To-dos"
            active: AppState.view === "todos"
            countText: (AppState.counts.todosOpen || 0) > 0 ? String(AppState.counts.todosOpen) : ""
            accentCount: true
            onClicked: AppState.setView("todos")
        }
        NavItem {
            visible: (AppState.counts.synced || 0) > 0
            icon: "share-2"
            label: "Synced"
            active: AppState.view === "synced"
            countText: String(AppState.counts.synced || 0)
            onClicked: AppState.setView("synced")
        }

        Rectangle {
            visible: side.collapsed
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            Layout.topMargin: 8
            Layout.bottomMargin: 8
            color: Theme.c.divider
        }

        // Files opened from disk (edited in place).
        SectionHeader {
            visible: !side.collapsed && Files.files.length > 0
            label: "Files"
        }
        Repeater {
            model: Files.files
            delegate: NavItem {
                required property var modelData
                icon: "file-text"
                label: modelData.name
                active: AppState.selectedNoteId === modelData.id
                onClicked: AppState.selectNote(modelData.id)
                onContextRequested: (x, y) => menu.openAt(this, x, y, [
                    { text: "Show in folder", icon: "folder-open", action: () => App.revealFile(modelData.path) },
                    { text: "Copy into notes", icon: "copy", action: () => AppState.copyFileToNotes(modelData.id) },
                    { separator: true },
                    { text: "Close file", icon: "x", action: () => AppState.closeFile(modelData.id) }
                ])
            }
        }

        SectionHeader {
            label: "Lists"
            canAdd: true
            onAddClicked: { newListField.visible = true; newListField.forceActiveFocus() }
        }

        Flickable {
            id: scroller
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentHeight: listColumn.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBarThin {}

            ColumnLayout {
                id: listColumn
                width: scroller.width
                spacing: 1

                Field {
                    id: newListField
                    visible: false
                    Layout.fillWidth: true
                    placeholderText: "List name…"
                    onAccepted: commit()
                    onActiveFocusChanged: if (!activeFocus && visible) commitTimer.start()
                    Keys.onEscapePressed: { text = ""; visible = false }
                    function commit() {
                        const name = text.trim()
                        if (name !== "") {
                            const l = Store.createList(name, "folder", "gray")
                            AppState.setView("list", l.id)
                        }
                        text = ""
                        visible = false
                    }
                    Timer { id: commitTimer; interval: 100; onTriggered: newListField.commit() }
                }

                Repeater {
                    model: AppState.lists
                    delegate: NavItem {
                        required property var modelData
                        label: modelData.name
                        swatch: modelData.color || "gray"
                        quietCount: true
                        countText: String(modelData.note_count || 0)
                        active: AppState.view === "list" && AppState.viewId === modelData.id
                        onClicked: AppState.setView("list", modelData.id)
                        onContextRequested: (x, y) => side.listMenu(this, x, y, modelData, false)
                    }
                }

                // Hidden lists fold into one row.
                Rectangle {
                    visible: !side.collapsed && AppState.hiddenLists.length > 0
                    Layout.fillWidth: true
                    Layout.preferredHeight: 30
                    radius: Theme.radius
                    color: hiddenArea.containsMouse ? Theme.c.hover : "transparent"
                    Row {
                        anchors.left: parent.left
                        anchors.leftMargin: 10
                        anchors.verticalCenter: parent.verticalCenter
                        spacing: 6
                        Icon {
                            name: "chevron-right"
                            size: 12
                            color: Theme.c.subtle
                            rotation: hiddenColumn.visible ? 90 : 0
                            anchors.verticalCenter: parent.verticalCenter
                            Behavior on rotation { NumberAnimation { duration: Theme.fast } }
                        }
                        Text {
                            text: AppState.hiddenLists.length + " hidden"
                            color: Theme.c.subtle
                            font.pixelSize: 13
                        }
                    }
                    MouseArea {
                        id: hiddenArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: hiddenColumn.visible = !hiddenColumn.visible
                    }
                }
                ColumnLayout {
                    id: hiddenColumn
                    visible: false
                    spacing: 1
                    Layout.fillWidth: true
                    Repeater {
                        model: AppState.hiddenLists
                        delegate: NavItem {
                            required property var modelData
                            muted: true
                            swatch: modelData.color || "gray"
                            label: modelData.name
                            quietCount: true
                            countText: String(modelData.note_count || 0)
                            active: AppState.view === "list" && AppState.viewId === modelData.id
                            onClicked: AppState.setView("list", modelData.id)
                            onContextRequested: (x, y) => side.listMenu(this, x, y, modelData, true)
                        }
                    }
                }

                SectionHeader {
                    visible: !side.collapsed && AppState.tags.length > 0
                    label: "Tags"
                    collapsible: true
                    open: tagsColumn.visible
                    onToggled: { tagsColumn.visible = !tagsColumn.visible; AppState.save("qt.tagsOpen", tagsColumn.visible) }
                }
                ColumnLayout {
                    id: tagsColumn
                    spacing: 1
                    Layout.fillWidth: true
                    visible: !side.collapsed && Store.setting("qt.tagsOpen", "false") === "true"
                    Repeater {
                        model: AppState.tags
                        delegate: NavItem {
                            required property var modelData
                            icon: "hash"
                            label: modelData.name
                            quietCount: true
                            countText: String(modelData.note_count || 0)
                            active: AppState.view === "tag" && AppState.viewId === modelData.id
                            onClicked: AppState.setView("tag", modelData.id)
                            onContextRequested: (x, y) => menu.openAt(this, x, y, [
                                { text: "Delete tag", icon: "trash-2", danger: true, action: () => Store.deleteTag(modelData.id) }
                            ])
                        }
                    }
                }
            }
        }

        // ── dev-data badge ──────────────────────────────────────────────
        Rectangle {
            visible: App.devData && !side.collapsed
            Layout.fillWidth: true
            Layout.preferredHeight: 24
            Layout.topMargin: 6
            radius: Theme.radius
            color: Qt.alpha(Theme.c.warning, 0.14)
            Text {
                anchors.centerIn: parent
                text: "Dev copy of your notes"
                color: Theme.c.warning
                font.pixelSize: 12
                font.weight: Font.Medium
            }
            MouseArea { id: devArea; anchors.fill: parent; hoverEnabled: true }
            Tip { visible: devArea.containsMouse; text: "This build is using " + App.dataPath }
        }

        // ── footer ──────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            Layout.topMargin: 6
            Layout.bottomMargin: 4
            color: Theme.c.divider
        }
        GridLayout {
            Layout.fillWidth: true
            columns: side.collapsed ? 1 : 5
            rowSpacing: 2
            columnSpacing: 0

            // Trash (text + count when expanded)
            Rectangle {
                Layout.fillWidth: !side.collapsed
                Layout.preferredWidth: side.collapsed ? 32 : -1
                Layout.preferredHeight: 32
                Layout.alignment: Qt.AlignHCenter
                radius: Theme.radius
                color: AppState.view === "trash" ? Theme.c.navActive : (trashArea.containsMouse ? Theme.c.hover : "transparent")
                Row {
                    anchors.left: parent.left
                    anchors.leftMargin: side.collapsed ? (parent.width - 16) / 2 : 8
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 8
                    Icon { name: "trash-2"; size: 16; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        visible: !side.collapsed
                        text: "Trash"
                        color: AppState.view === "trash" ? Theme.c.text : Theme.c.muted
                        font.pixelSize: 13
                        font.weight: AppState.view === "trash" ? Font.DemiBold : Font.Normal
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Text {
                        visible: !side.collapsed && (AppState.counts.trash || 0) > 0
                        text: AppState.counts.trash || 0
                        color: Theme.c.subtle
                        font.pixelSize: 12
                        font.features: { "tnum": 1 }
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
                MouseArea {
                    id: trashArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: AppState.setView("trash")
                }
                Tip { visible: side.collapsed && trashArea.containsMouse; text: "Trash" }
            }
            IconButton {
                icon: "square-pen"
                size: 30
                dim: true
                tooltip: "New note"
                shortcut: "Ctrl+N"
                Layout.alignment: Qt.AlignHCenter
                onClicked: AppState.newNote()
            }
            IconButton {
                id: exportButton
                icon: "download"
                size: 30
                dim: true
                tooltip: "Export all notes"
                Layout.alignment: Qt.AlignHCenter
                onClicked: menu.openAt(exportButton, side.collapsed ? exportButton.width + 6 : 0, side.collapsed ? 0 : -150, [
                    { header: "Export everything" },
                    { text: "JSON file", icon: "file-text", action: () => side.exportAllRequested("json") },
                    { text: "SQL file", icon: "file-down", action: () => side.exportAllRequested("sql") },
                    { text: "ZIP of markdown", icon: "archive", action: () => side.exportAllRequested("zip") }
                ])
            }
            IconButton {
                icon: Theme.resolved === "dark" ? "moon" : Theme.resolved === "warm" ? "coffee" : Theme.resolved === "slate" ? "cloudy" : "sun"
                size: 30
                dim: true
                tooltip: "Theme: " + Theme.resolved
                Layout.alignment: Qt.AlignHCenter
                onClicked: AppState.cycleTheme()
            }
            IconButton {
                icon: "settings"
                size: 30
                dim: true
                tooltip: "Settings"
                shortcut: "Ctrl+,"
                Layout.alignment: Qt.AlignHCenter
                onClicked: AppState.settingsOpen = true
            }
        }
    }

    function listMenu(item, x, y, list, hidden) {
        const colors = Theme.swatchNames.map(c => ({
            text: c.charAt(0).toUpperCase() + c.slice(1), color: c, checked: list.color === c,
            action: () => Store.updateList(list.id, { color: c })
        }))
        menu.openAt(item, x, y, [
            { text: "Rename…", icon: "pencil", action: () => renameDialog.openFor(list) },
            { text: "Color", icon: "circle-dot", children: colors },
            { text: hidden ? "Show list" : "Hide list", icon: hidden ? "eye" : "eye-off", action: () => Store.setListHidden(list.id, !hidden) },
            { separator: true },
            { text: "Delete list", icon: "trash-2", danger: true, action: () => deleteDialog.openFor(list) }
        ])
    }

    ModalDialog {
        id: renameDialog
        property var list: ({})
        title: "Rename list"
        function openFor(l) { list = l; renameField.text = l.name; open(); renameField.selectAll(); renameField.forceActiveFocus() }
        Field {
            id: renameField
            Layout.fillWidth: true
            onAccepted: renameDialog.commit()
        }
        function commit() {
            if (renameField.text.trim() !== "") Store.updateList(list.id, { name: renameField.text.trim() })
            close()
        }
        footer: [
            TextButton { text: "Cancel"; onClicked: renameDialog.close() },
            TextButton { text: "Rename"; variant: "primary"; onClicked: renameDialog.commit() }
        ]
    }

    ModalDialog {
        id: deleteDialog
        property var list: ({})
        title: "Delete list?"
        description: "“" + (list.name || "") + "” and all its notes will be moved to trash."
        function openFor(l) { list = l; open() }
        footer: [
            TextButton { text: "Cancel"; onClicked: deleteDialog.close() },
            TextButton {
                text: "Delete"
                variant: "danger"
                onClicked: {
                    const id = deleteDialog.list.id
                    deleteDialog.close()
                    if (AppState.view === "list" && AppState.viewId === id) AppState.setView("all")
                    Store.deleteList(id)
                }
            }
        ]
    }
}
