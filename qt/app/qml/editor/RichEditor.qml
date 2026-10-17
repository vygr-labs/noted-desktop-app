import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Noted

// The rich-text editing surface: a TextEdit whose document is driven by an
// EditorController (see app/src/EditorController.h).
Item {
    id: root

    property alias controller: ctl
    property alias textEdit: edit
    property bool readOnly: false
    property real minHeight: 200
    property string placeholder: "Start writing, or type / for headings, lists and to-dos"
    signal caretMoved(rect r)

    implicitHeight: Math.max(edit.implicitHeight, minHeight)
    height: implicitHeight

    function load(id, json) { ctl.load(id, json) }
    function focusEnd() { edit.forceActiveFocus(); edit.cursorPosition = edit.length }
    function focusStart() { edit.forceActiveFocus(); edit.cursorPosition = 0 }

    EditorController {
        id: ctl
        textDocument: edit.textDocument
        store: Store
        files: Files
        palette: Theme.editorPalette
        cursorPosition: edit.cursorPosition
        selectionStart: edit.selectionStart
        selectionEnd: edit.selectionEnd
        onRequestCursor: (pos, anchor) => {
            if (pos === anchor) edit.cursorPosition = pos
            else edit.select(anchor, pos)
        }
        onLivePreview: (id, preview) => Notes.patch(id, AppState.currentNote.title || "Untitled", preview)
    }

    TextEdit {
        id: edit
        width: parent.width
        textFormat: TextEdit.RichText
        wrapMode: TextEdit.Wrap
        selectByMouse: true
        persistentSelection: true
        readOnly: root.readOnly
        color: Theme.c.text
        selectionColor: Theme.c.selection
        selectedTextColor: Theme.c.text
        font.family: Theme.fontFamily
        font.pixelSize: Math.round(16 * Theme.textScale)
        textMargin: 0
        focus: true
        onCursorRectangleChanged: root.caretMoved(cursorRectangle)

        // Placeholder
        Text {
            visible: ctl.empty && !edit.activeFocus || (ctl.empty && edit.length <= 1)
            text: root.placeholder
            color: Theme.c.placeholder
            width: edit.width
            wrapMode: Text.Wrap
            font: edit.font
        }

        // Task checkboxes and blockquote bars (see EditorController::decorations).
        Repeater {
            model: ctl.decorations
            delegate: Item {
                id: deco
                required property var modelData
                readonly property var g: ctl.blockGeometry(modelData.block, ctl.layoutTick)
                // Read width/contentHeight so these follow rewrapping (window or
                // column resized); positionToRectangle alone isn't re-evaluated.
                readonly property rect first: { edit.width; edit.contentHeight; return edit.positionToRectangle(g.start !== undefined ? g.start : 0) }
                readonly property var g2: modelData.k === "quote" ? ctl.blockGeometry(modelData.endBlock, ctl.layoutTick) : g
                readonly property rect last: { edit.width; edit.contentHeight; return edit.positionToRectangle(g2.end !== undefined ? g2.end : 0) }

                Rectangle {
                    visible: deco.modelData.k === "quote"
                    x: deco.first.x - 16
                    y: deco.first.y - 2
                    width: 3
                    height: deco.last.y + deco.last.height - deco.first.y + 4
                    radius: 2
                    color: Theme.c.accentLine
                }

                Rectangle {
                    visible: deco.modelData.k === "task"
                    readonly property real s: Math.round(15 * Theme.textScale)
                    x: deco.first.x - s - 3
                    y: deco.first.y + (deco.first.height - s) / 2
                    width: s
                    height: s
                    radius: 4
                    color: !!deco.modelData.checked ? Theme.c.accent : (boxArea.containsMouse ? Theme.c.accentSubtle : Theme.c.window)
                    border.width: !!deco.modelData.checked ? 0 : 1.5
                    border.color: boxArea.containsMouse ? Theme.c.accent : Theme.c.faint
                    Behavior on color { ColorAnimation { duration: 120 } }
                    Icon {
                        anchors.centerIn: parent
                        name: "check"
                        size: parent.s - 3
                        color: "white"
                        visible: !!deco.modelData.checked
                    }
                    MouseArea {
                        id: boxArea
                        anchors.fill: parent
                        anchors.margins: -4
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        enabled: !root.readOnly
                        onClicked: ctl.toggleTask(deco.modelData.block)
                    }
                }
            }
        }

        // Find highlights, drawn under the text.
        Repeater {
            model: ctl.findMatches
            delegate: Rectangle {
                required property var modelData
                required property int index
                readonly property rect a: { edit.width; edit.contentHeight; return edit.positionToRectangle(modelData.start) }
                readonly property rect b: { edit.width; edit.contentHeight; return edit.positionToRectangle(modelData.start + modelData.length) }
                z: -1
                x: a.x - 1
                y: a.y
                width: b.y === a.y ? Math.max(4, b.x - a.x + 2) : edit.width - a.x
                height: a.height
                radius: 3
                color: index === ctl.findIndex ? Qt.alpha(Theme.c.accent, 0.45) : Qt.alpha(Theme.c.accent, 0.16)
            }
        }

        Keys.onPressed: (e) => {
            const ctrl = e.modifiers & Qt.ControlModifier
            const shift = e.modifiers & Qt.ShiftModifier
            const alt = e.modifiers & Qt.AltModifier
            let handled = true
            if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter) {
                if (ctrl && ctl.listKind === 2) { ctl.clickAt(edit.cursorPosition, -1000, 0); handled = true }
                else handled = !ctrl && ctl.handleEnter(shift)
            } else if (e.key === Qt.Key_Backspace && !ctrl) handled = ctl.handleBackspace()
            else if (e.key === Qt.Key_Tab || e.key === Qt.Key_Backtab) handled = ctl.handleTab(e.key === Qt.Key_Backtab || shift)
            else if (ctrl && !alt && e.key === Qt.Key_B && !shift) ctl.toggleBold()
            else if (ctrl && !alt && e.key === Qt.Key_I) ctl.toggleItalic()
            else if (ctrl && !alt && e.key === Qt.Key_U) ctl.toggleUnderline()
            else if (ctrl && shift && e.key === Qt.Key_S) ctl.toggleStrike()
            else if (ctrl && shift && e.key === Qt.Key_H) ctl.toggleHighlight()
            else if (ctrl && !shift && e.key === Qt.Key_E) ctl.toggleCode()
            else if (ctrl && !shift && e.key === Qt.Key_K) linkDialog.openFor()
            else if (ctrl && alt && e.key >= Qt.Key_1 && e.key <= Qt.Key_3) ctl.setHeading(e.key - Qt.Key_0)
            else if (ctrl && alt && e.key === Qt.Key_0) ctl.setHeading(0)
            else if (ctrl && shift && (e.key === Qt.Key_8 || e.key === Qt.Key_Asterisk)) ctl.toggleList(0)
            else if (ctrl && shift && (e.key === Qt.Key_7 || e.key === Qt.Key_Ampersand)) ctl.toggleList(1)
            else if (ctrl && shift && (e.key === Qt.Key_9 || e.key === Qt.Key_ParenLeft)) ctl.toggleList(2)
            else if (ctrl && shift && e.key === Qt.Key_B) ctl.toggleQuote()
            else if (ctrl && alt && e.key === Qt.Key_C) ctl.toggleCodeBlock()
            else if (ctrl && e.key === Qt.Key_Backslash) ctl.clearFormatting()
            else if (ctrl && shift && e.key === Qt.Key_D) ctl.insertDate()
            else if (e.matches(StandardKey.Paste)) ctl.paste(false)
            else if (ctrl && shift && e.key === Qt.Key_V) ctl.paste(true)
            else if (e.matches(StandardKey.Copy)) ctl.copy("rich")
            else if (e.matches(StandardKey.Cut)) ctl.cut()
            else handled = false
            e.accepted = handled
        }

        TapHandler {
            acceptedButtons: Qt.LeftButton
            onTapped: (point) => {
                const p = point.position
                const pos = edit.positionAt(p.x, p.y)
                if (point.modifiers & Qt.ControlModifier) {
                    const href = ctl.linkAt(pos) || ctl.linkAt(pos - 1)
                    if (href !== "") { App.openExternal(href); return }
                }
                const start = ctl.blockStart(pos)
                const r = edit.positionToRectangle(start)
                ctl.clickAt(pos, p.x, r.x)
            }
        }
        TapHandler {
            acceptedButtons: Qt.RightButton
            onTapped: (point) => root.openContextMenu(point.position.x, point.position.y)
        }
        HoverHandler {
            cursorShape: edit.hoveredLink !== "" ? Qt.PointingHandCursor : Qt.IBeamCursor
        }
        Tip {
            visible: edit.hoveredLink !== ""
            text: edit.hoveredLink
            shortcut: "Ctrl+Click to open"
        }
    }

    PopupMenu { id: menu; minWidth: 210 }

    function openContextMenu(x, y) {
        const pos = edit.positionAt(x, y)
        const hasSel = edit.selectionStart !== edit.selectionEnd
        const href = ctl.linkAt(pos) || ctl.linkAt(pos - 1)
        const items = []
        if (href !== "") {
            items.push({ text: "Open link", icon: "external-link", action: () => App.openExternal(href) })
            items.push({ text: "Edit link…", icon: "link", action: () => linkDialog.openFor() })
            items.push({ text: "Remove link", icon: "x", action: () => ctl.setLink("") })
            items.push({ separator: true })
        }
        items.push({ text: "Cut", icon: "scissors", shortcut: "Ctrl+X", disabled: !hasSel, action: () => ctl.cut() })
        items.push({ text: "Copy", icon: "copy", shortcut: "Ctrl+C", disabled: !hasSel, action: () => ctl.copy("rich") })
        items.push({ text: "Copy as Markdown", icon: "hash", disabled: !hasSel, action: () => ctl.copy("markdown") })
        items.push({ text: "Copy as plain text", icon: "type", disabled: !hasSel, action: () => ctl.copy("plain") })
        items.push({ text: "Paste", icon: "clipboard-paste", shortcut: "Ctrl+V", action: () => ctl.paste(false) })
        items.push({ text: "Paste as plain text", icon: "clipboard", shortcut: "Ctrl+Shift+V", action: () => ctl.paste(true) })
        items.push({ separator: true })
        items.push({ text: "Select all", shortcut: "Ctrl+A", action: () => edit.selectAll() })
        menu.openAt(edit, x, y, items)
    }

    ModalDialog {
        id: linkDialog
        title: "Link"
        dialogWidth: 420
        property int selStart: 0
        property int selEnd: 0
        function openFor() {
            selStart = edit.selectionStart
            selEnd = edit.selectionEnd
            urlField.text = ctl.linkHref
            open()
            urlField.forceActiveFocus()
            urlField.selectAll()
        }
        function apply(href) {
            close()
            edit.forceActiveFocus()
            edit.select(selStart, selEnd)
            let h = href.trim()
            if (h !== "" && !/^[a-z]+:/i.test(h)) h = "https://" + h
            ctl.setLink(h)
        }
        Field {
            id: urlField
            Layout.fillWidth: true
            leadingIcon: "link"
            placeholderText: "https://…"
            onAccepted: linkDialog.apply(text)
        }
        footer: [
            TextButton { text: "Remove"; visible: ctl.linkHref !== ""; onClicked: linkDialog.apply("") },
            TextButton { text: "Cancel"; onClicked: { linkDialog.close(); edit.forceActiveFocus() } },
            TextButton { text: "Apply"; variant: "primary"; onClicked: linkDialog.apply(urlField.text) }
        ]
    }

    function openLinkDialog() { linkDialog.openFor() }
}
