import QtQuick

// Invisible resize handles along the edges of a frameless window.
Item {
    id: frame
    property var window
    property int grip: 5
    anchors.fill: parent
    visible: window && window.visibility !== Window.Maximized && window.visibility !== Window.FullScreen
    z: 1000

    component Edge: MouseArea {
        property int edges: 0
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton
        onPressed: frame.window.startSystemResize(edges)
    }

    Edge { edges: Qt.LeftEdge; cursorShape: Qt.SizeHorCursor; x: 0; y: frame.grip; width: frame.grip; height: parent.height - 2 * frame.grip }
    Edge { edges: Qt.RightEdge; cursorShape: Qt.SizeHorCursor; x: parent.width - frame.grip; y: frame.grip; width: frame.grip; height: parent.height - 2 * frame.grip }
    Edge { edges: Qt.TopEdge; cursorShape: Qt.SizeVerCursor; x: frame.grip; y: 0; width: parent.width - 2 * frame.grip; height: 3 }
    Edge { edges: Qt.BottomEdge; cursorShape: Qt.SizeVerCursor; x: frame.grip; y: parent.height - frame.grip; width: parent.width - 2 * frame.grip; height: frame.grip }
    Edge { edges: Qt.TopEdge | Qt.LeftEdge; cursorShape: Qt.SizeFDiagCursor; width: frame.grip * 2; height: frame.grip * 2 }
    Edge { edges: Qt.TopEdge | Qt.RightEdge; cursorShape: Qt.SizeBDiagCursor; x: parent.width - width; width: frame.grip * 2; height: frame.grip * 2 }
    Edge { edges: Qt.BottomEdge | Qt.LeftEdge; cursorShape: Qt.SizeBDiagCursor; y: parent.height - height; width: frame.grip * 2; height: frame.grip * 2 }
    Edge { edges: Qt.BottomEdge | Qt.RightEdge; cursorShape: Qt.SizeFDiagCursor; x: parent.width - width; y: parent.height - height; width: frame.grip * 2; height: frame.grip * 2 }
}
