import QtQuick
import Noted

// Text (+ optional icon) button. variant: primary | ghost | subtle | danger
Rectangle {
    id: root

    property string text: ""
    property string icon: ""
    property string variant: "ghost"
    property bool compact: false
    readonly property bool hovered: area.containsMouse

    signal clicked()

    implicitWidth: row.implicitWidth + (compact ? 16 : 24)
    implicitHeight: compact ? 28 : 34
    radius: Theme.radiusLg
    opacity: enabled ? 1 : 0.45

    readonly property color fg: variant === "primary" || variant === "danger" ? Theme.c.onAccent
                              : variant === "subtle" ? Theme.c.text : Theme.c.muted
    color: {
        if (variant === "primary") return area.pressed ? Qt.darker(Theme.c.accent, 1.1) : (area.containsMouse ? Theme.c.accentHover : Theme.c.accent)
        if (variant === "danger") return area.pressed ? Qt.darker(Theme.c.danger, 1.1) : (area.containsMouse ? Qt.darker(Theme.c.danger, 1.05) : Theme.c.danger)
        if (variant === "subtle") return area.pressed ? Theme.c.press : (area.containsMouse ? Theme.c.hover : Theme.c.sunken)
        return area.pressed ? Theme.c.press : (area.containsMouse ? Theme.c.hover : "transparent")
    }
    border.width: variant === "ghost" ? 1 : 0
    border.color: Theme.c.border
    Behavior on color { ColorAnimation { duration: Theme.fast } }

    Row {
        id: row
        anchors.centerIn: parent
        spacing: 6
        Icon {
            visible: root.icon !== ""
            name: root.icon
            size: 14
            color: root.fg
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            text: root.text
            color: root.fg
            font.pixelSize: root.compact ? Theme.fontSm : Theme.fontMd
            font.weight: Font.Medium
            anchors.verticalCenter: parent.verticalCenter
        }
    }

    MouseArea {
        id: area
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
