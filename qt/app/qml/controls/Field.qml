import QtQuick
import QtQuick.Controls.Basic
import Noted

// Single-line text input.
TextField {
    id: field
    property bool mono: false
    property string leadingIcon: ""

    implicitHeight: 34
    leftPadding: leadingIcon !== "" ? 32 : 10
    rightPadding: 10
    font.pixelSize: Theme.fontMd
    font.family: mono ? Theme.monoFamily : Theme.fontFamily
    color: Theme.c.text
    placeholderTextColor: Theme.c.subtle
    selectionColor: Theme.c.selection
    selectedTextColor: Theme.c.text
    selectByMouse: true

    background: Rectangle {
        radius: Theme.radiusLg
        color: Theme.c.window
        border.width: 1
        border.color: field.activeFocus ? Theme.c.accentLine : Theme.c.border
        Behavior on border.color { ColorAnimation { duration: Theme.fast } }
        Rectangle {
            anchors.fill: parent
            anchors.margins: -3
            radius: Theme.radiusLg + 3
            color: "transparent"
            border.width: 3
            border.color: Theme.c.accentSubtle
            visible: field.activeFocus
        }
        Icon {
            visible: field.leadingIcon !== ""
            name: field.leadingIcon
            size: 15
            color: Theme.c.subtle
            anchors.left: parent.left
            anchors.leftMargin: 10
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
