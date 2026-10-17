import QtQuick
import QtQuick.Layouts
import Noted

// An open to-do in a side column: 16px checkbox, its text, then where it
// lives and when it's due. `task` is a row from Store.allTasks.
Item {
    id: row
    property var task: ({})
    property string source: ""      // "Today’s note", the note title, …
    property string when: ""
    property bool overdue: false
    property bool ticked: false
    signal toggled()
    signal openRequested()

    width: parent ? parent.width : 0
    implicitHeight: body.implicitHeight + 12

    Checkbox {
        id: box
        y: 8
        small: true
        checked: row.ticked
        onToggled: row.toggled()
    }
    ColumnLayout {
        id: body
        x: box.width + 10
        y: 6
        width: row.width - x
        spacing: 2
        Text {
            textFormat: Text.PlainText
            Layout.fillWidth: true
            text: row.task.text || ""
            color: row.ticked ? Theme.c.muted : Theme.c.ink2
            font.pixelSize: 14
            font.strikeout: row.ticked
            lineHeightMode: Text.FixedHeight
            lineHeight: Math.round(14 * 1.4)
            wrapMode: Text.Wrap
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 5
            Text {
                textFormat: Text.PlainText
                Layout.maximumWidth: body.width - (whenText.visible ? whenText.implicitWidth + 5 : 0)
                text: row.source
                color: srcArea.containsMouse ? Theme.c.ink : Theme.c.muted
                font.pointSize: Theme.pt(12.5)
                elide: Text.ElideRight
                MouseArea {
                    id: srcArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: row.openRequested()
                }
            }
            Text {
                textFormat: Text.PlainText
                id: whenText
                visible: row.when !== ""
                text: "· " + row.when
                color: row.overdue && !row.ticked ? Theme.c.red : Theme.c.muted
                font.pointSize: Theme.pt(12.5)
                font.features: { "tnum": 1 }
            }
            Item { Layout.fillWidth: true }
        }
    }
}
