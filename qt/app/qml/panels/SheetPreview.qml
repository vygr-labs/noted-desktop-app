import QtQuick
import Noted
import "../Fmt.js" as Fmt

// A small render of a note's first blocks (Store.previewBlocks), at 45% of
// the note's own spacing, for list sheets. A list page shows dozens of these,
// so each block builds only what its kind needs.
Column {
    id: mini
    property var blocks: []

    component Line: Text {
        property string kind: "p"
        property bool done: false
        textFormat: Text.PlainText
        color: kind === "h2" || kind === "h3" ? Theme.c.ink : (kind === "task" && done ? Theme.c.muted : Theme.c.secondary)
        font.pointSize: Theme.pt(kind === "h2" ? 12.5 : kind === "h3" ? 12 : 11.5)
        font.weight: kind === "h2" || kind === "h3" ? Font.DemiBold : Font.Normal
        font.italic: kind === "quote"
        font.strikeout: kind === "task" && done
        lineHeightMode: Text.FixedHeight
        lineHeight: kind === "h2" ? 17.5 : kind === "h3" ? 16.8 : 17.8
        wrapMode: Text.Wrap
        maximumLineCount: 4
        elide: Text.ElideRight
    }

    Component {
        id: ruleC
        Rectangle { width: mini.width; height: 1; color: Theme.c.line }
    }
    Component {
        id: codeC
        Rectangle {
            property var b: ({})
            width: mini.width
            height: code.implicitHeight + 12
            radius: 5
            color: Theme.c.codeBg
            Text {
                id: code
                textFormat: Text.PlainText
                x: 8
                y: 6
                width: parent.width - 16
                text: parent.b.text || ""
                color: Theme.c.ink2
                font.family: Theme.monoFamily
                font.pointSize: Theme.pt(9.5)
                lineHeightMode: Text.FixedHeight
                lineHeight: Math.round(9.5 * 1.5)
                maximumLineCount: 4
                clip: true
            }
        }
    }
    Component {
        id: textC
        Line { property var b: ({}); width: mini.width; kind: b.t || "p"; text: b.text || " " }
    }
    // A to-do, bullet or quote: a mark, then the line.
    Component {
        id: markedC
        Item {
            property var b: ({})
            width: mini.width
            height: line.implicitHeight
            Rectangle {
                visible: parent.b.t === "task"
                y: 3
                width: 10
                height: 10
                radius: 3
                color: parent.b.checked ? Theme.c.accent : "transparent"
                border.width: parent.b.checked ? 0 : 1.2
                border.color: Theme.c.faint
            }
            Rectangle { visible: parent.b.t === "quote"; width: 2; height: parent.height; color: Theme.c.quote }
            Text {
                visible: parent.b.t === "li" || parent.b.t === "ol"
                textFormat: Text.PlainText
                text: parent.b.t === "ol" ? "1." : "•"
                color: Theme.c.faint
                font.pointSize: Theme.pt(11.5)
            }
            Line {
                id: line
                x: parent.b.t === "task" ? 17 : parent.b.t === "quote" ? 8 : 12
                width: parent.width - x
                kind: parent.b.t || "p"
                done: !!parent.b.checked
                text: parent.b.text || " "
            }
        }
    }

    Repeater {
        model: mini.blocks
        delegate: Item {
            id: blk
            required property var modelData
            required property int index
            readonly property string t: modelData.t === "h1" ? "h2" : modelData.t
            readonly property string prevT: index > 0 ? (mini.blocks[index - 1].t === "h1" ? "h2" : mini.blocks[index - 1].t) : ""
            readonly property real gap: Math.round(Fmt.gapFor(prevT, t) * 0.45)
            width: mini.width
            height: gap + kindLoader.height
            Loader {
                id: kindLoader
                y: blk.gap
                width: mini.width
                sourceComponent: blk.t === "hr" ? ruleC : blk.t === "code" ? codeC
                               : (blk.t === "task" || blk.t === "li" || blk.t === "ol" || blk.t === "quote") ? markedC : textC
                onLoaded: if (item.hasOwnProperty("b")) item.b = { t: blk.t, text: blk.modelData.text, checked: blk.modelData.checked }
            }
        }
    }
}
