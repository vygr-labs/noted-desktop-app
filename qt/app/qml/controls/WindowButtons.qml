import QtQuick
import Noted

// Minimize / maximize / close for the frameless window: 46px wide, the
// header's full height, 1px-stroke glyphs like Windows draws them.
Row {
    id: buttons
    property var window

    Repeater {
        model: ["min", "max", "close"]
        delegate: Rectangle {
            id: btn
            required property string modelData
            width: 46
            height: buttons.height
            color: winArea.containsMouse ? (modelData === "close" ? "#C42B1C" : Qt.alpha(Theme.c.pressed, winArea.pressed ? 1 : 0.7)) : "transparent"
            readonly property color glyph: winArea.containsMouse && modelData === "close" ? "#FFFFFF" : Theme.c.secondary
            readonly property bool maximized: buttons.window && buttons.window.visibility === Window.Maximized

            // Minimize
            Rectangle { visible: btn.modelData === "min"; anchors.centerIn: parent; width: 10; height: 1; color: btn.glyph }
            // Maximize / restore
            Rectangle {
                visible: btn.modelData === "max"
                anchors.centerIn: parent
                anchors.horizontalCenterOffset: btn.maximized ? -1 : 0
                anchors.verticalCenterOffset: btn.maximized ? 1 : 0
                width: btn.maximized ? 8 : 9
                height: width
                color: "transparent"
                border.width: 1
                border.color: btn.glyph
                Rectangle {
                    visible: btn.maximized
                    x: 2
                    y: -3
                    width: 8
                    height: 8
                    z: -1
                    color: "transparent"
                    border.width: 1
                    border.color: btn.glyph
                }
            }
            // Close
            Item {
                visible: btn.modelData === "close"
                anchors.centerIn: parent
                width: 10
                height: 10
                Rectangle { anchors.centerIn: parent; width: 13; height: 1; rotation: 45; color: btn.glyph; antialiasing: true }
                Rectangle { anchors.centerIn: parent; width: 13; height: 1; rotation: -45; color: btn.glyph; antialiasing: true }
            }

            MouseArea {
                id: winArea
                anchors.fill: parent
                hoverEnabled: true
                onClicked: {
                    const w = buttons.window
                    if (btn.modelData === "min") w.showMinimized()
                    else if (btn.modelData === "max") w.visibility === Window.Maximized ? w.showNormal() : w.showMaximized()
                    else w.close()
                }
            }
        }
    }
}
