import QtQuick
import QtQuick.Window
import Noted

// The text caret for TextEdit / TextInput (their cursorDelegate). Qt's own
// keeps blinking through a click, so it can be blank just after you place it,
// and it lands on fractional pixels, so it draws 1 or 2 pixels wide. This one
// shows solid whenever it moves and is snapped to whole device pixels.
//
//   cursorDelegate: Caret { target: edit }
Item {
    id: caret
    property Item target
    property bool lit: true

    width: 0

    Rectangle {
        readonly property real dpr: Screen.devicePixelRatio > 0 ? Screen.devicePixelRatio : 1
        // Whole device pixels: the caret's left edge and its width.
        x: Math.round(caret.x * dpr) / dpr - caret.x
        width: Math.max(1, Math.round(1.6 * dpr)) / dpr
        height: caret.height
        color: Theme.c.ink
        visible: caret.lit && !!caret.target && caret.target.activeFocus
                 && caret.target.selectionStart === caret.target.selectionEnd
    }

    Timer {
        id: blink
        interval: 530
        repeat: true
        running: !!caret.target && caret.target.activeFocus
        onTriggered: caret.lit = !caret.lit
    }
    function wake() { lit = true; blink.restart() }
    Connections {
        target: caret.target
        ignoreUnknownSignals: true
        function onCursorPositionChanged() { caret.wake() }
        function onActiveFocusChanged() { caret.wake() }
        function onTextChanged() { caret.wake() }
    }
}
