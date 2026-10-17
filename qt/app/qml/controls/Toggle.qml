import QtQuick
import Noted

// Switch: 36×22 track, 16px knob, `accent` on, `switchOff` off.
Rectangle {
    id: root
    property bool checked: false
    signal toggled(bool checked)

    width: 36
    height: 22
    radius: 11
    color: checked ? Theme.c.accent : Theme.c.switchOff
    Behavior on color { ColorAnimation { duration: Theme.fast } }

    Rectangle {
        width: 16
        height: 16
        radius: 8
        y: 3
        x: root.checked ? root.width - width - 3 : 3
        color: Theme.c.knob
        Behavior on x { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
    }
    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: root.toggled(!root.checked)
    }
}
