import QtQuick
import Noted

// Square icon button with hover/pressed/checked states and a tooltip.
Rectangle {
    id: root

    property string icon: ""
    property string tooltip: ""
    property string shortcut: ""
    property real size: 32
    property real iconSize: 16
    property bool checked: false
    property bool danger: false
    property color iconColor: checked ? Theme.c.accentText : (danger && area.containsMouse ? Theme.c.danger : Theme.c.muted)
    property bool dim: false          // faded until hovered (editor chrome)
    property bool fireOnPress: false  // keeps editor focus/selection
    readonly property bool hovered: area.containsMouse

    signal clicked()

    width: size
    height: size
    radius: Theme.radiusLg
    color: area.pressed ? Theme.c.press : (checked ? Theme.c.accentSoft : (area.containsMouse ? Theme.c.hover : "transparent"))
    opacity: enabled ? (dim && !area.containsMouse && !checked ? 0.62 : 1) : 0.35
    Behavior on color { ColorAnimation { duration: Theme.fast } }
    Behavior on opacity { NumberAnimation { duration: Theme.fast } }

    Icon {
        anchors.centerIn: parent
        name: root.icon
        size: root.iconSize
        color: root.iconColor
    }

    MouseArea {
        id: area
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onPressed: if (root.fireOnPress) root.clicked()
        onClicked: if (!root.fireOnPress) root.clicked()
    }

    Tip {
        visible: area.containsMouse && root.tooltip !== "" && !area.pressed
        text: root.tooltip
        shortcut: root.shortcut
    }
}
