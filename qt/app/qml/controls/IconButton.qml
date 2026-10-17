import QtQuick
import Noted

// Square icon button: radius 6, `secondary` icon, `pressed` fill when held
// or checked, a lighter fill on hover.
Rectangle {
    id: root

    property string icon: ""
    property string tooltip: ""
    property string shortcut: ""
    property real size: 32
    property real iconSize: 16
    property bool checked: false     // pressed look (menu open, pinned)
    property bool danger: false
    property color iconColor: danger && area.containsMouse ? Theme.c.red : (checked ? Theme.c.ink : Theme.c.secondary)
    property bool dim: false          // legacy: faded until hovered
    property bool fireOnPress: false  // keeps editor focus/selection
    readonly property bool hovered: area.containsMouse

    signal clicked()

    width: size
    height: size
    radius: 6
    color: area.pressed || checked ? Theme.c.pressed : (area.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
    opacity: enabled ? (dim && !area.containsMouse && !checked ? 0.75 : 1) : 0.35

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
