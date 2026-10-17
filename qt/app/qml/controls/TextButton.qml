import QtQuick
import Noted

// Text button.
//   variant: secondary (default) — 32px, `field` fill, `lineStrong` border
//            destructive — the same with `red` text
//            primary — `ink` fill, `bg` text, 38px (lock screen only)
//            link — underlined `secondary` text, no box
// Legacy names: ghost/subtle → secondary, danger → destructive.
Item {
    id: root

    property string text: ""
    property string icon: ""
    property string variant: "secondary"
    property bool compact: false
    property real fontSize: variant === "link" ? 12.5 : 13.5
    readonly property bool hovered: area.containsMouse
    readonly property string kind: variant === "danger" ? "destructive"
                                 : (variant === "ghost" || variant === "subtle") ? "secondary" : variant

    signal clicked()

    implicitWidth: kind === "link" ? label.implicitWidth : row.implicitWidth + 24
    implicitHeight: kind === "link" ? label.implicitHeight : (kind === "primary" ? 38 : (compact ? 28 : 32))
    opacity: enabled ? 1 : 0.45

    Rectangle {
        visible: root.kind !== "link"
        anchors.fill: parent
        radius: 7
        color: root.kind === "primary" ? (area.pressed ? Qt.lighter(Theme.c.ink, 1.2) : Theme.c.ink)
             : (area.pressed ? Theme.c.pressed : (area.containsMouse ? Theme.mix(Theme.c.field, Theme.c.pressed, 0.6) : Theme.c.field))
        border.width: root.kind === "primary" ? 0 : 1
        border.color: Theme.c.lineStrong
    }

    Row {
        id: row
        anchors.centerIn: parent
        spacing: 6
        Icon {
            visible: root.icon !== ""
            name: root.icon
            size: 14
            color: label.color
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            textFormat: Text.PlainText
            id: label
            text: root.text
            color: root.kind === "primary" ? Theme.c.bg : root.kind === "destructive" ? Theme.c.red
                 : root.kind === "link" ? (area.containsMouse ? Theme.c.ink : Theme.c.secondary) : Theme.c.ink
            font.pointSize: Theme.pt(root.fontSize)
            font.weight: root.kind === "primary" ? Font.Medium : Font.Normal
            anchors.verticalCenter: parent.verticalCenter
            // Link style: underline in `underline`, offset 3px.
            Rectangle {
                visible: root.kind === "link"
                y: parent.baselineOffset + 3
                width: parent.width
                height: 1
                color: area.containsMouse ? Theme.c.secondary : Theme.c.underline
            }
        }
    }

    MouseArea {
        id: area
        anchors.fill: parent
        anchors.margins: root.kind === "link" ? -3 : 0
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
