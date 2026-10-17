import QtQuick
import QtQuick.Dialogs
import QtQuick.Layouts
import Noted

// Turning sync on: a folder your cloud drive already syncs, and a passphrase.
// The folder decides which: one with noted's notes in it is joined (same
// passphrase as the other computer), anything else gets a new library.
ModalDialog {
    id: dlg
    dialogWidth: 440
    title: "Sync your notes"
    description: "Pick a folder that OneDrive, Dropbox, Google Drive or Syncthing already keeps in step between your computers. noted keeps its own folder inside it, encrypted."

    property string folder: ""
    readonly property var found: folder === "" ? ({ kind: "" }) : Sync.inspect(folder)
    readonly property bool joining: found.kind === "library"

    function openDialog() {
        folder = ""
        pass.text = ""
        again.text = ""
        error.text = ""
        open()
    }
    function submit() {
        error.text = ""
        if (folder === "") { error.text = "Choose a folder first."; return }
        if (found.kind === "list") { error.text = "That’s a shared list’s folder. Join it from Shared lists instead."; return }
        if (pass.text.length < 8) { error.text = "Use a passphrase of at least 8 characters."; return }
        if (!joining && pass.text !== again.text) { error.text = "The two passphrases don’t match."; return }
        Sync.setUp(folder, pass.text)
    }
    Connections {
        target: Sync
        function onSetupFinished(ok, message) {
            if (!dlg.opened) return
            if (ok) { dlg.close(); AppState.toast(message) }
            else error.text = message
        }
    }

    FolderDialog {
        id: picker
        title: "Choose the synced folder"
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
    Text {
        textFormat: Text.PlainText
        visible: dlg.joining
        Layout.fillWidth: true
        text: "Your notes are already in this folder. Enter the passphrase you used on your other computer."
        color: Theme.c.text
        font.pixelSize: Theme.fontSm
        wrapMode: Text.Wrap
    }
    Field {
        id: pass
        Layout.fillWidth: true
        implicitHeight: 36
        echoMode: TextInput.Password
        placeholderText: "Passphrase"
        onAccepted: dlg.joining ? dlg.submit() : again.forceActiveFocus()
    }
    Field {
        id: again
        visible: !dlg.joining
        Layout.fillWidth: true
        implicitHeight: 36
        echoMode: TextInput.Password
        placeholderText: "The passphrase again"
        onAccepted: dlg.submit()
    }
    Text {
        textFormat: Text.PlainText
        visible: !dlg.joining
        Layout.fillWidth: true
        text: "There’s no way to recover it, so keep it somewhere safe. Your notes on this computer stay as they are."
        color: Theme.c.muted
        font.pixelSize: Theme.fontSm
        wrapMode: Text.Wrap
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
        TextButton {
            text: Sync.busy ? "Setting up…" : dlg.joining ? "Join" : "Start syncing"
            variant: "primary"
            enabled: !Sync.busy
            onClicked: dlg.submit()
        }
    ]
}
