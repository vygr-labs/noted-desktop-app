import QtQuick
import QtQuick.Dialogs
import QtQuick.Layouts
import Noted

// Joining a list someone shared: the folder (once your cloud drive has it)
// and the code they sent.
ModalDialog {
    id: dlg
    dialogWidth: 440
    title: "Join a shared list"
    description: "Once the shared folder is on this computer, choose it and enter the code you were sent."

    property string folder: ""
    readonly property var found: folder === "" ? ({ kind: "" }) : Sync.inspect(folder)

    function openDialog() {
        folder = ""
        code.text = ""
        error.text = ""
        open()
    }
    function submit() {
        error.text = ""
        if (folder === "") { error.text = "Choose the folder first."; return }
        if (found.kind !== "list") { error.text = "There’s no shared list in that folder."; return }
        if (Sync.joinList(folder, code.text)) { dlg.close(); AppState.toast("Joined. The list will appear in a moment.") }
        else error.text = Sync.error
    }

    FolderDialog {
        id: picker
        title: "Choose the shared list’s folder"
        onAccepted: dlg.folder = String(selectedFolder)
    }

    RowLayout {
        Layout.fillWidth: true
        spacing: 8
        Field {
            Layout.fillWidth: true
            implicitHeight: 36
            readOnly: true
            leadingIcon: "folder"
            placeholderText: "No folder chosen"
            text: dlg.folder === "" ? "" : dlg.found.root
        }
        TextButton { implicitHeight: 36; text: "Choose…"; onClicked: picker.open() }
    }
    Field {
        id: code
        Layout.fillWidth: true
        implicitHeight: 36
        mono: true
        font.pixelSize: 13
        placeholderText: "Code"
        onAccepted: dlg.submit()
    }
    Text {
        id: error
        textFormat: Text.PlainText
        visible: text !== ""
        Layout.fillWidth: true
        color: Theme.c.dangerText
        font.pixelSize: Theme.fontSm
        wrapMode: Text.Wrap
    }

    footer: [
        TextButton { text: "Cancel"; onClicked: dlg.close() },
        TextButton { text: "Join"; variant: "primary"; onClicked: dlg.submit() }
    ]
}
