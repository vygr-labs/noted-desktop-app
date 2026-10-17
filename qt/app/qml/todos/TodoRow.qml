import QtQuick
import QtQuick.Layouts
import Noted

Rectangle {
    id: row
    property var todo: ({})
    property bool editing: false
    property bool compact: false
    signal editRequested()
    signal editFinished()
    signal moveRequested(int delta)

    readonly property bool done: !!todo.is_completed
    readonly property int dueState: Dates.dueState(todo.due_date || "")

    implicitHeight: editing ? editCol.implicitHeight + 24 : (compact ? 34 : Math.max(44, viewCol.implicitHeight + 20))
    radius: Theme.radiusLg
    color: editing ? Theme.c.sunken : (area.containsMouse ? Theme.c.hover : "transparent")

    MouseArea {
        id: area
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton
        onDoubleClicked: if (!row.compact) row.editRequested()
    }

    // ── view mode ────────────────────────────────────────────────────
    RowLayout {
        visible: !row.editing
        anchors.fill: parent
        anchors.leftMargin: row.compact ? 8 : 12
        anchors.rightMargin: 8
        spacing: 10

        Rectangle {
            id: check
            width: row.compact ? 16 : 20
            height: width
            radius: width / 2
            color: row.done ? Theme.c.accent : "transparent"
            border.width: row.done ? 0 : 1.5
            border.color: checkArea.containsMouse ? Theme.c.accent : Theme.c.faint
            Behavior on color { ColorAnimation { duration: 140 } }
            Icon {
                anchors.centerIn: parent
                name: "check"
                size: parent.width * 0.7
                color: "white"
                scale: row.done ? 1 : 0
                Behavior on scale { NumberAnimation { duration: 220; easing.type: Easing.OutBack } }
            }
            MouseArea {
                id: checkArea
                anchors.fill: parent
                anchors.margins: -4
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: Store.updateTodo(row.todo.id, { is_completed: !row.done })
            }
        }

        ColumnLayout {
            id: viewCol
            Layout.fillWidth: true
            spacing: 3
            Text {
                Layout.fillWidth: true
                text: row.todo.text || ""
                color: row.done ? Theme.c.subtle : Theme.c.text
                font.pixelSize: row.compact ? 12 : Theme.fontLg
                font.strikeout: row.done
                wrapMode: Text.Wrap
                maximumLineCount: row.compact ? 1 : 4
                elide: Text.ElideRight
            }
            RowLayout {
                visible: !row.compact && (!!row.todo.due_date || !!row.todo.description)
                spacing: 8
                Row {
                    visible: !!row.todo.due_date
                    spacing: 4
                    Icon { name: "calendar"; size: 11; color: dueText.color; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        id: dueText
                        text: Dates.due(row.todo.due_date || "")
                        font.pixelSize: 11
                        color: row.done ? Theme.c.subtle : row.dueState === -1 ? Theme.c.dangerText : row.dueState === 0 ? Theme.c.accentText : Theme.c.subtle
                    }
                }
                Row {
                    visible: !!row.todo.description
                    spacing: 4
                    Icon { name: "file-text"; size: 11; color: Theme.c.subtle; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        text: (row.todo.description || "").split("\n")[0].substring(0, 60)
                        font.pixelSize: 11
                        color: Theme.c.subtle
                    }
                }
            }
        }

        Row {
            visible: area.containsMouse || hoverKeep.containsMouse
            spacing: 0
            MouseArea { id: hoverKeep; width: 0; height: 0; hoverEnabled: true }
            IconButton { visible: !row.compact; icon: "chevron-up"; size: 26; iconSize: 13; tooltip: "Move up"; onClicked: row.moveRequested(-1) }
            IconButton { visible: !row.compact; icon: "chevron-down"; size: 26; iconSize: 13; tooltip: "Move down"; onClicked: row.moveRequested(1) }
            IconButton { visible: !row.compact; icon: "pencil"; size: 26; iconSize: 13; tooltip: "Edit"; onClicked: row.editRequested() }
            IconButton { icon: "trash-2"; size: 26; iconSize: 13; tooltip: "Delete"; danger: true; onClicked: Store.deleteTodo(row.todo.id) }
        }
    }

    // ── edit mode ────────────────────────────────────────────────────
    ColumnLayout {
        id: editCol
        visible: row.editing
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 12
        spacing: 8
        onVisibleChanged: if (visible) {
            textField.text = row.todo.text || ""
            dueField.text = row.todo.due_date || ""
            descField.text = row.todo.description || ""
            textField.forceActiveFocus()
        }

        Field { id: textField; Layout.fillWidth: true; placeholderText: "Task"; onAccepted: save() }
        RowLayout {
            spacing: 6
            Text { text: "Due"; color: Theme.c.muted; font.pixelSize: Theme.fontSm }
            Field { id: dueField; Layout.preferredWidth: 170; mono: true; placeholderText: "YYYY-MM-DD [HH:MM]"; onAccepted: save() }
            TextButton { text: "Today"; compact: true; onClicked: dueField.text = Dates.isoDate(0) }
            TextButton { text: "Tomorrow"; compact: true; onClicked: dueField.text = Dates.isoDate(1) }
            TextButton { text: "Clear"; compact: true; onClicked: dueField.text = "" }
        }
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.max(64, descField.implicitHeight + 16)
            radius: Theme.radiusLg
            color: Theme.c.window
            border.color: descField.activeFocus ? Theme.c.accentLine : Theme.c.border
            TextEdit {
                id: descField
                anchors.fill: parent
                anchors.margins: 8
                wrapMode: TextEdit.Wrap
                color: Theme.c.text
                font.pixelSize: Theme.fontMd
                selectByMouse: true
                Text { visible: descField.length === 0; text: "Notes…"; color: Theme.c.faint; font: descField.font }
            }
        }
        RowLayout {
            Item { Layout.fillWidth: true }
            TextButton { text: "Cancel"; compact: true; onClicked: row.editFinished() }
            TextButton { text: "Save"; variant: "primary"; compact: true; onClicked: save() }
        }
        Keys.onEscapePressed: row.editFinished()
    }

    function save() {
        const due = dueField.text.trim().replace(" ", "T")
        Store.updateTodo(todo.id, { text: textField.text.trim() || todo.text, due_date: due, description: descField.text })
        editFinished()
    }
}
