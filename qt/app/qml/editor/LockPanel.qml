import QtQuick
import QtQuick.Layouts
import Noted

// Shown in place of a locked note's body. The body is never loaded, drawn or
// measured until the PIN checks out (no blur over real text).
Column {
    id: panel
    property string noteId: ""
    property bool failed: false
    signal unlocked()

    width: 340
    spacing: 0

    function focusPin() { pin.forceActiveFocus() }
    function tryUnlock() {
        if (pin.text === "") return
        if (Store.verifyLockPin(pin.text)) {
            Store.markUnlocked(noteId)
            pin.text = ""
            failed = false
            unlocked()
        } else {
            pin.text = ""
            failed = true
            pin.forceActiveFocus()
        }
    }
    onNoteIdChanged: { pin.text = ""; failed = false }

    Icon { anchors.horizontalCenter: parent.horizontalCenter; name: "lock"; size: 28; color: Theme.c.muted }
    Item { width: 1; height: 12 }
    Text {
        textFormat: Text.PlainText
        anchors.horizontalCenter: parent.horizontalCenter
        text: "This note is locked"
        color: Theme.c.ink
        font.pixelSize: 17
        font.weight: Font.DemiBold
    }
    Item { width: 1; height: 6 }
    Text {
        textFormat: Text.PlainText
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
        text: "Enter your PIN to open it. It stays open until you quit noted."
        color: Theme.c.muted
        font.pixelSize: 14
        lineHeightMode: Text.FixedHeight
        lineHeight: Math.round(14 * 1.5)
        wrapMode: Text.Wrap
    }
    Item { width: 1; height: 20 }
    RowLayout {
        width: parent.width
        spacing: 8
        Field {
            id: pin
            Layout.fillWidth: true
            implicitHeight: 38
            echoMode: TextInput.Password
            inputMethodHints: Qt.ImhDigitsOnly
            horizontalAlignment: TextInput.AlignHCenter
            placeholderText: "PIN"
            font.pixelSize: 16
            font.letterSpacing: 4.8
            error: panel.failed
            onAccepted: panel.tryUnlock()
            onTextEdited: if (text !== "") panel.failed = false
        }
        TextButton { variant: "primary"; text: "Unlock"; fontSize: 14; onClicked: panel.tryUnlock() }
    }
    Text {
        textFormat: Text.PlainText
        visible: panel.failed
        topPadding: 10
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
        text: "That PIN didn’t work. Try again."
        color: Theme.c.red
        font.pointSize: Theme.pt(13.5)
        Accessible.role: Accessible.AlertMessage
        Accessible.name: text
    }
}
