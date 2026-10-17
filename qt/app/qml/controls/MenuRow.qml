import QtQuick
import QtQuick.Layouts
import Noted

// One 34px menu row: label, then a shortcut, tick or submenu chevron. A
// `color` (list colour name) puts that list's folder in front.
Rectangle {
    id: row
    property var data_: ({})
    property bool highlighted: false
    readonly property bool disabled: !!data_.disabled
    readonly property bool hovered: area.containsMouse
    signal activated()

    implicitHeight: 34
    implicitWidth: layout.implicitWidth + 20
    radius: 6
    color: highlighted && !disabled ? Theme.c.pressed : "transparent"
    opacity: disabled ? 0.45 : 1

    RowLayout {
        id: layout
        anchors.fill: parent
        anchors.leftMargin: 10
        anchors.rightMargin: 10
        spacing: 10

        Icon {
            visible: !!row.data_.color
            name: "folder"
            size: 15
            color: row.data_.color ? Theme.swatch(row.data_.color) : "transparent"
        }
        Text {
            Layout.fillWidth: true
            text: row.data_.text || ""
            color: row.data_.danger ? Theme.c.red : Theme.c.ink2
            font.pixelSize: 14
            elide: Text.ElideRight
        }
        Text {
            visible: !!row.data_.shortcut
            text: (row.data_.shortcut || "").replace(/\+/g, " ")
            color: Theme.c.muted
            font.pointSize: Theme.pt(12.5)
        }
        Icon {
            visible: !!row.data_.checked
            name: "check"
            size: 15
            color: Theme.c.accent
        }
        Icon {
            visible: !!row.data_.children
            name: "chevron-right"
            size: 13
            color: Theme.c.muted
        }
    }

    MouseArea {
        id: area
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: row.disabled ? Qt.ArrowCursor : Qt.PointingHandCursor
        onClicked: if (!row.disabled) row.activated()
    }
}
