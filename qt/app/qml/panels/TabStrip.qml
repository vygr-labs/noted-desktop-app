import QtQuick
import QtQuick.Layouts
import Noted

// Open tabs, above the header once there are two or more. The active tab is
// the page's colour and joins the page; the rest sit on the strip. Middle-
// click or the cross closes one, drag to reorder, + (Ctrl+T) opens Today in
// a new tab. Empty space drags the window, and the caption buttons move here.
Rectangle {
    id: strip

    property var window
    // The open note's title as it's typed.
    property string liveTitle: ""

    implicitHeight: 38
    color: Theme.c.sidebar

    PopupMenu { id: menu }

    DragArea { anchors.fill: parent }

    // The page's top edge, broken by the active tab.
    Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.c.line }

    readonly property real addW: 34
    readonly property real moreW: overflow ? 44 : 0
    readonly property real tabsW: width - caption.width - addW - moreW - 16
    // Tabs shrink to 96px; past that the strip shows a run of them around
    // the active one, and the rest are under the count button at the end.
    readonly property int fits: Math.max(1, Math.floor((width - caption.width - addW - 44 - 16) / 96))
    readonly property bool overflow: AppState.tabs.length > Math.max(1, Math.floor((width - caption.width - addW - 16) / 96))
    readonly property int shown: overflow ? fits : AppState.tabs.length
    readonly property int first: overflow ? Math.max(0, Math.min(AppState.activeTab - Math.floor(shown / 2), AppState.tabs.length - shown)) : 0
    readonly property real tabW: Math.max(96, Math.min(220, tabsW / Math.max(1, shown)))

    Item {
        id: tabsArea
        x: 8
        width: Math.min(strip.tabsW, strip.tabW * strip.shown)
        height: parent.height
        clip: true

        Repeater {
            id: tabRepeater
            model: AppState.tabs.length
            delegate: Item {
                id: tab
                required property int index
                readonly property var place: AppState.tabs[index] || ({})
                readonly property var info: AppState.tabInfo(place)
                readonly property bool active: index === AppState.activeTab
                readonly property string title: active && place.view === "note" && strip.liveTitle !== "" ? strip.liveTitle : info.title
                readonly property bool ringed: menu.opened && menu.owner === tab
                // Dragged, the tab follows the mouse and drops into the slot
                // it's over; the rest keep theirs.
                property bool dragging: false
                property real dragX: 0
                visible: index >= strip.first && index < strip.first + strip.shown
                x: dragging ? dragX : (index - strip.first) * strip.tabW
                y: 0
                z: dragging ? 2 : (active ? 1 : 0)
                width: strip.tabW
                height: strip.height
                Behavior on x { enabled: !tab.dragging; NumberAnimation { duration: Theme.fast; easing.type: Easing.OutCubic } }

                Rectangle {
                    anchors.fill: parent
                    anchors.topMargin: 6
                    anchors.bottomMargin: tab.active ? 0 : 1
                    radius: 7
                    color: tab.active ? Theme.c.bg : (tabArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.7) : "transparent")
                    border.width: tab.active ? 1 : (tab.ringed ? 1.5 : 0)
                    border.color: tab.ringed ? Theme.c.accent : Theme.c.line
                    // Square off the bottom so the tab runs into the page.
                    Rectangle {
                        visible: tab.active
                        x: 1
                        width: parent.width - 2
                        anchors.bottom: parent.bottom
                        height: 8
                        color: Theme.c.bg
                    }
                    Rectangle { visible: tab.active; x: 0; anchors.bottom: parent.bottom; width: 1; height: 8; color: Theme.c.line }
                    Rectangle { visible: tab.active; anchors.right: parent.right; anchors.bottom: parent.bottom; width: 1; height: 8; color: Theme.c.line }
                }
                // A hairline between two quiet tabs.
                Rectangle {
                    readonly property bool nextActive: tab.index + 1 === AppState.activeTab
                    visible: !tab.active && !nextActive && !tabArea.containsMouse && tab.index < AppState.tabs.length - 1
                    anchors.right: parent.right
                    y: 15
                    width: 1
                    height: 16
                    color: Theme.c.line
                }

                RowLayout {
                    x: 12
                    y: 6
                    width: parent.width - 12 - 6
                    height: parent.height - 6
                    spacing: 8
                    Icon {
                        visible: tab.info.icon !== ""
                        name: tab.info.icon
                        size: 14
                        color: tab.info.color !== "" ? Theme.swatch(tab.info.color) : Theme.c.muted
                    }
                    Text {
                        textFormat: Text.PlainText
                        Layout.fillWidth: true
                        text: tab.title
                        color: tab.active ? Theme.c.ink : Theme.c.secondary
                        font.pointSize: Theme.pt(13)
                        font.weight: tab.active ? Font.Medium : Font.Normal
                        elide: Text.ElideRight
                    }
                    IconButton {
                        opacity: tab.active || tabArea.containsMouse || hovered ? 1 : 0
                        size: 22
                        iconSize: 12
                        icon: "x"
                        tooltip: "Close tab"
                        shortcut: tab.active ? "Ctrl+W" : ""
                        onClicked: AppState.closeTab(tab.index)
                    }
                }

                MouseArea {
                    id: tabArea
                    anchors.fill: parent
                    anchors.topMargin: 6
                    anchors.rightMargin: 30   // the close button takes its own clicks
                    hoverEnabled: true
                    acceptedButtons: Qt.LeftButton | Qt.MiddleButton | Qt.RightButton
                    property real grabX: 0
                    property bool moved: false
                    onPressed: (e) => {
                        if (e.button !== Qt.LeftButton) return
                        AppState.switchTab(tab.index)
                        grabX = e.x
                        moved = false
                    }
                    onPositionChanged: (e) => {
                        if (!(e.buttons & Qt.LeftButton)) return
                        if (!moved && Math.abs(e.x - grabX) < 6) return
                        if (!moved) tab.dragX = tab.x
                        moved = true
                        tab.dragging = true
                        tab.dragX = Math.max(0, Math.min(tabsArea.width - tab.width, tab.dragX + e.x - grabX))
                    }
                    onReleased: {
                        if (!tab.dragging) return
                        const to = Math.max(0, Math.min(AppState.tabs.length - 1, strip.first + Math.round(tab.dragX / strip.tabW)))
                        tab.dragging = false
                        AppState.moveTab(tab.index, to)
                    }
                    onCanceled: tab.dragging = false
                    onClicked: (e) => {
                        if (e.button === Qt.MiddleButton) AppState.closeTab(tab.index)
                        else if (e.button === Qt.RightButton) menu.openAt(tab, e.x, e.y + 6, [
                            { text: "New tab", action: () => AppState.newTab() },
                            { text: "Close tab", disabled: AppState.tabs.length < 2, action: () => AppState.closeTab(tab.index) },
                            { text: "Close other tabs", disabled: AppState.tabs.length < 2, action: () => AppState.closeOtherTabs(tab.index) }
                        ])
                    }
                }
            }
        }
    }

    // The tabs that don't fit: how many, and a menu of every tab.
    Rectangle {
        id: moreButton
        visible: strip.overflow
        x: tabsArea.x + tabsArea.width + 4
        y: 6 + (strip.height - 6 - height) / 2
        width: moreRow.implicitWidth + 14
        height: 28
        radius: 6
        color: moreArea.pressed || menu.opened && menu.owner === moreButton ? Theme.c.pressed : (moreArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.6) : "transparent")
        Row {
            id: moreRow
            anchors.centerIn: parent
            spacing: 4
            Text {
                textFormat: Text.PlainText
                text: "+" + (AppState.tabs.length - strip.shown)
                color: Theme.c.secondary
                font.pointSize: Theme.pt(13)
                font.features: { "tnum": 1 }
                anchors.verticalCenter: parent.verticalCenter
            }
            Icon { name: "chevron-down"; size: 11; color: Theme.c.secondary; anchors.verticalCenter: parent.verticalCenter }
        }
        MouseArea {
            id: moreArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: menu.openAt(moreButton, 0, moreButton.height + 4, AppState.tabs.map((t, i) => ({
                text: AppState.tabInfo(t).title, checked: i === AppState.activeTab, action: () => AppState.switchTab(i)
            })), -4)
        }
    }

    IconButton {
        x: tabsArea.x + tabsArea.width + 4 + strip.moreW
        y: 6 + (strip.height - 6 - height) / 2
        size: 28
        iconSize: 15
        icon: "plus"
        tooltip: "New tab"
        shortcut: "Ctrl+T"
        onClicked: AppState.newTab()
    }

    WindowButtons {
        id: caption
        window: strip.window
        anchors.right: parent.right
        height: parent.height - 1
    }
}
