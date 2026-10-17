import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtQuick.Dialogs
import Noted
import "../Fmt.js" as Fmt

// The rich-text editing surface: a TextEdit whose document is driven by an
// EditorController (see app/src/EditorController.h).
Item {
    id: root

    property alias controller: ctl
    property alias textEdit: edit
    property bool readOnly: false
    property real minHeight: 200
    property color pageColor: Theme.c.bg   // what's behind the editor (covers Qt's to-do bullets)
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
        // An empty title keeps the row's own; only the open note's title is known here.
        onLivePreview: (id, preview) => Notes.patch(id, id === AppState.currentNote.id ? (AppState.currentNote.title || "") : "", preview)
    }

    TextEdit {
        id: edit
        cursorDelegate: Caret { target: edit }
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
        onCursorPositionChanged: if (slash.opened) root.followSlash()

        // Placeholder, on the first line's glyphs: Qt puts a fixed-height
        // line's extra space above its text, so line 0's caret sits lower than y 0.
        Text {
            textFormat: Text.PlainText
            // Only on a truly empty page: spaces or an empty list item hide it,
            // so the caret never sits inside the hint's words.
            visible: edit.length === 0 && ctl.listKind < 0
            text: root.placeholder
            color: Theme.c.placeholder
            x: 1
            y: { edit.contentHeight; edit.width; return Math.round(edit.positionToRectangle(0).y) }
            width: edit.width - 1
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
                readonly property bool isTask: modelData.k === "task"
                readonly property string dueKey: isTask ? Fmt.dueGroup(modelData.due || "", AppState.todayIso) : ""
                // A code block's box sits under the text (negative z draws
                // below the TextEdit itself).
                z: modelData.k === "code" ? -1 : 0

                Rectangle {
                    visible: deco.modelData.k === "code"
                    readonly property rect box: { edit.width; edit.contentHeight; return deco.modelData.k === "code" ? ctl.codeRect(deco.modelData.block, ctl.layoutTick) : Qt.rect(0, 0, 0, 0) }
                    x: box.x
                    y: box.y
                    width: box.width
                    height: box.height
                    radius: 8
                    color: Theme.c.codeBg
                    border.color: Theme.c.lineSoft
                }

                // Divider, in the line colour (Qt's own ruler is zero width).
                Rectangle {
                    visible: deco.modelData.k === "hr"
                    x: 0
                    y: Math.round(deco.first.y + deco.first.height / 2)
                    width: edit.width
                    height: 1
                    color: Theme.c.line
                }

                // A bullet: cover Qt's thin one and draw a fuller dot (a ring,
                // then a square, for nested lists).
                Rectangle {
                    visible: deco.modelData.k === "bullet"
                    x: deco.first.x - Math.round(18 * Theme.textScale)
                    y: deco.first.y
                    width: Math.round(17 * Theme.textScale)
                    height: deco.first.height
                    color: root.pageColor
                    Rectangle {
                        readonly property string shape: deco.modelData.shape || "disc"
                        readonly property real d: Math.round((shape === "square" ? 5 : 6) * Theme.textScale)
                        anchors.right: parent.right
                        anchors.rightMargin: Math.round(8 * Theme.textScale)
                        // On the middle of the first line's x-height, not the line box.
                        y: Math.round(deco.first.height * 0.56 - d / 2)
                        width: d
                        height: d
                        radius: shape === "square" ? 1 : d / 2
                        color: shape === "ring" ? "transparent" : Theme.c.text
                        border.width: shape === "ring" ? 1.3 : 0
                        border.color: Theme.c.text
                    }
                }

                // Qt draws a bullet in front of a to-do's text; cover it.
                Rectangle {
                    visible: deco.isTask
                    x: deco.first.x - Math.round(12 * Theme.textScale)
                    y: deco.first.y
                    width: Math.round(11 * Theme.textScale)
                    height: deco.first.height
                    color: root.pageColor
                }

                // The whole line, to show "Add date" on hover. Takes no clicks.
                MouseArea {
                    id: lineHover
                    visible: deco.isTask && !root.readOnly
                    x: 0
                    y: deco.first.y
                    width: edit.width
                    height: deco.last.y + deco.last.height - deco.first.y
                    hoverEnabled: true
                    acceptedButtons: Qt.NoButton
                    cursorShape: Qt.IBeamCursor
                }
                Text {
                    textFormat: Text.PlainText
                    id: dueLabel
                    readonly property bool hasDue: !!deco.modelData.due
                    visible: deco.isTask && (hasDue || ((lineHover.containsMouse || dueArea.containsMouse) && !deco.modelData.checked && !root.readOnly))
                    x: Math.min(deco.last.x + 10, edit.width - implicitWidth)
                    y: deco.last.y + Math.round((deco.last.height - height) / 2)
                    text: hasDue ? Fmt.dueLabel(deco.modelData.due, AppState.todayIso) : "Add date"
                    color: !hasDue ? Theme.c.faint : (deco.dueKey === "over" && !deco.modelData.checked ? Theme.c.red : Theme.c.muted)
                    font.pixelSize: Math.round(13 * Theme.textScale)
                    font.family: Theme.fontFamily
                    font.features: { "tnum": 1 }
                    MouseArea {
                        id: dueArea
                        anchors.fill: parent
                        anchors.margins: -3
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        enabled: !root.readOnly
                        onClicked: { duePicker.block = deco.modelData.block; duePicker.openUnder(dueLabel, -8, deco.modelData.due || "") }
                    }
                }

                Rectangle {
                    visible: deco.modelData.k === "quote"
                    x: deco.first.x - 16
                    y: deco.first.y
                    width: 3
                    height: deco.last.y + deco.last.height - deco.first.y
                    radius: 1.5
                    color: Theme.c.quote
                }

                Rectangle {
                    visible: deco.modelData.k === "task"
                    readonly property real s: Math.round(18 * Theme.textScale)
                    // The text starts 30px in: an 18px box, then a 12px gap.
                    x: deco.first.x - Math.round(30 * Theme.textScale)
                    y: deco.first.y + Math.round((deco.first.height - s) / 2)
                    width: s
                    height: s
                    radius: 5
                    color: !!deco.modelData.checked ? Theme.c.accent : (boxArea.containsMouse ? Qt.alpha(Theme.c.accent, 0.08) : "transparent")
                    border.width: !!deco.modelData.checked ? 0 : 1.5
                    border.color: boxArea.containsMouse ? Theme.c.accent : Theme.c.faint
                    Icon {
                        anchors.centerIn: parent
                        name: "check"
                        size: parent.s - 5
                        color: Theme.c.onAccent
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
            if (slash.opened && slash.key(e)) { e.accepted = true; return }
            const ctrl = e.modifiers & Qt.ControlModifier
            const shift = e.modifiers & Qt.ShiftModifier
            const alt = e.modifiers & Qt.AltModifier
            if (e.text === "/" && !ctrl && !alt && !root.readOnly) Qt.callLater(root.maybeOpenSlash)
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
    // ── the "/" menu ─────────────────────────────────────────────────
    property int slashPos: -1
    SlashMenu {
        id: slash
        onPicked: (kind) => root.insertBlock(kind)
        onClosed: root.slashPos = -1
    }
    // A "/" at the start of a line or after a space opens the menu.
    function maybeOpenSlash() {
        const pos = edit.cursorPosition - 1
        if (pos < 0 || edit.getText(pos, pos + 1) !== "/" || ctl.inCodeBlock) return
        const before = pos > ctl.blockStart(pos) ? edit.getText(pos - 1, pos) : ""
        if (before !== "" && !/\s/.test(before)) return
        slashPos = pos
        slash.query = ""
        const win = edit.Window.contentItem
        slash.parent = win
        const r = edit.positionToRectangle(pos)
        const below = edit.mapToItem(win, r.x - 8, r.y + r.height + 6)
        slash.x = Math.max(8, Math.min(below.x, win.width - slash.width - 8))
        slash.open()
        slash.y = win.height - below.y < 440 ? edit.mapToItem(win, 0, r.y).y - slash.implicitHeight - 6 : below.y
    }
    function followSlash() {
        const end = edit.cursorPosition
        if (slashPos < 0 || end <= slashPos || edit.getText(slashPos, slashPos + 1) !== "/") { slash.close(); return }
        const q = edit.getText(slashPos + 1, end)
        if (/\s/.test(q) || q.length > 24) { slash.close(); return }
        slash.query = q
    }
    // Removes "/query", then turns the line into the block (or inserts one).
    function insertBlock(kind) {
        const from = slashPos
        slash.close()
        if (from >= 0) edit.remove(from, edit.cursorPosition)
        const plain = () => {
            if (ctl.headingLevel > 0) ctl.setHeading(0)
            if (ctl.listKind >= 0) ctl.toggleList(ctl.listKind)
            if (ctl.inQuote) ctl.toggleQuote()
        }
        switch (kind) {
        case "p": plain(); break
        case "h2": plain(); ctl.setHeading(2); break
        case "h3": plain(); ctl.setHeading(3); break
        case "task": if (ctl.listKind !== 2) { plain(); ctl.toggleList(2) } break
        case "li": if (ctl.listKind !== 0) { plain(); ctl.toggleList(0) } break
        case "ol": if (ctl.listKind !== 1) { plain(); ctl.toggleList(1) } break
        case "quote": if (!ctl.inQuote) { plain(); ctl.toggleQuote() } break
        case "code": if (!ctl.inCodeBlock) ctl.toggleCodeBlock(); break
        case "table": ctl.insertTable(3, 3); break
        case "hr": ctl.insertHorizontalRule(); break
        case "image": imageDialog.open(); return
        }
        edit.forceActiveFocus()
    }

    FileDialog {
        id: imageDialog
        title: "Add an image"
        fileMode: FileDialog.OpenFiles
        nameFilters: ["Images (*.png *.jpg *.jpeg *.gif *.webp *.bmp)", "All files (*)"]
        onAccepted: {
            if (ctl.insertImageFiles(selectedFiles.map(String)) === 0) AppState.toast("That file isn’t an image noted can show")
            edit.forceActiveFocus()
        }
        onRejected: edit.forceActiveFocus()
    }
    // Drop image files onto the page to add them where they land.
    DropArea {
        anchors.fill: edit
        enabled: !root.readOnly
        onEntered: (drag) => { drag.accepted = drag.hasUrls && drag.urls.some(u => ctl.isImageFile(String(u))) }
        onDropped: (drop) => {
            const n = ctl.insertImageFiles(drop.urls.map(String), edit.positionAt(drop.x, drop.y))
            if (n > 0) { drop.acceptProposedAction(); edit.forceActiveFocus() }
        }
    }

    DuePicker {
        id: duePicker
        property int block: -1
        onPicked: (iso) => ctl.setTaskDue(block, iso)
    }

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
