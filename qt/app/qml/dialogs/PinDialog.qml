import QtQuick
import QtQuick.Layouts
import Noted

// Set / change / remove the lock PIN.
ModalDialog {
    id: dlg
    property string mode: "set"     // set | change | remove
    property string noteId: ""      // lock this note once a PIN is set

    dialogWidth: 360
    title: mode === "remove" ? "Remove lock PIN" : mode === "change" ? "Change lock PIN" : "Set a lock PIN"
    description: mode === "remove" ? "Enter your current PIN. All notes will be unlocked."
               : mode === "change" ? "Enter your current PIN, then the new one."
               : "This PIN locks and unlocks notes. It's never stored in plain text."

    function openFor(m, id) {
        mode = m
        noteId = id || ""
        current.text = ""
        next.text = ""
        error.text = ""
        open()
        Qt.callLater(() => (mode === "set" ? next : current).forceActiveFocus())
    }

    function submit() {
        error.text = ""
        if (mode !== "set" && !Store.verifyLockPin(current.text)) { error.text = "Incorrect PIN"; return }
        if (mode === "remove") {
            Store.removeLockPin(current.text)
            AppState.refreshCurrent()
            AppState.toast("Lock PIN removed")
            close()
            return
        }
        if (next.text.length < 4) { error.text = "PIN must be at least 4 characters"; return }
        Store.setLockPin(next.text)
        close()
        if (noteId !== "") {
            Store.toggleNoteLock(noteId)
            AppState.refreshCurrent()
            AppState.toast("Note locked")
        } else {
            AppState.toast(mode === "change" ? "PIN changed" : "PIN set")
        }
    }

    Field {
        id: current
        visible: dlg.mode !== "set"
        Layout.fillWidth: true
        echoMode: TextInput.Password
        mono: true
        placeholderText: "Current PIN"
        onAccepted: dlg.mode === "remove" ? dlg.submit() : next.forceActiveFocus()
    }
    Field {
        id: next
        visible: dlg.mode !== "remove"
        Layout.fillWidth: true
        echoMode: TextInput.Password
        mono: true
        placeholderText: dlg.mode === "change" ? "New PIN" : "Enter PIN"
        onAccepted: dlg.submit()
    }
    Text {
        textFormat: Text.PlainText
        id: error
        visible: text !== ""
        color: Theme.c.dangerText
        font.pixelSize: Theme.fontSm
    }

    footer: [
        TextButton { text: "Cancel"; onClicked: dlg.close() },
        TextButton {
            text: dlg.mode === "remove" ? "Remove" : dlg.mode === "change" ? "Change" : "Set PIN"
            variant: dlg.mode === "remove" ? "danger" : "primary"
            onClicked: dlg.submit()
        }
    ]
}
