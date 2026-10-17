import QtQuick
import QtQuick.Layouts
import Noted

// A settings-style row: label (14.5/500) and description (13.5 `muted`) on
// the left, the control on the right, 16px padding, a `lineFaint` rule above.
//   SettingRow { label: "Note previews"; description: "…"; Toggle { … } }
Item {
    id: row
    property string label: ""
    property string description: ""
    property bool first: false
    default property alias control: controlSlot.data

    width: parent ? parent.width : 0
    implicitHeight: Math.max(text.implicitHeight, controlSlot.implicitHeight) + 32

    Rectangle {
        visible: !row.first
        width: parent.width
        height: 1
        color: Theme.c.lineFaint
    }
    ColumnLayout {
        id: text
        anchors.left: parent.left
        anchors.right: controlSlot.left
        anchors.rightMargin: 24
        anchors.verticalCenter: parent.verticalCenter
        spacing: 2
        Text {
            Layout.fillWidth: true
            text: row.label
            color: Theme.c.ink
            font.pointSize: Theme.pt(14.5)
            font.weight: Font.Medium
            wrapMode: Text.Wrap
        }
        Text {
            visible: row.description !== ""
            Layout.fillWidth: true
            text: row.description
            color: Theme.c.muted
            font.pointSize: Theme.pt(13.5)
            lineHeightMode: Text.FixedHeight
            lineHeight: Math.round(13.5 * 1.45)
            wrapMode: Text.Wrap
        }
    }
    Row {
        id: controlSlot
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        spacing: 8
    }
}
