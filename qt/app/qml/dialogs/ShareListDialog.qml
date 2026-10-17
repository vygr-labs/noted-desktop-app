import QtQuick
import QtQuick.Dialogs
import QtQuick.Layouts
import Noted

// Sharing a list: noted makes a folder for it inside one you pick, you share
// that folder through your cloud drive, and send the code. Opened again on a
// shared list, it shows the code and where the folder is.
ModalDialog {
    id: dlg
    dialogWidth: 460

    property var list: ({})
    property string code: ""
    readonly property var shared: { Sync.sharedLists; return Sync.sharedLists.find(s => s.listId === list.id) || null }

    title: shared ? "Sharing " + (list.name || "this list") : "Share " + (list.name || "this list")
    description: shared ? "Anyone who has this folder and the code can read and edit the list. To stop someone, stop sharing the folder with them in your cloud drive."
                        : "noted makes a folder for this list inside a folder you choose. Share that folder with people through your cloud drive, then send them the code."

    function openFor(l) {
        list = l
        code = Sync.codeFor(l.id)
        error.text = ""
        open()
    }

    FolderDialog {
        id: picker
        title: "Where should the list’s folder go?"
        onAccepted: {
            const c = Sync.shareList(dlg.list.id, String(selectedFolder))
            if (c === "") error.text = Sync.error || "Couldn’t share the list."
            else dlg.code = c
        }
    }

    // Shared: the code, and the folder.
    ColumnLayout {
        visible: !!dlg.shared
        Layout.fillWidth: true
        spacing: 6
        Text { textFormat: Text.PlainText; text: "Code"; color: Theme.c.ink; font.pixelSize: Theme.fontSm; font.weight: Font.Medium }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            // The whole code on two lines, so it can be checked by eye.
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: codeText.implicitHeight + 18
                radius: 7
                color: Theme.c.field
                border.color: Theme.c.lineStrong
                TextEdit {
                    id: codeText
                    x: 11
                    y: 9
                    width: parent.width - 22
                    readOnly: true
                    selectByMouse: true
                    textFormat: TextEdit.PlainText
                    wrapMode: TextEdit.Wrap
                    text: dlg.code
                    color: Theme.c.ink
                    selectionColor: Theme.c.selection
                    selectedTextColor: Theme.c.ink
                    font.family: Theme.monoFamily
                    font.pixelSize: 13
                }
            }
            TextButton { Layout.alignment: Qt.AlignTop; implicitHeight: 36; text: "Copy"; onClicked: { App.copyText(dlg.code); AppState.toast("Code copied") } }
        }
        Item { width: 1; height: 6 }
        Text { textFormat: Text.PlainText; text: "Folder"; color: Theme.c.ink; font.pixelSize: Theme.fontSm; font.weight: Font.Medium }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Text {
                textFormat: Text.PlainText
                Layout.fillWidth: true
                text: dlg.shared ? dlg.shared.folder : ""
                color: Theme.c.text
                font.pixelSize: Theme.fontSm
                elide: Text.ElideMiddle
            }
            TextButton { variant: "link"; text: "Show folder"; onClicked: App.revealFile(dlg.shared.folder) }
        }
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
        TextButton {
            visible: !!dlg.shared
            text: "Stop sharing"
            variant: "danger"
            onClicked: { Sync.stopSharing(dlg.list.id); dlg.close(); AppState.toast("Stopped sharing " + dlg.list.name) }
        },
        TextButton { text: dlg.shared ? "Done" : "Cancel"; onClicked: dlg.close() },
        TextButton { visible: !dlg.shared; text: "Choose folder…"; variant: "primary"; onClicked: picker.open() }
    ]
}
