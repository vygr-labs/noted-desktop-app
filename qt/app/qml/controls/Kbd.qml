import QtQuick
import Noted

// Keycap: 26px tall, `field` fill, 1px `lineStrong` with a 2px bottom edge.
// small: a 20px cap for hints inside menus and quick find.
Item {
    id: root
    property alias text: label.text
    property bool small: false
    implicitWidth: Math.max(implicitHeight, label.implicitWidth + (small ? 10 : 16))
    implicitHeight: small ? 20 : 26

    Rectangle {
        anchors.fill: parent
        radius: 6
        color: Theme.c.lineStrong
    }
    Rectangle {
        anchors.fill: parent
        anchors.margins: 1
        anchors.bottomMargin: 2
        radius: 5
        color: Theme.c.field
    }
    Text {
        textFormat: Text.PlainText
        id: label
        anchors.centerIn: parent
        anchors.verticalCenterOffset: -0.5
        color: root.small ? Theme.c.muted : Theme.c.text
        font.pointSize: Theme.pt(root.small ? 11.5 : 12.5)
    }
}
