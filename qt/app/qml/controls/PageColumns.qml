import QtQuick
import QtQuick.Controls.Basic
import Noted

// The scrolling frame for desk, list, to-dos and search pages: content
// up to 1140px wide, padded 32/48/72, a main column (460–720px) and a
// 260–300px right column 56px beside it that wraps under on narrow windows.
//
//   PageColumns { mainContent: [ … ]; asideContent: [ … ] }
Flickable {
    id: page

    default property alias mainContent: mainCol.data
    property alias asideContent: asideCol.data
    property real asideTop: 4
    property bool hasAside: asideCol.children.length > 0
    property real maxMain: 720

    readonly property real frameW: Math.min(1140, width)
    readonly property real innerW: frameW - (width < 640 ? 32 : 96)
    readonly property bool wrapped: !hasAside || innerW < 460 + 56 + 260
    readonly property real mainW: wrapped ? Math.min(maxMain, innerW) : Math.min(maxMain, innerW - 56 - 260)
    readonly property real asideW: !hasAside ? 0 : wrapped ? Math.min(300, innerW) : Math.min(300, innerW - 56 - mainW)

    contentWidth: width
    contentHeight: frame.height
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    flickDeceleration: 4000
    maximumFlickVelocity: 5000
    ScrollBar.vertical: ScrollBarThin {}

    Item {
        id: frame
        x: (page.width - page.frameW) / 2 + (page.frameW - page.innerW) / 2
        width: page.innerW
        height: 32 + (page.wrapped ? mainCol.height + (page.hasAside ? 48 + asideCol.height : 0)
                                   : Math.max(mainCol.height, asideCol.height + page.asideTop)) + 72

        Column {
            id: mainCol
            y: 32
            width: page.mainW
        }
        Column {
            id: asideCol
            x: page.wrapped ? 0 : page.mainW + 56
            y: page.wrapped ? mainCol.y + mainCol.height + 48 : 32 + page.asideTop
            width: page.asideW
        }
    }
}
