import QtQuick
import QtQuick.Layouts
import Noted

Rectangle {
    id: row
    property var data_: ({})
    property bool isExpanded: false
    readonly property bool disabled: !!data_.disabled
    signal activated()

    implicitHeight: 30
    implicitWidth: layout.implicitWidth + 20
    radius: Theme.radius
    color: area.containsMouse && !disabled ? (data_.danger ? Qt.alpha(Theme.c.danger, 0.1) : Theme.c.hover) : "transparent"
    opacity: disabled ? 0.45 : 1

    RowLayout {
        id: layout
        anchors.fill: parent
        anchors.leftMargin: 10
        anchors.rightMargin: 10
        spacing: 9

        Rectangle {
            visible: !!row.data_.color
            Layout.preferredWidth: 8
            Layout.preferredHeight: 8
            radius: 4
            color: row.data_.color ? Theme.swatch(row.data_.color) : "transparent"
        }
        Icon {
            visible: !!row.data_.icon && !row.data_.color
            name: row.data_.icon || ""
            size: 14
            color: row.data_.danger ? Theme.c.dangerText : Theme.c.muted
        }
        Text {
            Layout.fillWidth: true
            text: row.data_.text || ""
            color: row.data_.danger ? Theme.c.dangerText : (row.data_.checked ? Theme.c.accentText : Theme.c.text)
            font.pixelSize: Theme.fontMd
            elide: Text.ElideRight
        }
        Text {
            visible: !!row.data_.shortcut
            text: row.data_.shortcut || ""
            color: Theme.c.subtle
            font.pixelSize: Theme.fontSm
        }
        Icon {
            visible: !!row.data_.checked
            name: "check"
            size: 14
            color: Theme.c.accentText
        }
        Icon {
            visible: !!row.data_.children
            name: "chevron-right"
            size: 14
            color: Theme.c.subtle
            rotation: row.isExpanded ? 90 : 0
            Behavior on rotation { NumberAnimation { duration: Theme.fast } }
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
