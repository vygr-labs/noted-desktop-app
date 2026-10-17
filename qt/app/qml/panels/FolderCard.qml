import QtQuick
import QtQuick.Layouts
import Noted

// A list drawn as a folder on the desk: a 72×16 tab over the body, both in
// `folder` with a `lineStrong` edge. Dot, name and count, then the latest
// note and when it was edited.
Item {
    id: card
    property var list: ({})
    property int count: 0
    property string latest: ""
    property string edited: ""
    signal clicked()

    implicitHeight: 11 + 108
    readonly property color fill: area.containsMouse ? Theme.mix(Theme.c.folder, Theme.c.pressed, 0.45) : Theme.c.folder

    Rectangle {
        id: body
        y: 11
        width: parent.width
        height: parent.height - 11
        topLeftRadius: 0
        topRightRadius: 10
        bottomLeftRadius: 10
        bottomRightRadius: 10
        color: card.fill
        border.color: Theme.c.lineStrong
    }
    Rectangle {
        width: 72
        height: 16
        topLeftRadius: 8
        topRightRadius: 8
        bottomLeftRadius: 0
        bottomRightRadius: 0
        color: card.fill
        border.color: Theme.c.lineStrong
    }
    // Hides the seam between the tab and the body.
    Rectangle { x: 1; y: 10; width: 70; height: 6; color: card.fill }

    ColumnLayout {
        x: 16
        y: 11 + 14
        width: parent.width - 32
        spacing: 0
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Rectangle { width: 8; height: 8; radius: 4; color: Theme.swatch(card.list.color) }
            Text {
                Layout.fillWidth: true
                text: card.list.name || ""
                color: Theme.c.ink
                font.pixelSize: 15
                font.weight: Font.DemiBold
                elide: Text.ElideRight
            }
            Text {
                text: card.count
                color: Theme.c.muted
                font.pointSize: Theme.pt(12.5)
                font.features: { "tnum": 1 }
            }
        }
        Text {
            Layout.fillWidth: true
            Layout.topMargin: 18
            text: card.latest
            color: Theme.c.text
            font.pointSize: Theme.pt(13.5)
            elide: Text.ElideRight
        }
        Text {
            Layout.topMargin: 2
            text: card.edited
            color: Theme.c.muted
            font.pointSize: Theme.pt(12.5)
        }
    }
    MouseArea {
        id: area
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: card.clicked()
    }
}
