import QtQuick
import Noted

// To-do checkbox: 18px in notes and to-do lists, 16px in side columns.
// Empty: 1.5px `faint` border. Ticked: `accent` fill with an `onAccent` tick.
Rectangle {
    id: root
    property bool checked: false
    property bool small: false
    signal toggled()

    width: small ? 16 : 18
    height: width
    radius: small ? 4 : 5
    color: checked ? Theme.c.accent : (area.containsMouse ? Qt.alpha(Theme.c.accent, 0.08) : "transparent")
    border.width: checked ? 0 : 1.5
    border.color: area.containsMouse ? Theme.c.accent : Theme.c.faint

    Icon {
        anchors.centerIn: parent
        visible: root.checked
        name: "check"
        size: root.width - 5
        color: Theme.c.onAccent
    }
    MouseArea {
        id: area
        anchors.fill: parent
        anchors.margins: -4
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.toggled()
    }
}
