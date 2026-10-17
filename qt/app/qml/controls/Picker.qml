import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// A floating picker: a search field over 34px rows (Move to list, Tags).
// `rows` is [{ text, count, checked, color, create }]; the first row is
// highlighted while typing and Enter picks it.
Popup {
    id: picker

    property alias query: field.text
    property string placeholder: ""
    property var rows: []
    property string emptyText: ""
    property bool checkFirst: false   // tick in front of the label (tags) instead of after it (lists)
    property int current: 0
    signal picked(var row)

    padding: 6
    focus: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    function openUnder(item, dx) {
        const win = item.Window.contentItem || item
        parent = win
        const p = item.mapToItem(win, dx || 0, item.height + 6)
        x = Math.max(8, Math.min(p.x, win.width - width - 8))
        y = p.y + implicitHeight > win.height - 8 ? Math.max(8, item.mapToItem(win, 0, 0).y - implicitHeight - 6) : p.y
        field.text = ""
        current = 0
        open()
        field.forceActiveFocus()
    }
    onRowsChanged: current = Math.min(current, Math.max(0, rows.length - 1))

    enter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 90 } }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 70 } }

    background: Rectangle {
        color: Theme.c.raised
        radius: 10
        Shadow { anchors.fill: parent; radius: 10 }
    }

    contentItem: ColumnLayout {
        spacing: 0
        Field {
            id: field
            Layout.fillWidth: true
            Layout.bottomMargin: 6
            placeholderText: picker.placeholder
            onTextChanged: picker.current = 0
            Keys.onPressed: (e) => {
                if (e.key === Qt.Key_Down) { picker.current = Math.min(picker.rows.length - 1, picker.current + 1); e.accepted = true }
                else if (e.key === Qt.Key_Up) { picker.current = Math.max(0, picker.current - 1); e.accepted = true }
                else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter) {
                    if (picker.rows.length > 0) picker.picked(picker.rows[picker.current])
                    e.accepted = true
                }
            }
        }
        ListView {
            id: listView
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(contentHeight, 34 * 8)
            clip: true
            interactive: contentHeight > height
            model: picker.rows
            currentIndex: picker.current
            onCurrentIndexChanged: positionViewAtIndex(currentIndex, ListView.Contain)
            boundsBehavior: Flickable.StopAtBounds
            delegate: Rectangle {
                id: r
                required property var modelData
                required property int index
                width: ListView.view.width
                height: 34
                radius: 6
                color: index === picker.current ? Theme.c.pressed : "transparent"
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 10
                    anchors.rightMargin: 10
                    spacing: 10
                    Icon {
                        visible: picker.checkFirst && !r.modelData.create
                        name: "check"
                        size: 14
                        color: r.modelData.checked ? Theme.c.accent : "transparent"
                    }
                    Icon {
                        visible: !!r.modelData.color
                        name: "folder"
                        size: 15
                        color: r.modelData.color ? Theme.swatch(r.modelData.color) : "transparent"
                    }
                    Text {
                        Layout.fillWidth: true
                        text: r.modelData.create ? "Create <b>" + r.modelData.text + "</b>" : r.modelData.text
                        textFormat: r.modelData.create ? Text.StyledText : Text.PlainText
                        color: Theme.c.ink2
                        font.pixelSize: 14
                        elide: Text.ElideRight
                    }
                    Text {
                        textFormat: Text.PlainText
                        visible: r.modelData.count !== undefined
                        text: r.modelData.count !== undefined ? r.modelData.count : ""
                        color: Theme.c.muted
                        font.pointSize: Theme.pt(12.5)
                        font.features: { "tnum": 1 }
                    }
                    Icon {
                        visible: !picker.checkFirst
                        name: "check"
                        size: 14
                        color: r.modelData.checked ? Theme.c.accent : "transparent"
                    }
                }
                MouseArea {
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: picker.current = r.index
                    onClicked: picker.picked(r.modelData)
                }
            }
        }
        Text {
            textFormat: Text.PlainText
            visible: picker.rows.length === 0 && picker.emptyText !== ""
            Layout.fillWidth: true
            leftPadding: 10
            topPadding: 6
            bottomPadding: 8
            text: picker.emptyText
            color: Theme.c.muted
            font.pointSize: Theme.pt(13.5)
            wrapMode: Text.Wrap
        }
    }
}
