import QtQuick
import QtQuick.Layouts
import Noted

// Floats 10px above a text selection: Bold, Italic, Strike, Inline code,
// Link, Highlight | Turn into ▾. Positioned by the note page.
Rectangle {
    id: bar
    property var editor            // EditorController
    signal linkRequested()

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

    readonly property string blockLabel: {
        const e = editor
        if (!e) return "Text"
        if (e.headingLevel === 1 || e.headingLevel === 2) return "Heading"
        if (e.headingLevel === 3) return "Subheading"
        if (e.listKind === 0) return "Bulleted list"
        if (e.listKind === 1) return "Numbered list"
        if (e.listKind === 2) return "To-do"
        if (e.inQuote) return "Quote"
        if (e.inCodeBlock) return "Code block"
        return "Text"
    }

    Row {
        id: row
        x: 4
        anchors.verticalCenter: parent.verticalCenter
        spacing: 2
        Btn { icon: "bold"; tooltip: "Bold"; shortcut: "Ctrl+B"; checked: !!bar.editor && bar.editor.bold; onClicked: bar.editor.toggleBold() }
        Btn { icon: "italic"; tooltip: "Italic"; shortcut: "Ctrl+I"; checked: !!bar.editor && bar.editor.italic; onClicked: bar.editor.toggleItalic() }
        Btn { icon: "strikethrough"; tooltip: "Strikethrough"; shortcut: "Ctrl+Shift+S"; checked: !!bar.editor && bar.editor.strike; onClicked: bar.editor.toggleStrike() }
        Btn { icon: "code"; tooltip: "Inline code"; shortcut: "Ctrl+E"; checked: !!bar.editor && bar.editor.code; onClicked: bar.editor.toggleCode() }
        Btn { icon: "link"; tooltip: "Link"; shortcut: "Ctrl+K"; checked: !!bar.editor && bar.editor.linkHref !== ""; onClicked: bar.linkRequested() }
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
                Text { text: bar.blockLabel; color: Theme.c.text2; font.pointSize: Theme.pt(13.5); anchors.verticalCenter: parent.verticalCenter }
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
    function openTurnInto() {
        const e = editor
        const plainBlock = () => {
            if (e.headingLevel > 0) e.setHeading(0)
            if (e.listKind >= 0) e.toggleList(e.listKind)
            if (e.inQuote) e.toggleQuote()
            if (e.inCodeBlock) e.toggleCodeBlock()
        }
        const list = (k) => () => { if (e.listKind !== k) { plainBlock(); e.toggleList(k) } }
        turnMenu.openBelow(turnInto, [
            { text: "Text", checked: blockLabel === "Text", action: plainBlock },
            { text: "Heading", checked: blockLabel === "Heading", action: () => { plainBlock(); e.setHeading(2) } },
            { text: "Subheading", checked: blockLabel === "Subheading", action: () => { plainBlock(); e.setHeading(3) } },
            { text: "To-do", checked: blockLabel === "To-do", action: list(2) },
            { text: "Bulleted list", checked: blockLabel === "Bulleted list", action: list(0) },
            { text: "Numbered list", checked: blockLabel === "Numbered list", action: list(1) },
            { text: "Quote", checked: blockLabel === "Quote", action: () => { if (!e.inQuote) { plainBlock(); e.toggleQuote() } } },
            { text: "Code block", checked: blockLabel === "Code block", action: () => { if (!e.inCodeBlock) { plainBlock(); e.toggleCodeBlock() } } }
        ])
    }
}
