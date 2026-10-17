import QtQuick
import Noted

Rectangle {
    property alias text: label.text
    implicitWidth: label.implicitWidth + 10
    implicitHeight: 18
    radius: Theme.radiusSm
    color: Theme.c.sunken
    border.color: Theme.c.border
    Text {
        id: label
        anchors.centerIn: parent
        color: Theme.c.subtle
        font.family: Theme.monoFamily
        font.pixelSize: 10
    }
}
