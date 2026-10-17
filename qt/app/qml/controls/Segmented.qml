import QtQuick
import Noted

// Segmented control: a `segTrack` track (3px padding, radius 8) of 28px
// segments; the selected one is `segOn` with a 1px shadow, weight 500.
//   options: [{ value, label }]
Rectangle {
    id: root
    property var options: []
    property string value: ""
    property real segmentWidth: 0   // 0 = fit each label
    signal picked(string value)

    implicitWidth: row.implicitWidth + 6
    implicitHeight: 34
    radius: 8
    color: Theme.c.segTrack

    Row {
        id: row
        x: 3
        y: 3
        Repeater {
            model: root.options
            delegate: Item {
                id: seg
                required property var modelData
                readonly property bool on: modelData.value === root.value
                width: root.segmentWidth > 0 ? root.segmentWidth : label.implicitWidth + 24
                height: 28
                Rectangle {
                    visible: seg.on
                    anchors.fill: parent
                    anchors.topMargin: 1
                    radius: 6
                    color: Theme.dark ? "transparent" : "#0F000000"
                }
                Rectangle {
                    visible: seg.on
                    anchors.fill: parent
                    anchors.bottomMargin: 1
                    radius: 6
                    color: Theme.c.segOn
                }
                Text {
                    textFormat: Text.PlainText
                    id: label
                    anchors.centerIn: parent
                    text: seg.modelData.label
                    color: seg.on ? Theme.c.ink : Theme.c.secondary
                    font.pointSize: Theme.pt(13.5)
                    font.weight: seg.on ? Font.Medium : Font.Normal
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.picked(seg.modelData.value)
                }
            }
        }
    }
}
