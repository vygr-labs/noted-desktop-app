import QtQuick
import Noted

// A Lucide glyph. Icon { name: "search"; size: 16; color: Theme.c.muted }
Text {
    property string name: ""
    property real size: 16

    text: Icons.get(name)
    font.family: Icons.family
    font.pixelSize: size
    color: Theme.c.muted
    width: size
    height: size
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignVCenter
    renderType: Text.QtRendering
}
