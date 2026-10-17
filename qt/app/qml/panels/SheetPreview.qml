import QtQuick
import Noted
import "../Fmt.js" as Fmt

// A small render of a note's first blocks (Store.previewBlocks), at 45% of
// the note's own spacing, for list sheets.
Column {
    id: mini
    property var blocks: []

    Repeater {
        model: mini.blocks
        delegate: Item {
            id: blk
            required property var modelData
            required property int index
            readonly property string t: modelData.t === "h1" ? "h2" : modelData.t
            readonly property real gap: Math.round(Fmt.gapFor(index > 0 ? (mini.blocks[index - 1].t === "h1" ? "h2" : mini.blocks[index - 1].t) : "", t) * 0.45)
            width: mini.width
            height: gap + content.height

            Item {
                id: content
                y: blk.gap
                width: parent.width
                height: blk.t === "hr" ? 1 : (blk.t === "code" ? code.implicitHeight + 12 : line.implicitHeight)

                Rectangle { visible: blk.t === "hr"; width: parent.width; height: 1; color: Theme.c.line }
                Rectangle {
                    visible: blk.t === "code"
                    width: parent.width
                    height: parent.height
                    radius: 5
                    color: Theme.c.codeBg
                    Text {
                        id: code
                        x: 8
                        y: 6
                        width: parent.width - 16
                        text: blk.modelData.text
                        color: Theme.c.ink2
                        font.family: Theme.monoFamily
                        font.pointSize: Theme.pt(9.5)
                        lineHeightMode: Text.FixedHeight
                        lineHeight: Math.round(9.5 * 1.5)
                        maximumLineCount: 4
                        clip: true
                    }
                }
                Rectangle {
                    visible: blk.t === "task"
                    y: 3
                    width: 10
                    height: 10
                    radius: 3
                    color: blk.modelData.checked ? Theme.c.accent : "transparent"
                    border.width: blk.modelData.checked ? 0 : 1.2
                    border.color: Theme.c.faint
                }
                Text {
                    visible: blk.t === "li" || blk.t === "ol"
                    text: blk.t === "ol" ? "1." : "•"
                    color: Theme.c.faint
                    font.pointSize: Theme.pt(11.5)
                }
                Rectangle { visible: blk.t === "quote"; width: 2; height: parent.height; color: Theme.c.quote }
                Text {
                    id: line
                    visible: blk.t !== "hr" && blk.t !== "code"
                    x: blk.t === "task" ? 17 : (blk.t === "li" || blk.t === "ol") ? 12 : blk.t === "quote" ? 8 : 0
                    width: parent.width - x
                    text: blk.modelData.text || " "
                    color: blk.t === "h2" || blk.t === "h3" ? Theme.c.ink : (blk.t === "task" && blk.modelData.checked ? Theme.c.muted : Theme.c.secondary)
                    font.pointSize: Theme.pt(blk.t === "h2" ? 12.5 : blk.t === "h3" ? 12 : 11.5)
                    font.weight: blk.t === "h2" || blk.t === "h3" ? Font.DemiBold : Font.Normal
                    font.italic: blk.t === "quote"
                    font.strikeout: blk.t === "task" && blk.modelData.checked
                    lineHeightMode: Text.FixedHeight
                    lineHeight: blk.t === "h2" ? 17.5 : blk.t === "h3" ? 16.8 : 17.8
                    wrapMode: Text.Wrap
                    maximumLineCount: 4
                    elide: Text.ElideRight
                }
            }
        }
    }
}
