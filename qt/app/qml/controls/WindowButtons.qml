import QtQuick
import Noted

// Minimize / maximize / close for the frameless main window. Sits in the top
// right corner over whichever pane is there; panes leave `width` free.
Row {
    id: buttons
    property var window

    height: 38

    Repeater {
        model: [
            { icon: "minus", action: "min" },
            { icon: buttons.window && buttons.window.visibility === Window.Maximized ? "copy" : "square", action: "max" },
            { icon: "x", action: "close" }
        ]
        delegate: Rectangle {
            required property var modelData
            width: 46
            height: buttons.height
            color: winArea.containsMouse ? (modelData.action === "close" ? "#d0443a" : Theme.c.hover) : "transparent"
            Icon {
                anchors.centerIn: parent
                name: parent.modelData.icon
                size: parent.modelData.action === "close" ? 15 : (parent.modelData.action === "max" ? 11 : 14)
                color: winArea.containsMouse && parent.modelData.action === "close" ? "white" : Theme.c.subtle
            }
            MouseArea {
                id: winArea
                anchors.fill: parent
                hoverEnabled: true
                onClicked: {
                    const w = buttons.window
                    if (parent.modelData.action === "min") w.showMinimized()
                    else if (parent.modelData.action === "max") w.visibility === Window.Maximized ? w.showNormal() : w.showMaximized()
                    else w.close()
                }
            }
        }
    }
}
