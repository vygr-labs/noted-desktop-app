import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// Data-driven context menu.
//
//   menu.openAt(parentItem, x, y, [
//       { text: "Pin", icon: "pin", action: () => ... },
//       { separator: true },
//       { text: "Move to list", icon: "folder", children: [ ... ] },   // expands inline
//       { text: "Delete", icon: "trash-2", danger: true, action: ... },
//   ])
Popup {
    id: menu

    property var items: []
    property var expanded: ({})
    property real minWidth: 180

    padding: 4
    modal: false
    focus: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    function openAt(item, px, py, list) {
        items = list
        expanded = ({})
        parent = item
        const win = item.Window.contentItem || item
        const p = item.mapToItem(win, px, py)
        open()
        // Keep inside the window.
        const w = Math.max(minWidth, implicitWidth), h = implicitHeight
        let gx = p.x, gy = p.y
        if (gx + w > win.width - 6) gx = Math.max(6, win.width - w - 6)
        if (gy + h > win.height - 6) gy = Math.max(6, p.y - h)
        const local = win.mapToItem(item, gx, gy)
        x = local.x
        y = local.y
    }
    function openBelow(item, list) { openAt(item, 0, item.height + 4, list) }

    enter: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 90 }
        NumberAnimation { property: "scale"; from: 0.97; to: 1; duration: 110; easing.type: Easing.OutCubic }
    }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 70 } }

    background: Rectangle {
        color: Theme.c.raised
        radius: Theme.radiusLg + 2
        border.color: Theme.c.border
        Rectangle {
            z: -1
            anchors.fill: parent
            anchors.topMargin: 6
            anchors.margins: -2
            radius: parent.radius + 2
            color: Theme.c.shadow
            opacity: 0.35
        }
    }

    contentItem: ColumnLayout {
        spacing: 1
        Repeater {
            model: menu.items
            delegate: ColumnLayout {
                id: entry
                required property var modelData
                required property int index
                spacing: 1
                Layout.fillWidth: true

                Rectangle {
                    visible: !!entry.modelData.separator
                    Layout.fillWidth: true
                    Layout.preferredHeight: 1
                    Layout.topMargin: 3
                    Layout.bottomMargin: 3
                    color: Theme.c.divider
                }
                Text {
                    visible: !!entry.modelData.header
                    text: entry.modelData.header || ""
                    color: Theme.c.subtle
                    font.pixelSize: Theme.fontXs
                    font.weight: Font.Medium
                    Layout.leftMargin: 10
                    Layout.topMargin: 6
                    Layout.bottomMargin: 2
                }
                MenuRow {
                    visible: !entry.modelData.separator && !entry.modelData.header
                    Layout.fillWidth: true
                    Layout.minimumWidth: menu.minWidth - 8
                    data_: entry.modelData
                    isExpanded: !!menu.expanded[entry.index]
                    onActivated: {
                        if (entry.modelData.children) {
                            const e = Object.assign({}, menu.expanded)
                            e[entry.index] = !e[entry.index]
                            menu.expanded = e
                            return
                        }
                        menu.close()
                        if (entry.modelData.action) entry.modelData.action()
                    }
                }
                Repeater {
                    model: entry.modelData.children && menu.expanded[entry.index] ? entry.modelData.children : []
                    delegate: MenuRow {
                        required property var modelData
                        Layout.fillWidth: true
                        Layout.leftMargin: 14
                        data_: modelData
                        onActivated: {
                            menu.close()
                            if (modelData.action) modelData.action()
                        }
                    }
                }
            }
        }
    }
}
