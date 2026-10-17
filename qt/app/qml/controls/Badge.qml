import QtQuick
import Noted

// Count pill. accent: true = brand tint.
Rectangle {
    property int count: 0
    property bool accent: false
    visible: count > 0
    implicitWidth: Math.max(18, label.implicitWidth + 10)
    implicitHeight: 18
    radius: 9
    color: accent ? Theme.c.accentSoft : Theme.c.hover
    Text {
        id: label
        anchors.centerIn: parent
        text: parent.count > 999 ? "999+" : parent.count
        font.pixelSize: 10
        font.weight: Font.DemiBold
        color: parent.accent ? Theme.c.accentText : Theme.c.subtle
    }
}
