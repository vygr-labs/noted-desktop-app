import QtQuick
import QtQuick.Layouts
import Noted

// Floats 10px above a text selection: Bold, Italic, Strike, Inline code,
// Link, Highlight | Turn into ▾. Give it the RichEditor and put it in an item
// that doesn't scroll (the page); it shows between that item's `topLimit` and
// `bottomLimit`, flipping below the selection when there's no room above.
Rectangle {
    id: bar
    property var richEditor        // RichEditor
    readonly property var editor: richEditor ? richEditor.controller : null
    property bool allowed: true
    property real topLimit: 0
    property real bottomLimit: parent ? parent.height : 0
    property real scrollY: 0       // the page's contentY, so the bar follows scrolling

    readonly property var edit: richEditor ? richEditor.textEdit : null
    readonly property bool hasSelection: !!edit && edit.selectionStart !== edit.selectionEnd
    readonly property rect a: { scrollY; if (!edit) return Qt.rect(0, 0, 0, 0); edit.width; return edit.positionToRectangle(edit.selectionStart) }
    readonly property rect b: { scrollY; if (!edit) return Qt.rect(0, 0, 0, 0); edit.width; return edit.positionToRectangle(edit.selectionEnd) }
    readonly property point selTop: { scrollY; return edit ? edit.mapToItem(parent, a.x, a.y) : Qt.point(0, 0) }
    readonly property point selBottom: { scrollY; return edit ? edit.mapToItem(parent, b.x, b.y + b.height) : Qt.point(0, 0) }
    visible: allowed && !!edit && !richEditor.readOnly && hasSelection && (edit.activeFocus || menuOpen)
             && selTop.y > topLimit - 20 && selTop.y < bottomLimit
    x: !edit ? 0 : Math.max(8, Math.min(parent.width - width - 8, (a.y === b.y ? (selTop.x + edit.mapToItem(parent, b.x, 0).x) / 2 : edit.mapToItem(parent, edit.width / 2, 0).x) - width / 2))
    y: selTop.y - height - 10 < topLimit + 4 ? selBottom.y + 10 : selTop.y - height - 10
    z: 5

    width: row.implicitWidth + 8
    height: 36
    radius: 9
    color: Theme.c.raised
    Shadow { anchors.fill: parent; radius: 9 }

    component Btn: Rectangle {
        id: b
        property string icon: ""
        property string tooltip: ""
        property string shortcut: ""
        property bool checked: false
        signal clicked()
        width: 28
        height: 28
        radius: 6
        color: checked || area.pressed ? Theme.c.pressed : (area.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
        Icon { anchors.centerIn: parent; name: b.icon; size: 15; color: b.checked ? Theme.c.ink : Theme.c.text2 }
        MouseArea {
            id: area
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            // Fire on press so the editor keeps its selection and focus.
            onPressed: b.clicked()
        }
        Tip { visible: area.containsMouse && !area.pressed; text: b.tooltip; shortcut: b.shortcut }
    }

    readonly property string blockLabel: richEditor ? richEditor.blockLabel : "Text"

    Row {
        id: row
        x: 4
        anchors.verticalCenter: parent.verticalCenter
        spacing: 2
        Btn { icon: "bold"; tooltip: "Bold"; shortcut: "Ctrl+B"; checked: !!bar.editor && bar.editor.bold; onClicked: bar.editor.toggleBold() }
        Btn { icon: "italic"; tooltip: "Italic"; shortcut: "Ctrl+I"; checked: !!bar.editor && bar.editor.italic; onClicked: bar.editor.toggleItalic() }
        Btn { icon: "strikethrough"; tooltip: "Strikethrough"; shortcut: "Ctrl+Shift+S"; checked: !!bar.editor && bar.editor.strike; onClicked: bar.editor.toggleStrike() }
        Btn { icon: "code"; tooltip: "Inline code"; shortcut: "Ctrl+E"; checked: !!bar.editor && bar.editor.code; onClicked: bar.editor.toggleCode() }
        Btn { icon: "link"; tooltip: "Link"; shortcut: "Ctrl+K"; checked: !!bar.editor && bar.editor.linkHref !== ""; onClicked: bar.richEditor.openLinkDialog() }
        Btn { icon: "highlighter"; tooltip: "Highlight"; shortcut: "Ctrl+Shift+H"; checked: !!bar.editor && bar.editor.highlight; onClicked: bar.editor.toggleHighlight() }
        Rectangle { width: 1; height: 18; anchors.verticalCenter: parent.verticalCenter; color: Theme.c.menuLine }
        Rectangle {
            id: turnInto
            width: turnRow.implicitWidth + 16
            height: 28
            radius: 6
            color: turnMenu.opened || turnArea.pressed ? Theme.c.pressed : (turnArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
            Row {
                id: turnRow
                anchors.centerIn: parent
                spacing: 6
                Text { textFormat: Text.PlainText; text: bar.blockLabel; color: Theme.c.text2; font.pointSize: Theme.pt(13.5); anchors.verticalCenter: parent.verticalCenter }
                Icon { name: "chevron-down"; size: 11; color: Theme.c.muted; anchors.verticalCenter: parent.verticalCenter }
            }
            MouseArea {
                id: turnArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onPressed: bar.openTurnInto()
            }
        }
    }

    PopupMenu { id: turnMenu; minWidth: 200 }
    readonly property bool menuOpen: turnMenu.opened
    function openTurnInto() { turnMenu.openBelow(turnInto, richEditor.turnIntoItems()) }
}
