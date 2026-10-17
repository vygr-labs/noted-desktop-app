import QtQuick
import QtQuick.Layouts
import Noted

// Month grid for daily notes: days with an entry are bold, today is filled,
// the open day is outlined. Clicking a day opens (or creates) its note.
ColumnLayout {
    id: cal

    property string selectedIso: ""       // yyyy-MM-dd of the open daily note
    property date month: new Date()       // any day in the shown month
    signal dayPicked(string iso)

    spacing: 4

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

    function shift(delta) {
        const d = new Date(month.getFullYear(), month.getMonth() + delta, 1)
        month = d
    }
    function showDate(iso) {
        if (!iso) return
        const d = new Date(iso + "T12:00:00")
        if (d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth()) month = d
    }
    onSelectedIsoChanged: showDate(selectedIso)

    // Monday-first cells: leading blanks then 1..n.
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
        Layout.fillWidth: true
        Layout.leftMargin: 4
        spacing: 2
        Text {
            text: Qt.formatDate(cal.month, "MMMM yyyy")
            color: Theme.c.text
            font.pixelSize: 13
            font.weight: Font.DemiBold
            Layout.fillWidth: true
        }
        IconButton { icon: "chevron-left"; size: 24; iconSize: 14; dim: true; tooltip: "Previous month"; onClicked: cal.shift(-1) }
        IconButton { icon: "chevron-right"; size: 24; iconSize: 14; dim: true; tooltip: "Next month"; onClicked: cal.shift(1) }
    }

    GridLayout {
        Layout.fillWidth: true
        columns: 7
        rowSpacing: 2
        columnSpacing: 2

        Repeater {
            model: ["M", "T", "W", "T", "F", "S", "S"]
            delegate: Text {
                required property string modelData
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                text: modelData
                color: Theme.c.subtle
                font.pixelSize: 11
                bottomPadding: 2
            }
        }
        Repeater {
            model: cal.cells
            delegate: Rectangle {
                id: day
                required property int modelData
                readonly property string iso: modelData > 0 ? Qt.formatDate(new Date(cal.month.getFullYear(), cal.month.getMonth(), modelData), "yyyy-MM-dd") : ""
                readonly property bool isToday: iso === AppState.todayIso
                readonly property bool isSelected: iso !== "" && iso === cal.selectedIso
                readonly property bool future: iso > AppState.todayIso
                Layout.fillWidth: true
                Layout.preferredHeight: 26
                radius: Theme.radius
                color: isToday ? Theme.c.accent : (dayArea.containsMouse && modelData > 0 ? Theme.c.hover : "transparent")
                border.width: isSelected && !isToday ? 1.5 : 0
                border.color: Theme.c.accent
                Text {
                    anchors.centerIn: parent
                    visible: day.modelData > 0
                    text: day.modelData
                    color: day.isToday ? Theme.c.onAccent : (cal.marked[day.iso] ? Theme.c.text : (day.future ? Theme.c.faint : Theme.c.subtle))
                    font.pixelSize: 12
                    font.weight: cal.marked[day.iso] || day.isToday ? Font.DemiBold : Font.Normal
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
