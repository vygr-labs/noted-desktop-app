import QtQuick
import QtQuick.Effects
import Noted

// The shadow and 1px ring behind a floating surface (menus, pickers, quick
// find). Put it first inside the surface's background, filling it.
//   kind: "pop" | "modal"
Item {
    id: root
    property string kind: "pop"
    property real radius: 10
    readonly property var spec: (kind === "modal" ? Theme.shadowModal : Theme.shadowPop) || ({ y: 0, blur: 0, color: "transparent", ring: "transparent" })

    z: -1
    RectangularShadow {
        anchors.fill: parent
        radius: root.radius
        offset.y: root.spec.y
        blur: root.spec.blur
        spread: -2
        color: root.spec.color
    }
    Rectangle {
        anchors.fill: parent
        anchors.margins: -1
        radius: root.radius + 1
        color: "transparent"
        border.width: 1
        border.color: root.spec.ring
    }
}
