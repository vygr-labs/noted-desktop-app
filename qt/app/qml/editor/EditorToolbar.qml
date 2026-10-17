import QtQuick
import QtQuick.Layouts
import Noted

// Formatting toolbar. Horizontal (top/bottom): a compact pill with a block
// type picker, marks, lists, blocks and an overflow menu. Vertical
// (left/right): a plain column of the same buttons. Buttons fire on press so
// the editor keeps its selection.
Item {
    id: bar
    property EditorController editor
    property bool vertical: false
    signal linkRequested()

    implicitWidth: vertical ? flow.implicitWidth + 10 : pill.implicitWidth
    implicitHeight: vertical ? flow.implicitHeight + 10 : 38

    readonly property string blockLabel: {
        const e = bar.editor
        if (!e) return "Body"
        if (e.inCodeBlock) return "Code"
        if (e.headingLevel > 0) return "Heading " + e.headingLevel
        if (e.listKind === 0) return "Bullets"
        if (e.listKind === 1) return "Numbered"
        if (e.listKind === 2) return "Checklist"
        if (e.inQuote) return "Quote"
        return "Body"
    }

    // Turns the current block into `kind`, undoing whatever it is now.
    function setBlock(kind) {
        const e = bar.editor
        if (e.inCodeBlock && kind !== "code") e.toggleCodeBlock()
        if (e.listKind >= 0 && !(kind === "bullet" && e.listKind === 0) && !(kind === "ordered" && e.listKind === 1) && !(kind === "task" && e.listKind === 2))
            e.toggleList(e.listKind)
        if (e.inQuote && kind !== "quote") e.toggleQuote()
        switch (kind) {
        case "body": e.setHeading(0); break
        case "h1": e.setHeading(1); break
        case "h2": e.setHeading(2); break
        case "h3": e.setHeading(3); break
        case "bullet": if (e.listKind !== 0) e.toggleList(0); break
        case "ordered": if (e.listKind !== 1) e.toggleList(1); break
        case "task": if (e.listKind !== 2) e.toggleList(2); break
        case "quote": if (!e.inQuote) e.toggleQuote(); break
        case "code": if (!e.inCodeBlock) e.toggleCodeBlock(); break
        }
    }

    function openBlockMenu(item) {
        const e = bar.editor
        blockMenu.openBelow(item, [
            { text: "Body text", icon: "pilcrow", checked: bar.blockLabel === "Body", action: () => bar.setBlock("body") },
            { text: "Heading 1", icon: "heading-1", shortcut: "Ctrl+Alt+1", checked: e.headingLevel === 1, action: () => bar.setBlock("h1") },
            { text: "Heading 2", icon: "heading-2", shortcut: "Ctrl+Alt+2", checked: e.headingLevel === 2, action: () => bar.setBlock("h2") },
            { text: "Heading 3", icon: "heading-3", shortcut: "Ctrl+Alt+3", checked: e.headingLevel === 3, action: () => bar.setBlock("h3") },
            { separator: true },
            { text: "Bullet list", icon: "list", shortcut: "Ctrl+Shift+8", checked: e.listKind === 0, action: () => bar.setBlock("bullet") },
            { text: "Numbered list", icon: "list-ordered", shortcut: "Ctrl+Shift+7", checked: e.listKind === 1, action: () => bar.setBlock("ordered") },
            { text: "Checklist", icon: "list-todo", shortcut: "Ctrl+Shift+9", checked: e.listKind === 2, action: () => bar.setBlock("task") },
            { separator: true },
            { text: "Quote", icon: "text-quote", shortcut: "Ctrl+Shift+B", checked: e.inQuote, action: () => bar.setBlock("quote") },
            { text: "Code block", icon: "square-code", shortcut: "Ctrl+Alt+C", checked: e.inCodeBlock, action: () => bar.setBlock("code") }
        ])
    }

    function openMoreMenu(item) {
        const e = bar.editor
        const items = [
            { text: "Highlight", icon: "highlighter", shortcut: "Ctrl+Shift+H", checked: e.highlight, action: () => e.toggleHighlight() },
            { text: "Divider", icon: "minus", action: () => e.insertHorizontalRule() },
            { separator: true },
            { text: "Align left", icon: "align-left", action: () => e.alignLeft() },
            { text: "Clean & format", icon: "sparkles", action: () => e.cleanAndFormat() },
            { text: "Clear formatting", icon: "remove-formatting", shortcut: "Ctrl+\\", action: () => e.clearFormatting() }
        ]
        blockMenu.openBelow(item, items)
    }

    PopupMenu { id: blockMenu; minWidth: 220 }

    component Btn: IconButton {
        fireOnPress: true
        size: 28
        iconSize: 15
        radius: Theme.radius
    }
    component Sep: Rectangle {
        width: bar.vertical ? 18 : 1
        height: bar.vertical ? 1 : 16
        color: Theme.c.divider
        Layout.alignment: Qt.AlignCenter
        Layout.leftMargin: bar.vertical ? 0 : 3
        Layout.rightMargin: bar.vertical ? 0 : 3
        Layout.topMargin: bar.vertical ? 4 : 0
        Layout.bottomMargin: bar.vertical ? 4 : 0
    }

    // ── horizontal: the pill ───────────────────────────────────────────
    Rectangle {
        id: pill
        visible: !bar.vertical
        anchors.fill: parent
        implicitWidth: row.implicitWidth
        color: "transparent"

        RowLayout {
            id: row
            anchors.centerIn: parent
            spacing: 1

            // Block type picker: "Body ▾"
            Rectangle {
                id: blockPicker
                implicitWidth: 92
                implicitHeight: 28
                radius: Theme.radius
                color: pickArea.pressed ? Theme.c.press : (pickArea.containsMouse ? Theme.c.hover : "transparent")
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 10
                    anchors.rightMargin: 6
                    spacing: 4
                    Text {
                        text: bar.blockLabel
                        color: Theme.c.chipText
                        font.pixelSize: 13
                        Layout.fillWidth: true
                    }
                    Icon { name: "chevron-down"; size: 13; color: Theme.c.subtle }
                }
                MouseArea {
                    id: pickArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onPressed: bar.openBlockMenu(blockPicker)
                }
            }
            Sep {}
            Btn { icon: "bold"; tooltip: "Bold"; shortcut: "Ctrl+B"; checked: bar.editor.bold; onClicked: bar.editor.toggleBold() }
            Btn { icon: "italic"; tooltip: "Italic"; shortcut: "Ctrl+I"; checked: bar.editor.italic; onClicked: bar.editor.toggleItalic() }
            Btn { icon: "underline"; tooltip: "Underline"; shortcut: "Ctrl+U"; checked: bar.editor.underline; onClicked: bar.editor.toggleUnderline() }
            Btn { icon: "strikethrough"; tooltip: "Strikethrough"; shortcut: "Ctrl+Shift+S"; checked: bar.editor.strike; onClicked: bar.editor.toggleStrike() }
            Btn { icon: "code"; tooltip: "Inline code"; shortcut: "Ctrl+E"; checked: bar.editor.code; onClicked: bar.editor.toggleCode() }
            Sep {}
            Btn { icon: "list"; tooltip: "Bullet list"; shortcut: "Ctrl+Shift+8"; checked: bar.editor.listKind === 0; onClicked: bar.editor.toggleList(0) }
            Btn { icon: "list-ordered"; tooltip: "Numbered list"; shortcut: "Ctrl+Shift+7"; checked: bar.editor.listKind === 1; onClicked: bar.editor.toggleList(1) }
            Btn { icon: "list-todo"; tooltip: "Checklist"; shortcut: "Ctrl+Shift+9"; checked: bar.editor.listKind === 2; onClicked: bar.editor.toggleList(2) }
            Sep {}
            Btn { icon: "square-code"; tooltip: "Code block"; shortcut: "Ctrl+Alt+C"; checked: bar.editor.inCodeBlock; onClicked: bar.editor.toggleCodeBlock() }
            Btn { icon: "text-quote"; tooltip: "Quote"; shortcut: "Ctrl+Shift+B"; checked: bar.editor.inQuote; onClicked: bar.editor.toggleQuote() }
            Btn { icon: "table"; tooltip: "Insert table"; checked: bar.editor.inTable; onClicked: bar.editor.insertTable(3, 3) }
            Btn { icon: "link"; tooltip: "Link"; shortcut: "Ctrl+K"; checked: bar.editor.linkHref !== ""; onClicked: bar.linkRequested() }

            Sep { visible: bar.editor.inTable }
            Repeater {
                model: bar.editor.inTable ? tableOps : []
                delegate: tableOp
            }
            Btn { visible: bar.editor.inTable; icon: "trash-2"; tooltip: "Delete table"; danger: true; onClicked: bar.editor.tableDelete() }

            Sep {}
            Btn { id: moreBtn; icon: "ellipsis"; tooltip: "More formatting"; checked: bar.editor.highlight; onClicked: bar.openMoreMenu(moreBtn) }
        }
    }

    readonly property var tableOps: [
        { label: "+Row", tip: "Add row below", fn: () => bar.editor.tableInsertRow(true) },
        { label: "−Row", tip: "Delete row", fn: () => bar.editor.tableRemoveRow() },
        { label: "+Col", tip: "Add column after", fn: () => bar.editor.tableInsertColumn(true) },
        { label: "−Col", tip: "Delete column", fn: () => bar.editor.tableRemoveColumn() }
    ]
    Component {
        id: tableOp
        Rectangle {
            required property var modelData
            implicitWidth: bar.vertical ? 28 : tl.implicitWidth + 12
            implicitHeight: 26
            radius: Theme.radius
            color: ta.containsMouse ? Theme.c.hover : "transparent"
            Text {
                id: tl
                anchors.centerIn: parent
                text: parent.modelData.label
                color: Theme.c.muted
                font.pixelSize: 11
                font.weight: Font.Medium
            }
            MouseArea {
                id: ta
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onPressed: parent.modelData.fn()
            }
            Tip { visible: ta.containsMouse; text: parent.modelData.tip }
        }
    }

    // ── vertical: the same pill, standing up ───────────────────────────
    Rectangle {
        visible: bar.vertical
        anchors.fill: parent
        radius: 9
        color: Theme.c.raised
        border.color: Theme.c.border
    }
    ColumnLayout {
        id: flow
        visible: bar.vertical
        anchors.centerIn: parent
        spacing: 1

        Btn { icon: "pilcrow"; tooltip: "Text style"; onClicked: bar.openBlockMenu(this) }
        Sep {}
        Btn { icon: "bold"; tooltip: "Bold"; shortcut: "Ctrl+B"; checked: bar.editor.bold; onClicked: bar.editor.toggleBold() }
        Btn { icon: "italic"; tooltip: "Italic"; shortcut: "Ctrl+I"; checked: bar.editor.italic; onClicked: bar.editor.toggleItalic() }
        Btn { icon: "underline"; tooltip: "Underline"; shortcut: "Ctrl+U"; checked: bar.editor.underline; onClicked: bar.editor.toggleUnderline() }
        Btn { icon: "strikethrough"; tooltip: "Strikethrough"; shortcut: "Ctrl+Shift+S"; checked: bar.editor.strike; onClicked: bar.editor.toggleStrike() }
        Btn { icon: "code"; tooltip: "Inline code"; shortcut: "Ctrl+E"; checked: bar.editor.code; onClicked: bar.editor.toggleCode() }
        Sep {}
        Btn { icon: "list"; tooltip: "Bullet list"; checked: bar.editor.listKind === 0; onClicked: bar.editor.toggleList(0) }
        Btn { icon: "list-ordered"; tooltip: "Numbered list"; checked: bar.editor.listKind === 1; onClicked: bar.editor.toggleList(1) }
        Btn { icon: "list-todo"; tooltip: "Checklist"; checked: bar.editor.listKind === 2; onClicked: bar.editor.toggleList(2) }
        Sep {}
        Btn { icon: "square-code"; tooltip: "Code block"; checked: bar.editor.inCodeBlock; onClicked: bar.editor.toggleCodeBlock() }
        Btn { icon: "text-quote"; tooltip: "Quote"; checked: bar.editor.inQuote; onClicked: bar.editor.toggleQuote() }
        Btn { icon: "table"; tooltip: "Insert table"; checked: bar.editor.inTable; onClicked: bar.editor.insertTable(3, 3) }
        Btn { icon: "link"; tooltip: "Link"; checked: bar.editor.linkHref !== ""; onClicked: bar.linkRequested() }
        Sep {}
        Btn { icon: "ellipsis"; tooltip: "More formatting"; onClicked: bar.openMoreMenu(this) }
    }
}
