import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// A to-do's due date: Today, Tomorrow, Next week, Next weekend, a
// Monday-first month, and Remove date. 272px wide.
Popup {
    id: picker
    // In the window's own scene: clamped to it, closed by a press outside.
    popupType: Popup.Item
    property string due: ""          // the current ISO date, "" for none
    property date month: new Date()
    signal picked(string iso)        // "" removes the date

    width: 272
    padding: 6
    focus: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    function openUnder(item, dx, current) {
        due = current || ""
        const base = due ? Fmt.fromIso(due) : Fmt.fromIso(AppState.todayIso)
        month = new Date(base.getFullYear(), base.getMonth(), 1)
        const win = item.Window.contentItem || item
        parent = win
        const p = item.mapToItem(win, dx || 0, item.height + 6)
        x = Math.max(8, Math.min(p.x, win.width - width - 8))
        y = p.y + implicitHeight > win.height - 8 ? Math.max(8, item.mapToItem(win, 0, 0).y - implicitHeight - 6) : p.y
        open()
    }
    function pick(iso) { close(); picked(iso) }

    readonly property date today: Fmt.fromIso(AppState.todayIso)
    function plus(days) { const d = new Date(today); d.setDate(d.getDate() + days); return d }
    readonly property var quick: {
        const dow = today.getDay()
        const toMonday = ((8 - dow) % 7) || 7
        const toSaturday = ((6 - dow + 7) % 7) || 7
        const short = (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]
        return [
            { label: "Today", hint: short(today), date: today },
            { label: "Tomorrow", hint: short(plus(1)), date: plus(1) },
            { label: "Next week", hint: short(plus(toMonday)) + " " + plus(toMonday).getDate(), date: plus(toMonday) },
            { label: "Next weekend", hint: short(plus(toSaturday)) + " " + plus(toSaturday).getDate(), date: plus(toSaturday) }
        ]
    }
    readonly property var cells: {
        const first = new Date(month.getFullYear(), month.getMonth(), 1)
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
        const out = []
        for (let i = 0; i < (first.getDay() + 6) % 7; ++i) out.push(0)
        for (let d = 1; d <= days; ++d) out.push(d)
        return out
    }

    enter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 90 } }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 70 } }
    background: Rectangle {
        color: Theme.c.raised
        radius: 10
        Shadow { anchors.fill: parent; radius: 10 }
    }

    contentItem: Column {
        spacing: 0
        Repeater {
            model: picker.quick
            delegate: Rectangle {
                required property var modelData
                width: 260
                height: 34
                radius: 6
                color: qArea.containsMouse ? Theme.c.pressed : "transparent"
                Text { textFormat: Text.PlainText; x: 10; anchors.verticalCenter: parent.verticalCenter; text: parent.modelData.label; color: Theme.c.ink2; font.pixelSize: 14 }
                Text {
                    textFormat: Text.PlainText
                    anchors.right: parent.right
                    anchors.rightMargin: 10
                    anchors.verticalCenter: parent.verticalCenter
                    text: parent.modelData.hint
                    color: Theme.c.muted
                    font.pointSize: Theme.pt(12.5)
                    font.features: { "tnum": 1 }
                }
                MouseArea { id: qArea; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: picker.pick(Fmt.isoOf(parent.modelData.date)) }
            }
        }
        Rectangle { x: 4; width: 252; height: 1; color: Theme.c.menuLine; anchors.margins: 6 }
        Item { width: 1; height: 6 }
        Column {
            x: 4
            width: 252
            RowLayout {
                width: parent.width
                height: 32
                spacing: 0
                Text { textFormat: Text.PlainText; Layout.fillWidth: true; leftPadding: 6; text: Fmt.monthTitle(picker.month); color: Theme.c.ink; font.pointSize: Theme.pt(13.5); font.weight: Font.Medium }
                IconButton { size: 28; iconSize: 14; icon: "chevron-left"; tooltip: "Previous month"; onClicked: picker.month = new Date(picker.month.getFullYear(), picker.month.getMonth() - 1, 1) }
                IconButton { size: 28; iconSize: 14; icon: "chevron-right"; tooltip: "Next month"; onClicked: picker.month = new Date(picker.month.getFullYear(), picker.month.getMonth() + 1, 1) }
            }
            Row {
                topPadding: 2
                bottomPadding: 4
                Repeater {
                    model: ["M", "T", "W", "T", "F", "S", "S"]
                    delegate: Text { textFormat: Text.PlainText; required property string modelData; width: 252 / 7; horizontalAlignment: Text.AlignHCenter; text: modelData; color: Theme.c.muted; font.pointSize: Theme.pt(11.5) }
                }
            }
            Grid {
                columns: 7
                rowSpacing: 2
                columnSpacing: 2
                Repeater {
                    model: picker.cells
                    delegate: Rectangle {
                        id: cell
                        required property int modelData
                        readonly property string iso: modelData ? Fmt.isoOf(new Date(picker.month.getFullYear(), picker.month.getMonth(), modelData)) : ""
                        readonly property bool on: iso !== "" && iso === picker.due
                        readonly property bool isToday: iso === AppState.todayIso
                        width: (252 - 12) / 7
                        height: 30
                        radius: 6
                        color: on ? Theme.c.accent : (dayArea.containsMouse && modelData ? Theme.c.pressed : "transparent")
                        Text {
                            textFormat: Text.PlainText
                            anchors.centerIn: parent
                            visible: cell.modelData > 0
                            text: cell.modelData
                            color: cell.on ? Theme.c.onAccent : cell.isToday ? Theme.c.accent : (cell.iso < AppState.todayIso ? Theme.c.faint : Theme.c.ink)
                            font.pixelSize: 13
                            font.weight: cell.on || cell.isToday ? Font.DemiBold : Font.Normal
                            font.features: { "tnum": 1 }
                        }
                        MouseArea { id: dayArea; anchors.fill: parent; enabled: cell.modelData > 0; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: picker.pick(cell.iso) }
                    }
                }
            }
            Item { width: 1; height: 2 }
        }
        Column {
            visible: picker.due !== ""
            Item { width: 1; height: 6 }
            Rectangle { x: 4; width: 252; height: 1; color: Theme.c.menuLine }
            Item { width: 1; height: 6 }
            Rectangle {
                width: 260
                height: 34
                radius: 6
                color: rmArea.containsMouse ? Theme.c.pressed : "transparent"
                Text { textFormat: Text.PlainText; x: 10; anchors.verticalCenter: parent.verticalCenter; text: "Remove date"; color: Theme.c.secondary; font.pixelSize: 14 }
                MouseArea { id: rmArea; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: picker.pick("") }
            }
        }
    }
}
