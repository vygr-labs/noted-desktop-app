import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Notes moved to the trash, newest first, each with Restore and Delete
// forever. Not in the prototype; built from the same parts as a list's rows.
Flickable {
    id: page

    property bool active: false
    onActiveChanged: if (active) { contentY = 0; Notes.refresh() }

    contentWidth: width
    contentHeight: col.y + col.height + 96
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    ScrollBar.vertical: ScrollBarThin {}

    Column {
        id: col
        y: 40
        width: Math.min(page.width - 96, Math.max(680, Math.min(960, page.width * 0.62)) - 96)
        x: (page.width - width) / 2

        Text { text: "Trash · " + Fmt.plural(Notes.count, "note"); color: Theme.c.muted; font.pixelSize: 13 }
        Item { width: 1; height: 6 }
        RowLayout {
            width: parent.width
            Text { Layout.fillWidth: true; text: "Trash"; color: Theme.c.ink; font.pixelSize: 34; font.weight: 650; font.letterSpacing: -0.68 }
            TextButton { visible: Notes.count > 0; text: "Empty trash"; variant: "destructive"; onClicked: emptyDialog.open() }
        }
        Item { width: 1; height: 22 }
        Text {
            visible: Notes.count === 0
            text: "Nothing in the trash."
            color: Theme.c.muted
            font.pixelSize: 15
        }
        Repeater {
            model: page.active ? Notes : null
            delegate: Rectangle {
                id: row
                required property string noteId
                required property string title
                required property string preview
                required property string updatedAt
                required property bool locked
                x: -12
                width: col.width + 24
                height: rowCol.implicitHeight + 28
                radius: 8
                color: rowArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.5) : "transparent"
                MouseArea {
                    id: rowArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: AppState.openNote(row.noteId)
                }
                ColumnLayout {
                    id: rowCol
                    x: 12
                    y: 14
                    width: parent.width - 24
                    spacing: 4
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 16
                        Text { Layout.fillWidth: true; text: row.title || "Untitled"; color: Theme.c.ink; font.pixelSize: 15; font.weight: Font.Medium; elide: Text.ElideRight }
                        TextButton { variant: "link"; fontSize: 13; text: "Restore"; onClicked: AppState.restoreNote(row.noteId) }
                        TextButton { variant: "link"; fontSize: 13; text: "Delete forever"; onClicked: Store.deleteNotePermanently(row.noteId) }
                    }
                    Text {
                        visible: AppState.showPreview
                        Layout.fillWidth: true
                        text: row.locked ? "Locked" : row.preview.replace(/\s+/g, " ")
                        color: Theme.c.tertiary
                        font.pointSize: Theme.pt(13.5)
                        elide: Text.ElideRight
                    }
                    Text { text: Fmt.editedPhrase(row.updatedAt).replace(/^Edited/, "Moved to the trash"); color: Theme.c.muted; font.pointSize: Theme.pt(12.5) }
                }
            }
        }
    }

    ModalDialog {
        id: emptyDialog
        title: "Empty the trash?"
        description: Fmt.plural(Notes.count, "note") + " will be deleted for good. This can’t be undone."
        footer: [
            TextButton { text: "Cancel"; onClicked: emptyDialog.close() },
            TextButton { text: "Empty trash"; variant: "destructive"; onClicked: { Store.emptyTrash(); AppState.refreshCounts(); emptyDialog.close() } }
        ]
    }
}
