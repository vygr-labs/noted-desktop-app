import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// Unchecked checklist items gathered from the notes of one list (or all
// notes), grouped by note. Ticking one here edits that note in place.
ColumnLayout {
    id: panel

    property string listId: ""
    property bool open: false
    property var groups: []
    readonly property int total: {
        let n = 0
        for (const g of groups) n += g.items.length
        return n
    }

    spacing: 0
    visible: total > 0

    function reload() { groups = Store.openTasks(listId, 80) }
    onListIdChanged: reload()
    Component.onCompleted: reload()
    Connections {
        target: Store
        function onNotesChanged() { reloadTimer.restart() }
    }
    Timer { id: reloadTimer; interval: 400; onTriggered: panel.reload() }

    // Header row: "6 open to-dos" + chevron
    Rectangle {
        Layout.fillWidth: true
        Layout.leftMargin: 8
        Layout.rightMargin: 8
        Layout.preferredHeight: 32
        radius: Theme.radiusLg
        color: headArea.containsMouse ? Theme.c.hover : "transparent"
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 10
            anchors.rightMargin: 10
            spacing: 8
            Icon { name: "list-todo"; size: 14; color: Theme.c.accent }
            Text {
                text: panel.total + (panel.total === 1 ? " open to-do" : " open to-dos") + (panel.total >= 80 ? "+" : "")
                color: Theme.c.muted
                font.pixelSize: 13
                Layout.fillWidth: true
            }
            Icon {
                name: "chevron-down"
                size: 14
                color: Theme.c.subtle
                rotation: panel.open ? 180 : 0
                Behavior on rotation { NumberAnimation { duration: Theme.fast } }
            }
        }
        MouseArea {
            id: headArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: { panel.open = !panel.open; AppState.save("qt.openTasksOpen", panel.open) }
        }
    }

    Flickable {
        id: flick
        visible: panel.open
        Layout.fillWidth: true
        Layout.preferredHeight: Math.min(contentHeight, 260)
        contentHeight: groupsCol.implicitHeight + 6
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBarThin {}

        Column {
            id: groupsCol
            width: flick.width
            Repeater {
                model: panel.groups
                delegate: Column {
                    id: grp
                    required property var modelData
                    width: groupsCol.width
                    topPadding: 6
                    Text {
                        x: 18
                        width: parent.width - 36
                        text: grp.modelData.title || "Untitled"
                        color: Theme.c.subtle
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                        elide: Text.ElideRight
                        bottomPadding: 2
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: AppState.selectNote(grp.modelData.noteId)
                        }
                    }
                    Repeater {
                        model: grp.modelData.items
                        delegate: Item {
                            id: row
                            required property var modelData
                            width: groupsCol.width
                            height: taskText.implicitHeight + 8
                            property bool ticked: false
                            Rectangle {
                                anchors.fill: parent
                                anchors.leftMargin: 8
                                anchors.rightMargin: 8
                                radius: Theme.radius
                                color: rowArea.containsMouse ? Theme.c.hover : "transparent"
                            }
                            Rectangle {
                                id: box
                                x: 18
                                y: 6
                                width: 14
                                height: 14
                                radius: 4
                                color: row.ticked ? Theme.c.accent : "transparent"
                                border.width: row.ticked ? 0 : 1.5
                                border.color: boxArea.containsMouse ? Theme.c.accent : Theme.c.faint
                                Icon { anchors.centerIn: parent; visible: row.ticked; name: "check"; size: 11; color: "white" }
                                MouseArea {
                                    id: boxArea
                                    anchors.fill: parent
                                    anchors.margins: -4
                                    hoverEnabled: true
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: {
                                        row.ticked = true
                                        AppState.checkTask(grp.modelData.noteId, row.modelData.index)
                                    }
                                }
                            }
                            Text {
                                id: taskText
                                anchors.left: box.right
                                anchors.leftMargin: 10
                                anchors.right: parent.right
                                anchors.rightMargin: 18
                                y: 4
                                text: row.modelData.text
                                color: row.ticked ? Theme.c.checkedText : Theme.c.body
                                font.pixelSize: 13
                                font.strikeout: row.ticked
                                wrapMode: Text.Wrap
                                maximumLineCount: 2
                                elide: Text.ElideRight
                                lineHeight: 1.15
                            }
                            MouseArea {
                                id: rowArea
                                anchors.fill: parent
                                anchors.leftMargin: 40
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: AppState.selectNote(grp.modelData.noteId)
                            }
                        }
                    }
                }
            }
        }
    }

    Rectangle {
        Layout.fillWidth: true
        Layout.leftMargin: 18
        Layout.rightMargin: 18
        Layout.topMargin: 4
        Layout.preferredHeight: 1
        color: Theme.c.divider
    }
}
