import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// The "/" menu: ten blocks, filtered by what's typed after the slash (names
// and aliases). The editor drives it: it passes keys in and runs the pick.
Popup {
    id: slash
    // In the window's own scene: clamped to it, closed by a press outside.
    popupType: Popup.Item
    property string query: ""
    property int current: 0
    signal picked(string kind)

    width: 300
    padding: 6
    focus: false              // the editor keeps the keyboard
    closePolicy: Popup.CloseOnPressOutside

    readonly property var blocks: [
        { kind: "p", label: "Text", md: "", glyph: "T", aliases: "paragraph plain" },
        { kind: "h2", label: "Heading", md: "##", glyph: "H", aliases: "h2 title" },
        { kind: "h3", label: "Subheading", md: "###", glyph: "H", small: true, aliases: "h3" },
        { kind: "task", label: "To-do", md: "[ ]", icon: "square-check", aliases: "todo task check checkbox" },
        { kind: "li", label: "Bulleted list", md: "-", glyph: "•", aliases: "bullet unordered ul" },
        { kind: "ol", label: "Numbered list", md: "1.", glyph: "1.", aliases: "ordered number ol" },
        { kind: "quote", label: "Quote", md: ">", glyph: "“", aliases: "blockquote" },
        { kind: "code", label: "Code block", md: "```", glyph: "{ }", aliases: "snippet pre" },
        { kind: "table", label: "Table", md: "", icon: "table", aliases: "grid columns" },
        { kind: "hr", label: "Divider", md: "---", glyph: "—", aliases: "rule line hr separator" }
    ]
    readonly property var items: {
        const q = query.toLowerCase()
        return blocks.filter(b => q === "" || b.label.toLowerCase().indexOf(q) >= 0 || b.aliases.split(" ").some(a => a.indexOf(q) === 0))
    }
    onItemsChanged: current = Math.min(current, Math.max(0, items.length - 1))
    onQueryChanged: current = 0

    // Returns true when the key was the menu's.
    function key(e) {
        if (e.key === Qt.Key_Down) { current = items.length ? (current + 1) % items.length : 0; return true }
        if (e.key === Qt.Key_Up) { current = items.length ? (current + items.length - 1) % items.length : 0; return true }
        if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter || e.key === Qt.Key_Tab) {
            if (items.length) picked(items[current].kind)
            else close()
            return true
        }
        if (e.key === Qt.Key_Escape) { close(); return true }
        return false
    }

    background: Rectangle {
        color: Theme.c.raised
        radius: 10
        Shadow { anchors.fill: parent; radius: 10 }
    }

    contentItem: Column {
        spacing: 0
        Repeater {
            model: slash.items
            delegate: Rectangle {
                id: row
                required property var modelData
                required property int index
                width: 288
                height: 34
                radius: 6
                color: index === slash.current ? Theme.c.pressed : "transparent"
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 6
                    anchors.rightMargin: 10
                    spacing: 10
                    Item {
                        Layout.preferredWidth: 24
                        Layout.preferredHeight: 24
                        Text {
                            textFormat: Text.PlainText
                            visible: !row.modelData.icon
                            anchors.centerIn: parent
                            text: row.modelData.glyph || ""
                            color: Theme.c.secondary
                            font.pixelSize: row.modelData.small ? 12 : 15
                            font.weight: row.modelData.kind === "h2" || row.modelData.kind === "h3" ? Font.DemiBold : Font.Normal
                        }
                        Icon { visible: !!row.modelData.icon; anchors.centerIn: parent; name: row.modelData.icon || ""; size: 16; color: Theme.c.secondary }
                    }
                    Text { textFormat: Text.PlainText; Layout.fillWidth: true; text: row.modelData.label; color: Theme.c.ink2; font.pixelSize: 14 }
                    Text { textFormat: Text.PlainText; text: row.modelData.md; color: Theme.c.muted; font.family: Theme.monoFamily; font.pixelSize: 12 }
                }
                MouseArea {
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: slash.current = row.index
                    onClicked: slash.picked(row.modelData.kind)
                }
            }
        }
        Text {
            textFormat: Text.PlainText
            visible: slash.items.length === 0
            leftPadding: 10
            topPadding: 8
            bottomPadding: 8
            text: "No block called “" + slash.query + "”"
            color: Theme.c.muted
            font.pointSize: Theme.pt(13.5)
        }
        Item { width: 1; height: 6 }
        Rectangle { width: 288; height: 1; color: Theme.c.menuLine }
        Row {
            leftPadding: 10
            topPadding: 8
            bottomPadding: 4
            spacing: 14
            Repeater {
                model: ["↑↓ to move", "Enter to insert", "Esc to close"]
                delegate: Text { textFormat: Text.PlainText; required property string modelData; text: modelData; color: Theme.c.muted; font.pixelSize: 12 }
            }
        }
    }
}
