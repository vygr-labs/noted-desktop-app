import QtQuick
import QtQuick.Controls.Basic
import Noted

ScrollBar {
    id: bar
    implicitWidth: 10
    implicitHeight: 10
    padding: 2
    minimumSize: 0.06
    policy: ScrollBar.AsNeeded
    contentItem: Rectangle {
        implicitWidth: 6
        implicitHeight: 6
        radius: 3
        color: bar.pressed ? Theme.c.faint : (bar.hovered ? Theme.c.faint : Theme.c.divider)
        opacity: bar.active || bar.hovered ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 250 } }
    }
    background: Item {}
}
