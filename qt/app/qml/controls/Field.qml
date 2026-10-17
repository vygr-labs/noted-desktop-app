import QtQuick
import QtQuick.Controls.Basic
import Noted

// Single-line text input: `field` fill, 1px `lineStrong`, radius 7. Focus
// turns the border to the accent.
TextField {
    id: field
    property bool mono: false
    property string leadingIcon: ""
    property bool error: false
    property bool bare: false   // no box: the field sits inside its own surface (pickers, quick find)

    implicitHeight: 34
    leftPadding: leadingIcon !== "" ? 34 : (bare ? 0 : 11)
    rightPadding: bare ? 0 : 11
    font.pixelSize: 14
    font.family: mono ? Theme.monoFamily : Theme.fontFamily
    color: Theme.c.ink
    placeholderTextColor: Theme.c.placeholder
    selectionColor: Theme.c.selection
    selectedTextColor: Theme.c.ink
    selectByMouse: true

    background: Rectangle {
        radius: 7
        color: field.bare ? "transparent" : Theme.c.field
        border.width: field.bare ? 0 : (field.activeFocus || field.error ? 1.5 : 1)
        border.color: field.error ? Theme.c.red : (field.activeFocus ? Theme.c.accent : Theme.c.lineStrong)
        Icon {
            visible: field.leadingIcon !== ""
            name: field.leadingIcon
            size: 15
            color: Theme.c.muted
            anchors.left: parent.left
            anchors.leftMargin: field.bare ? 0 : 11
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
