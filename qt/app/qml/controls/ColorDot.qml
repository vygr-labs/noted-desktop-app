import QtQuick
import Noted

Rectangle {
    property string swatch: "gray"
    property real size: 8
    width: size
    height: size
    radius: size / 2
    color: Theme.swatch(swatch)
}
