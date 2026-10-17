import QtQuick
import QtQuick.Layouts
import Noted

// Tag chips + inline "add tag" field with suggestions from existing tags.
Flow {
    id: bar
    property string noteId: ""
    property var tags: []
    property bool readOnly: false

    spacing: 6

    Repeater {
        model: bar.tags
        delegate: Rectangle {
            id: chip
            required property var modelData
            height: 24
            width: chipRow.implicitWidth + 16
            radius: Theme.radiusSm
            color: Theme.c.chip
            MouseArea { id: chipHover; anchors.fill: parent; hoverEnabled: true }
            Row {
                id: chipRow
                anchors.centerIn: parent
                spacing: 4
                Rectangle {
                    width: 6
                    height: 6
                    radius: 2
                    anchors.verticalCenter: parent.verticalCenter
                    color: Theme.swatch(chip.modelData.color)
                    visible: !!chip.modelData.color && chip.modelData.color !== "gray"
                }
                Text {
                    text: "#" + chip.modelData.name
                    color: Theme.c.muted
                    font.pixelSize: 13
                    anchors.verticalCenter: parent.verticalCenter
                }
                Icon {
                    visible: !bar.readOnly && (chipHover.containsMouse || rmArea.containsMouse)
                    name: "x"
                    size: 12
                    color: rmArea.containsMouse ? Theme.c.text : Theme.c.subtle
                    anchors.verticalCenter: parent.verticalCenter
                    MouseArea {
                        id: rmArea
                        anchors.fill: parent
                        anchors.margins: -3
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: Store.removeTagFromNote(bar.noteId, chip.modelData.id)
                    }
                }
            }
        }
    }

    Rectangle {
        id: addChip
        visible: !bar.readOnly
        height: 24
        width: input.visible ? 140 : addRow.implicitWidth + 12
        radius: Theme.radiusSm
        color: input.visible ? Theme.c.raised : (addArea.containsMouse ? Theme.c.hover : "transparent")
        border.color: input.activeFocus ? Theme.c.accentLine : "transparent"
        border.width: 1
        Behavior on width { NumberAnimation { duration: 120 } }

        Row {
            id: addRow
            visible: !input.visible
            anchors.centerIn: parent
            spacing: 3
            Text { text: "+ tag"; color: addArea.containsMouse ? Theme.c.muted : Theme.c.subtle; font.pixelSize: 13; anchors.verticalCenter: parent.verticalCenter }
        }
        MouseArea {
            id: addArea
            anchors.fill: parent
            visible: !input.visible
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: { input.visible = true; input.forceActiveFocus() }
        }
        TextInput {
            id: input
            visible: false
            anchors.fill: parent
            anchors.leftMargin: 10
            anchors.rightMargin: 10
            verticalAlignment: TextInput.AlignVCenter
            color: Theme.c.text
            font.pixelSize: 13
            selectByMouse: true
            clip: true
            property string suggestion: {
                const t = text.trim().toLowerCase()
                if (t === "") return ""
                for (const tag of AppState.tags) if (tag.name.toLowerCase().startsWith(t)) return tag.name
                return ""
            }
            Text {
                visible: input.suggestion !== "" && input.text !== ""
                x: input.contentWidth
                anchors.verticalCenter: parent.verticalCenter
                text: input.suggestion.substring(input.text.length)
                color: Theme.c.faint
                font.pixelSize: Theme.fontSm
            }
            function commit(useSuggestion) {
                const name = (useSuggestion && suggestion !== "" ? suggestion : text).trim()
                if (name !== "") Store.addTagToNote(bar.noteId, name)
                text = ""
            }
            Keys.onReturnPressed: commit(false)
            Keys.onTabPressed: commit(true)
            Keys.onEscapePressed: { text = ""; visible = false }
            onActiveFocusChanged: if (!activeFocus) { commit(false); visible = false }
        }
    }
}
