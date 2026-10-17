import QtQuick
import Noted

// Empty header space that moves the window (double-click maximizes). Put it
// behind a header's controls: they take their own clicks first.
MouseArea {
    acceptedButtons: Qt.LeftButton
    onPressed: Window.window.startSystemMove()
    onDoubleClicked: Window.window.visibility === Window.Maximized ? Window.window.showNormal() : Window.window.showMaximized()
}
