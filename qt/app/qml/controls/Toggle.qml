import QtQuick
import Noted

// 40×22 switch.
Rectangle {
    id: root
    property bool checked: false
    signal toggled(bool checked)

    width: 40
    height: 22
    radius: 11
    color: checked ? Theme.c.accent : Theme.c.border
    Behavior on color { ColorAnimation { duration: Theme.fast } }

    Rectangle {
        width: 18
        height: 18
        radius: 9
        y: 2
        x: root.checked ? 20 : 2
        color: "white"
        Behavior on x { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
    }
    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: root.toggled(!root.checked)
    }
}
