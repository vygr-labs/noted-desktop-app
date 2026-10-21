import QtQuick
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// The note's title (34/650), then the meta row 12px under it: the list (opens
// Move to), Edited, "Shared", "n of m done", #tags and Add tag.
ColumnLayout {
    id: header
    property var note: ({})
    property var tags: []
    property bool readOnly: false
    property bool showTitle: true   // false when the body's opening H1 is the title
    property bool locked: false
    property int tasksDone: 0
    property int tasksTotal: 0
    readonly property string liveTitle: title.text.trim()
    readonly property var noteList: AppState.listById(note.list_id || "")
    signal enterPressed()

    spacing: 0

    function focusTitle(selectAll) {
        title.forceActiveFocus()
        if (selectAll) title.selectAll()
        else title.cursorPosition = title.length
    }
    function openMove() { move.openUnder(listButton, -6) }

    TextEdit {
        id: title
        cursorDelegate: Caret { target: title }
        textFormat: TextEdit.PlainText
        visible: header.showTitle
        Layout.fillWidth: true
        readOnly: header.readOnly
        wrapMode: TextEdit.Wrap
        color: Theme.c.ink
        selectionColor: Theme.c.selection
        selectedTextColor: Theme.c.ink
        selectByMouse: true
        font.family: Theme.fontFamily
        font.pixelSize: 34
        font.weight: 650
        font.letterSpacing: -0.68

        // Set imperatively, not bound: a binding would rewrite the text (and
        // drop a trailing space) every time a debounced save lands. Only typing
        // saves: text set here never does, and an edit is saved to the note it
        // was typed in, even when another note has opened since.
        property string noteId: ""
        property string editedId: ""     // the note the unsaved typing belongs to
        property bool syncing: false
        function sync() {
            syncing = true
            const t = header.note.title || ""
            text = t === "Untitled" ? "" : t
            syncing = false
        }
        Connections {
            target: header
            function onNoteChanged() {
                const id = header.note.id || ""
                if (id !== title.noteId) {
                    if (saveTimer.running) { saveTimer.stop(); title.commit() }
                    title.noteId = id
                    title.sync()
                } else if (!title.activeFocus && !saveTimer.running) title.sync()
            }
        }
        Component.onCompleted: { noteId = header.note.id || ""; sync() }

        Text {
            textFormat: Text.PlainText
            visible: title.length === 0
            text: "Untitled"
            color: Theme.c.faintest
            font: title.font
        }
        Keys.onPressed: (e) => {
            if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter || (e.key === Qt.Key_Down && title.cursorPosition === title.length)) {
                e.accepted = true
                saveTimer.stop()
                title.commit()
                header.enterPressed()
            }
        }
        onTextChanged: if (activeFocus && !syncing && noteId !== "") { editedId = noteId; saveTimer.restart() }
        onActiveFocusChanged: if (!activeFocus && saveTimer.running) { saveTimer.stop(); commit() }
        function commit() {
            const id = editedId
            editedId = ""
            if (id === "") return
            const t = text.trim().replace(/\n/g, " ")
            const wanted = t === "" ? "Untitled" : t
            if (wanted !== Store.note(id).title) Store.updateNote(id, { title: wanted })
        }
        Timer {
            id: saveTimer
            interval: 300
            onTriggered: title.commit()
        }
    }

    // ── meta row ─────────────────────────────────────────────────────
    Flow {
        Layout.fillWidth: true
        Layout.topMargin: header.showTitle ? 12 : 0
        spacing: 16

        component Meta: Text {
            textFormat: Text.PlainText
            height: 26
            verticalAlignment: Text.AlignVCenter
            color: Theme.c.muted
            font.pixelSize: 13
            font.features: { "tnum": 1 }
        }

        // The list: opens Move to.
        Rectangle {
            id: listButton
            x: -6
            width: listRow.implicitWidth + 12
            height: 26
            radius: 6
            color: move.opened ? Theme.c.pressed : (listArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
            Row {
                id: listRow
                x: 6
                anchors.verticalCenter: parent.verticalCenter
                spacing: 6
                Icon { name: "folder"; size: 14; color: header.noteList ? Theme.swatch(header.noteList.color) : Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
                Text {
                    textFormat: Text.PlainText
                    text: header.noteList ? header.noteList.name : (header.note.is_daily ? "Daily notes" : "No list")
                    color: Theme.c.text
                    font.pixelSize: 13
                    anchors.verticalCenter: parent.verticalCenter
                }
                Icon { name: "chevron-down"; size: 10; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
            }
            MouseArea {
                id: listArea
                anchors.fill: parent
                enabled: !header.readOnly
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: header.openMove()
            }
        }
        Meta { text: Fmt.editedPhrase(header.note.updated_at, AppState.now) }
        Row {
            visible: !!header.note.is_shared
            height: 26
            spacing: 6
            Icon { name: "users"; size: 14; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
            Meta { text: "Shared" }
        }
        Meta {
            visible: header.tasksTotal > 0 && !header.locked
            text: header.tasksDone + " of " + header.tasksTotal + " done"
        }
        Repeater {
            model: header.locked ? [] : header.tags
            delegate: Meta {
                required property var modelData
                text: "#" + modelData.name
                color: tagArea.containsMouse ? Theme.c.ink : Theme.c.secondary
                MouseArea {
                    id: tagArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: AppState.openSearch("#" + parent.modelData.name)
                }
            }
        }
        Meta {
            id: addTag
            visible: !header.readOnly && !header.locked
            text: "Add tag"
            color: addArea.containsMouse || tagPicker.opened ? Theme.c.ink : Theme.c.muted
            MouseArea {
                id: addArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: tagPicker.openUnder(addTag, -8)
            }
        }
    }

    MovePicker {
        id: move
        noteId: header.note.id || ""
        currentListId: header.note.list_id || ""
    }
    TagPicker {
        id: tagPicker
        noteId: header.note.id || ""
        noteTags: header.tags
    }
}
