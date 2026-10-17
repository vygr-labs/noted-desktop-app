import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// Centered modal card with title, description, body slot and footer slot.
Popup {
    id: dlg

    property string title: ""
    property string description: ""
    default property alias body: bodyColumn.data
    property alias footer: footerRow.data
    property real dialogWidth: 380

    parent: Overlay.overlay
    anchors.centerIn: parent
    width: dialogWidth
    modal: true
    focus: true
    padding: 22
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    Overlay.modal: Rectangle {
        color: Theme.c.scrim
        Behavior on opacity { NumberAnimation { duration: 120 } }
    }

    enter: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 120 }
        NumberAnimation { property: "scale"; from: 0.96; to: 1; duration: 160; easing.type: Easing.OutCubic }
    }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 90 } }

    background: Rectangle {
        color: Theme.c.raised
        radius: Theme.radiusXl
        border.color: Theme.c.border
    }

    contentItem: ColumnLayout {
        spacing: 14
        ColumnLayout {
            spacing: 4
            visible: dlg.title !== ""
            Text {
                text: dlg.title
                color: Theme.c.text
                font.pixelSize: Theme.fontXl
                font.weight: Font.DemiBold
            }
            Text {
                visible: dlg.description !== ""
                text: dlg.description
                color: Theme.c.muted
                font.pixelSize: Theme.fontMd
                wrapMode: Text.Wrap
                Layout.fillWidth: true
                lineHeightMode: Text.FixedHeight
                lineHeight: Math.round((Theme.fontXl) * 1.3)
            }
        }
        ColumnLayout {
            id: bodyColumn
            spacing: 10
            Layout.fillWidth: true
        }
        RowLayout {
            Layout.fillWidth: true
            Layout.topMargin: 4
            visible: footerRow.children.length > 0
            Item { Layout.fillWidth: true }
            RowLayout {
                id: footerRow
                spacing: 8
            }
        }
    }
}
