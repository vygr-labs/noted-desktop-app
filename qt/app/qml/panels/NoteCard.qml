import QtQuick
import QtQuick.Layouts
import Noted

// One row of the note list: the title with its date at the right, then (when
// there's anything to say) a quiet line of list · checklist · tags, then
// (optionally) a snippet.
Item {
    id: card

    required property string noteId
    required property string title
    required property string preview
    required property string noteType
    required property string listId
    required property bool pinned
    required property bool locked
    required property bool shared
    required property bool owner
    required property bool daily
    required property string createdAt
    required property string updatedAt
    required property var tags
    required property int tasksDone
    required property int tasksTotal
    required property string dateLabel
    required property string listName
    required property string listColor
    required property int index

    property bool showList: true
    readonly property bool active: AppState.selectedNoteId === noteId
    signal menuRequested(Item item, real x, real y)

    readonly property bool hasMeta: (showList && listName !== "") || tasksTotal > 0 || tags.length > 0 || locked || shared || noteType === "plain"
    implicitHeight: col.implicitHeight + 24

    Rectangle {
        id: bg
        anchors.fill: parent
        anchors.leftMargin: 8
        anchors.rightMargin: 8
        radius: Theme.radiusLg
        color: card.active ? Theme.c.cardActive : (area.containsMouse ? Theme.c.hover : "transparent")
    }

    ColumnLayout {
        id: col
        anchors.left: bg.left
        anchors.right: bg.right
        anchors.top: bg.top
        anchors.leftMargin: 12
        anchors.rightMargin: 10
        anchors.topMargin: 12
        spacing: 4

        RowLayout {
            spacing: 6
            Layout.fillWidth: true
            Text {
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignTop
                text: card.title || "Untitled"
                color: Theme.c.text
                font.pixelSize: 15
                font.weight: Font.Medium
                wrapMode: Text.Wrap
                maximumLineCount: 2
                elide: Text.ElideRight
                lineHeight: 1.15
            }
            // Pin + date, swapped for the menu button on hover. One fixed slot,
            // so hovering never changes the title's width (and its wrapping).
            Item {
                id: trail
                readonly property bool hovering: area.containsMouse || menuHover.hovered
                Layout.alignment: Qt.AlignTop
                implicitWidth: Math.max(stamp.implicitWidth, 20)
                implicitHeight: 20
                Row {
                    id: stamp
                    anchors.right: parent.right
                    y: 3
                    spacing: 6
                    opacity: trail.hovering ? 0 : 1
                    Icon { visible: card.pinned; name: "pin"; size: 12; color: Theme.c.subtle; y: 2 }
                    Text {
                        text: card.dateLabel
                        color: card.active ? Theme.c.muted : Theme.c.subtle
                        font.pixelSize: 12
                        font.features: { "tnum": 1 }
                    }
                }
                IconButton {
                    visible: trail.hovering
                    anchors.right: parent.right
                    icon: "ellipsis"
                    size: 20
                    iconSize: 14
                    onClicked: card.menuRequested(this, 0, height + 2)
                    HoverHandler { id: menuHover }
                }
            }
        }

        // list · 2/3 · tags · icons
        Row {
            visible: card.hasMeta
            Layout.fillWidth: true
            spacing: 6
            clip: true
            component Meta: Text {
                color: Theme.c.subtle
                font.pixelSize: 12
                font.features: { "tnum": 1 }
                anchors.verticalCenter: parent.verticalCenter
            }
            component Dot: Meta { text: "·"; color: Theme.c.faint }

            Rectangle {
                visible: card.showList && card.listName !== ""
                width: 6
                height: 6
                radius: 3
                color: Theme.swatch(card.listColor)
                anchors.verticalCenter: parent.verticalCenter
            }
            Meta { visible: card.showList && card.listName !== ""; text: card.listName }
            Dot { visible: card.tasksTotal > 0 && card.showList && card.listName !== "" }
            Meta {
                visible: card.tasksTotal > 0
                text: card.tasksDone + "/" + card.tasksTotal
                color: card.tasksDone === card.tasksTotal ? Theme.c.successText : Theme.c.subtle
            }
            Dot { visible: card.tags.length > 0 && (card.tasksTotal > 0 || card.showList && card.listName !== "") }
            Meta { visible: card.tags.length > 0; text: card.tags.map(t => "#" + t.name).join(" ") }
            Icon { visible: card.locked; name: "lock"; size: 11; color: Theme.c.subtle; anchors.verticalCenter: parent.verticalCenter }
            Icon { visible: card.shared; name: card.owner ? "share-2" : "arrow-down-left"; size: 11; color: Theme.c.subtle; anchors.verticalCenter: parent.verticalCenter }
            Icon { visible: card.noteType === "plain"; name: "type"; size: 11; color: Theme.c.faint; anchors.verticalCenter: parent.verticalCenter }
        }

        Text {
            visible: AppState.showPreview && card.preview !== "" && !card.locked
            Layout.fillWidth: true
            Layout.topMargin: 2
            text: card.preview
            color: Theme.c.muted
            font.pixelSize: 13
            wrapMode: Text.Wrap
            maximumLineCount: 2
            elide: Text.ElideRight
            lineHeight: 1.2
        }
    }

    MouseArea {
        id: area
        anchors.fill: bg
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.PointingHandCursor
        z: -1
        onClicked: (e) => {
            if (e.button === Qt.RightButton) card.menuRequested(card, e.x, e.y)
            else AppState.selectNote(card.noteId)
        }
    }
}
