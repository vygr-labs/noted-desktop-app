import QtQuick
import QtQuick.Controls.Basic
import Noted

// Small dark tooltip with an optional shortcut hint.
ToolTip {
    id: tip
    property string shortcut: ""

    delay: 450
    timeout: 4000
    padding: 0
    topPadding: 0
    bottomPadding: 0

    contentItem: Row {
        spacing: 8
        leftPadding: 8
        rightPadding: 8
        topPadding: 5
        bottomPadding: 5
        Text {
            text: tip.text
            color: "#f4f4f5"
            font.pixelSize: Theme.fontSm
            font.family: Theme.fontFamily
        }
        Text {
            visible: tip.shortcut !== ""
            text: tip.shortcut
            color: "#a1a1aa"
            font.pixelSize: Theme.fontSm
        }
    }
    background: Rectangle {
        color: "#18181b"
        radius: Theme.radius
        border.color: "#27272a"
    }
    enter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 90 } }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 70 } }
}
