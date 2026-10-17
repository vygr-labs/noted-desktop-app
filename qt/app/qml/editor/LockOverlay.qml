import QtQuick
import QtQuick.Layouts
import Noted

// Shown instead of a locked note's content. The content is never loaded
// into the editor until the PIN checks out.
Rectangle {
    id: overlay
    property string noteId: ""
    signal unlocked()

    color: Theme.c.window

    function tryUnlock() {
        if (Store.verifyLockPin(pin.text)) {
            Store.markUnlocked(noteId)
            pin.text = ""
            error.text = ""
            overlay.unlocked()
        } else {
            error.text = "Incorrect PIN"
            shake.restart()
            pin.selectAll()
        }
    }

    ColumnLayout {
        id: box
        anchors.centerIn: parent
        spacing: 10
        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            width: 60
            height: 60
            radius: Theme.radiusXl
            color: Theme.c.hover
            Icon { anchors.centerIn: parent; name: "lock"; size: 26; color: Theme.c.muted }
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "This note is locked"
            color: Theme.c.text
            font.pixelSize: Theme.fontXl
            font.weight: Font.DemiBold
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "Enter your PIN to view it"
            color: Theme.c.muted
            font.pixelSize: Theme.fontMd
        }
        Field {
            id: pin
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 200
            Layout.topMargin: 6
            echoMode: TextInput.Password
            horizontalAlignment: TextInput.AlignHCenter
            mono: true
            font.pixelSize: 16
            font.letterSpacing: 4
            maximumLength: 20
            placeholderText: "PIN"
            onAccepted: overlay.tryUnlock()
            transform: Translate { id: nudge }
            SequentialAnimation {
                id: shake
                NumberAnimation { target: nudge; property: "x"; to: -8; duration: 45 }
                NumberAnimation { target: nudge; property: "x"; to: 8; duration: 70 }
                NumberAnimation { target: nudge; property: "x"; to: 0; duration: 45 }
            }
        }
        Text {
            id: error
            Layout.alignment: Qt.AlignHCenter
            color: Theme.c.dangerText
            font.pixelSize: Theme.fontSm
            visible: text !== ""
        }
        TextButton {
            Layout.alignment: Qt.AlignHCenter
            text: "Unlock"
            variant: "primary"
            onClicked: overlay.tryUnlock()
        }
    }

    onVisibleChanged: if (visible) pin.forceActiveFocus()
}
