import QtQuick
import Noted

// Text tabs: 38px, 24px apart, a 2px `ink` underline on the current one over
// a 1px `lineSoft` track. A count follows the label in `muted`.
//   tabs: [{ id, label, count }]
Item {
    id: root
    property var tabs: []
    property string current: ""
    signal picked(string id)

    implicitHeight: 38
    width: parent ? parent.width : 0

    Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.c.lineSoft }
    Row {
        spacing: 24
        Repeater {
            model: root.tabs
            delegate: Item {
                id: tab
                required property var modelData
                readonly property bool on: modelData.id === root.current
                width: label.implicitWidth
                height: 38
                Text {
                    id: label
                    anchors.verticalCenter: parent.verticalCenter
                    text: tab.modelData.label + (tab.modelData.count !== undefined && tab.modelData.count !== ""
                          ? "  <font color='" + Theme.c.muted + "'>" + tab.modelData.count + "</font>" : "")
                    textFormat: Text.StyledText
                    color: tab.on || area.containsMouse ? Theme.c.ink : Theme.c.secondary
                    font.pixelSize: 14
                    font.weight: tab.on ? Font.Medium : Font.Normal
                    font.features: { "tnum": 1 }
                }
                Rectangle {
                    visible: tab.on
                    anchors.bottom: parent.bottom
                    width: parent.width
                    height: 2
                    color: Theme.c.ink
                }
                MouseArea {
                    id: area
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.picked(tab.modelData.id)
                }
            }
        }
    }
}
