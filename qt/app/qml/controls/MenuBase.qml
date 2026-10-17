import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// Data-driven menu: `raised`, radius 10, 6px padding, 34px text rows.
//
//   menu.openAt(item, x, y, [
//       { text: "Pin", action: () => ... },
//       { separator: true },
//       { text: "Move to", children: [ { text: "Work", color: "blue", checked: true, action: … } ] },
//       { text: "Move to trash", danger: true, action: ... },
//   ])
//
// The menu opens at (x, y) in `item`, clamped inside the window; a submenu
// opens beside its row and flips left at the right edge. `owner` is the item
// it was opened from, so a sidebar row can keep its ring while it's open.
Popup {
    id: menu
    // In the window's own scene: clamped to it, closed by a press outside.
    popupType: Popup.Item

    property var items: []
    property real minWidth: 224
    property Item owner: null
    property int current: -1
    property bool isSub: false
    property var parentMenu: null   // the menu a submenu belongs to
    property var sub: null          // a submenu (PopupMenu sets one)

    padding: 6
    // Like a Windows menu, a click outside only closes it (nothing under it
    // gets the click). A submenu isn't modal, so the root's rows still work.
    modal: !isSub
    dim: false
    focus: true
    width: Math.max(minWidth, col.implicitWidth + leftPadding + rightPadding)
    // Not CloseOnPressOutsideParent: with both, a press must miss the parent too,
    // and the parent here is the whole window.
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    // Where it was asked to open, in the window, and where its bottom goes if
    // it has to flip above (no room below). Re-placed as its size settles.
    property point wanted: Qt.point(0, 0)
    property real flipBottom: 0
    property bool alignRight: false
    function openAt(item, px, py, list, flipAt) {
        items = list
        owner = item
        current = -1
        const win = item.Window.contentItem || item
        parent = win
        wanted = item.mapToItem(win, px, py)
        flipBottom = flipAt !== undefined ? item.mapToItem(win, 0, flipAt).y : wanted.y
        alignRight = false
        open()
        place()
    }
    function place() {
        if (isSub || !parent) return
        const w = width, h = implicitHeight, W = parent.width, H = parent.height
        let gx = alignRight ? wanted.x - w : wanted.x
        let gy = wanted.y
        if (gx + w > W - 8) gx = W - w - 8
        if (gy + h > H - 8) gy = flipBottom - h >= 8 ? flipBottom - h : H - h - 8
        x = Math.max(8, gx)
        y = Math.max(8, gy)
    }
    onImplicitHeightChanged: if (visible) place()
    onWidthChanged: if (visible) place()
    function openBelow(item, list) { openAt(item, 0, item.height + 4, list, -4) }
    // Right-aligned under the item (header buttons at the window's right).
    function openBelowRight(item, list) {
        openAt(item, item.width, item.height + 4, list, -4)
        alignRight = true
        place()
    }

    // Beside a row of a parent menu.
    function openBeside(row, list, parentPopup) {
        items = list
        current = -1
        const win = row.Window.contentItem || row
        parent = win
        const r = row.mapToItem(win, 0, 0)
        open()
        let gx = r.x + row.width + 10
        if (gx + width > win.width - 8) gx = r.x - width - 10
        let gy = r.y - 6
        if (gy + implicitHeight > win.height - 8) gy = Math.max(8, win.height - implicitHeight - 8)
        x = gx
        y = gy
    }

    function activate(i) {
        const it = items[i]
        if (!it || it.separator || it.header || it.disabled) return
        if (it.children) { openSub(i); return }
        closeAll()
        if (it.action) it.action()
    }
    function closeAll() {
        if (sub) sub.close()
        close()
        if (parentMenu) parentMenu.closeAll()
    }
    function openSub(i) {
        const row = rows.itemAt(i)
        if (!row || !sub) return
        sub.openBeside(row.row, items[i].children)
        sub.forceActiveFocus()
    }
    function step(delta) {
        let i = current
        for (let n = 0; n < items.length; ++n) {
            i = (i + delta + items.length) % items.length
            const it = items[i]
            if (!it.separator && !it.header && !it.disabled) { current = i; return }
        }
    }

    onClosed: { if (sub) sub.close(); owner = null }

    enter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 90 } }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 70 } }

    background: Rectangle {
        color: Theme.c.raised
        radius: 10
        Shadow { anchors.fill: parent; radius: 10 }
    }

    contentItem: ColumnLayout {
        id: col
        spacing: 0
        focus: true
        Keys.onPressed: (e) => {
            if (e.key === Qt.Key_Down) { menu.step(1); e.accepted = true }
            else if (e.key === Qt.Key_Up) { menu.step(-1); e.accepted = true }
            else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter || e.key === Qt.Key_Space) { menu.activate(menu.current); e.accepted = true }
            else if (e.key === Qt.Key_Right && menu.current >= 0 && menu.items[menu.current].children) { menu.openSub(menu.current); e.accepted = true }
            else if (e.key === Qt.Key_Left && menu.isSub) { menu.close(); e.accepted = true }
        }
        Repeater {
            id: rows
            model: menu.items
            delegate: ColumnLayout {
                id: entry
                required property var modelData
                required property int index
                property alias row: menuRow
                spacing: 0
                Layout.fillWidth: true

                Rectangle {
                    visible: !!entry.modelData.separator
                    Layout.fillWidth: true
                    Layout.preferredHeight: 1
                    Layout.topMargin: 6
                    Layout.bottomMargin: 6
                    Layout.leftMargin: 4
                    Layout.rightMargin: 4
                    color: Theme.c.menuLine
                }
                Text {
                    textFormat: Text.PlainText
                    visible: !!entry.modelData.header
                    text: entry.modelData.header || ""
                    color: Theme.c.tertiary
                    font.pixelSize: 12
                    font.weight: Font.Medium
                    Layout.leftMargin: 10
                    Layout.topMargin: 6
                    Layout.bottomMargin: 4
                }
                MenuRow {
                    id: menuRow
                    visible: !entry.modelData.separator && !entry.modelData.header
                    Layout.fillWidth: true
                    data_: entry.modelData
                    highlighted: menu.current === entry.index || (!!menu.sub && menu.sub.opened && menu.sub.items === entry.modelData.children)
                    onHoveredChanged: if (hovered) {
                        menu.current = entry.index
                        if (entry.modelData.children) subTimer.restart()
                        else { subTimer.stop(); if (menu.sub) menu.sub.close() }
                    }
                    onActivated: menu.activate(entry.index)
                }
            }
        }
    }

    Timer { id: subTimer; interval: 160; onTriggered: if (menu.current >= 0 && menu.items[menu.current].children) menu.openSub(menu.current) }
}
