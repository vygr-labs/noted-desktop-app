import QtQuick
import QtQuick.Layouts
import Noted
import "../Fmt.js" as Fmt

// Month grid for daily notes, Monday first. Today is an accent circle; days
// with a daily note are darker with a small dot under them. Clicking a day
// opens (or starts) its note.
Column {
    id: cal

    property date month: new Date()       // any day in the shown month
    signal dayPicked(string iso)

    spacing: 0

    readonly property string monthKey: Qt.formatDate(month, "yyyy-MM")
    property var marked: ({})
    function reloadMarks() {
        const m = {}
        for (const d of Store.dailyDates(monthKey)) m[d] = true
        marked = m
    }
    onMonthKeyChanged: reloadMarks()
    Component.onCompleted: reloadMarks()
    Connections { target: Store; function onNotesChanged() { cal.reloadMarks() } }

    function shift(delta) { month = new Date(month.getFullYear(), month.getMonth() + delta, 1) }

    readonly property var cells: {
        const first = new Date(month.getFullYear(), month.getMonth(), 1)
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
        const lead = (first.getDay() + 6) % 7
        const out = []
        for (let i = 0; i < lead; ++i) out.push(0)
        for (let d = 1; d <= days; ++d) out.push(d)
        return out
    }

    RowLayout {
        width: cal.width
        height: 28
        spacing: 4
        Text {
            textFormat: Text.PlainText
            Layout.fillWidth: true
            text: Fmt.monthTitle(cal.month)
            color: Theme.c.ink
            font.pixelSize: 14
            font.weight: Font.DemiBold
        }
        IconButton { size: 28; iconSize: 14; icon: "chevron-left"; tooltip: "Previous month"; onClicked: cal.shift(-1) }
        IconButton { size: 28; iconSize: 14; icon: "chevron-right"; tooltip: "Next month"; onClicked: cal.shift(1) }
    }
    Item { width: 1; height: 8 }
    Row {
        Repeater {
            model: ["M", "T", "W", "T", "F", "S", "S"]
            delegate: Text {
                required property string modelData
                width: cal.width / 7
                horizontalAlignment: Text.AlignHCenter
                text: modelData
                color: Theme.c.muted
                font.pixelSize: 12
                bottomPadding: 4
            }
        }
    }
    Grid {
        columns: 7
        rowSpacing: 2
        Repeater {
            model: cal.cells
            delegate: Item {
                id: day
                required property int modelData
                readonly property string iso: modelData > 0 ? Qt.formatDate(new Date(cal.month.getFullYear(), cal.month.getMonth(), modelData), "yyyy-MM-dd") : ""
                readonly property bool isToday: iso === AppState.todayIso
                readonly property bool has: !!cal.marked[iso]
                width: cal.width / 7
                height: 34
                Rectangle {
                    visible: day.modelData > 0
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: 28
                    height: 28
                    radius: 14
                    color: day.isToday ? Theme.c.accent : (dayArea.containsMouse ? Qt.alpha(Theme.c.pressed, 0.8) : "transparent")
                    Text {
                        textFormat: Text.PlainText
                        anchors.centerIn: parent
                        text: day.modelData
                        color: day.isToday ? Theme.c.onAccent : (day.has ? Theme.c.ink : Theme.c.muted)
                        font.pixelSize: 13
                        font.weight: day.isToday ? Font.DemiBold : (day.has ? Font.Medium : Font.Normal)
                        font.features: { "tnum": 1 }
                    }
                }
                Rectangle {
                    visible: day.has && !day.isToday
                    anchors.horizontalCenter: parent.horizontalCenter
                    y: 25
                    width: 3
                    height: 3
                    radius: 1.5
                    color: Theme.c.faint
                }
                MouseArea {
                    id: dayArea
                    anchors.fill: parent
                    enabled: day.modelData > 0
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: cal.dayPicked(day.iso)
                }
            }
        }
    }
}
