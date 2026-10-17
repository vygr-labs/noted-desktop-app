pragma Singleton

import QtQuick
import Noted

// Transient UI state + the actions every panel shares. Persistent choices
// live in the settings table (same keys as the Electron build where one
// existed) and are loaded once at startup.
QtObject {
    id: state

    // ── navigation ───────────────────────────────────────────────────
    // all | today | synced | todos | trash | list | tag
    property string view: "all"
    property string viewId: ""
    property string selectedNoteId: ""
    property var currentNote: ({})
    property var currentTags: []

    // Back/forward through opened notes (Alt+Left / Alt+Right).
    property var history: []
    property int historyIndex: -1
    property bool _navigating: false

    // ── layout ───────────────────────────────────────────────────────
    property bool sidebarCollapsed: false
    property bool noteListCollapsed: false
    property bool focusMode: false
    property real noteListWidth: 328
    property string toolbarPosition: "top"   // top | right | bottom | left | hidden
    property string layout: "vertical"       // vertical | horizontal (tabs)
    property bool fullWidth: false           // editor text fills the pane instead of a centred column

    // ── preferences ──────────────────────────────────────────────────
    property string noteSort: "updated_at"
    property bool showPreview: true
    property string defaultNoteType: "rich"
    property bool popoutSkipTaskbar: false
    property bool spellcheckHint: true

    // ── overlays ─────────────────────────────────────────────────────
    property bool paletteOpen: false
    property bool settingsOpen: false
    property bool findOpen: false
    property bool replaceOpen: false

    // ── data mirrors (refreshed on store signals) ────────────────────
    property var counts: ({})
    property var lists: []
    property var hiddenLists: []
    property var tags: []
    property var todoLists: []
    property string selectedTodoListId: ""
    property bool hasLockPin: Store.hasLockPin

    // Local date, kept current across midnight.
    property string todayIso: Store.todayIso()
    property Timer _clock: Timer {
        interval: 60000
        running: true
        repeat: true
        onTriggered: {
            const t = Store.todayIso()
            if (t !== state.todayIso) { state.todayIso = t; Notes.refresh() }
        }
    }

    signal focusTitleRequested(bool selectAll)
    signal focusEditorRequested()
    signal toast(string message)
    signal pinPromptRequested(string mode, string noteId)  // set | unlock | remove
    signal editorTaskToggleRequested(int taskIndex)          // the open note's n-th checklist item

    readonly property string viewTitle: {
        switch (view) {
        case "today": return "Today"
        case "synced": return "Synced"
        case "todos": return "To-dos"
        case "trash": return "Trash"
        case "list": {
            for (let i = 0; i < lists.length; ++i) if (lists[i].id === viewId) return lists[i].name
            for (let j = 0; j < hiddenLists.length; ++j) if (hiddenLists[j].id === viewId) return hiddenLists[j].name
            return "List"
        }
        case "tag": {
            for (let k = 0; k < tags.length; ++k) if (tags[k].id === viewId) return "#" + tags[k].name
            return "Tag"
        }
        default: return "All Notes"
        }
    }

    function load() {
        Theme.mode = Store.setting("appTheme", "system")
        noteSort = Store.setting("noteSort", "updated_at")
        showPreview = Store.setting("showNotePreview", "1") !== "0"
        layout = Store.setting("noteListLayout", "vertical")
        defaultNoteType = Store.setting("defaultNoteType", "rich")
        popoutSkipTaskbar = Store.setting("popoutSkipTaskbar", "false") === "true"
        toolbarPosition = Store.setting("qt.toolbarPosition", "top")
        fullWidth = Store.setting("qt.wideText", "false") === "true"
        noteListWidth = parseFloat(Store.setting("qt.noteListWidth", "328")) || 328
        sidebarCollapsed = Store.setting("qt.sidebarCollapsed", "false") === "true"
        Theme.textScale = parseFloat(Store.setting("qt.textScale", "1")) || 1
        Notes.sort = noteSort
        refreshAll()
        const last = Store.setting("qt.lastNote", "")
        if (last !== "") {
            const n = noteData(last)
            if (n.id && !n.is_trashed) selectNote(last)
        }
    }

    function save(key, value) { Store.setSetting(key, String(value)) }

    function setTheme(m) { Theme.mode = m; save("appTheme", m) }
    function cycleTheme() {
        const order = ["light", "warm", "slate", "dark"]
        const i = order.indexOf(Theme.resolved)
        setTheme(order[(i + 1) % order.length])
    }
    function setSort(s) { noteSort = s; Notes.sort = s; save("noteSort", s) }
    function setShowPreview(v) { showPreview = v; save("showNotePreview", v ? "1" : "0") }
    function setLayout(v) { layout = v; save("noteListLayout", v) }
    function setFullWidth(v) { fullWidth = v; save("qt.wideText", v) }
    function setToolbarPosition(v) { toolbarPosition = v; save("qt.toolbarPosition", v) }
    function setNoteListWidth(w) { noteListWidth = w; save("qt.noteListWidth", Math.round(w)) }
    function setSidebarCollapsed(v) { sidebarCollapsed = v; save("qt.sidebarCollapsed", v) }
    function setTextScale(s) {
        Theme.textScale = Math.max(0.8, Math.min(1.6, Math.round(s * 10) / 10))
        save("qt.textScale", Theme.textScale)
    }

    function refreshAll() {
        refreshCounts()
        refreshLists()
        refreshTags()
        refreshTodoLists()
        refreshCurrent()
    }
    function refreshCounts() { counts = Store.counts() }
    function refreshLists() { lists = Store.lists(); hiddenLists = Store.hiddenLists() }
    function refreshTags() { tags = Store.tags() }
    function refreshTodoLists() { todoLists = Store.todoLists() }
    function refreshCurrent() {
        if (selectedNoteId === "") { currentNote = ({}); currentTags = []; return }
        const n = noteData(selectedNoteId)
        if (!n.id) { selectedNoteId = ""; currentNote = ({}); currentTags = []; return }
        currentNote = n
        currentTags = n.is_file ? [] : Store.tagsForNote(selectedNoteId)
    }

    // A note from the database, or a file opened from disk ("file:" ids).
    function noteData(id) { return Files.isFile(id) ? Files.note(id) : Store.note(id) }

    // ── files on disk (edited in place, see OpenFiles.h) ─────────────
    // Opens each path and shows the last one. Returns how many opened.
    function openFiles(paths) {
        let last = "", opened = 0
        for (const p of paths) {
            const id = Files.open(p)
            if (id) { last = id; opened++ }
        }
        if (last) selectNote(last)
        if (opened < paths.length) toast(paths.length > 1 ? (paths.length - opened) + " files couldn't be opened" : "Couldn't open that file")
        return opened
    }
    function closeFile(id) {
        // Deselect first so the editor writes any pending change to the file.
        if (selectedNoteId === id) selectNote("")
        Files.close(id)
    }
    // Copies an open file into the database as an ordinary note.
    function copyFileToNotes(id) {
        const noteId = App.importFile(Files.pathOf(id))
        if (noteId) { setView("all"); selectNote(noteId); toast("Copied into your notes") }
    }

    // ── navigation actions ───────────────────────────────────────────
    function setView(v, id) {
        view = v
        viewId = id || ""
        if (v === "todos") return
        Notes.filter = ""
        Notes.view = v === "today" ? "daily" : v
        Notes.filterId = viewId
        if (v === "today") {
            const today = Store.dailyNote(Store.todayIso())
            refreshCounts()
            selectNote(today.id)
        }
    }

    function selectNote(id) {
        if (id === selectedNoteId) return
        selectedNoteId = id || ""
        refreshCurrent()
        if (id) save("qt.lastNote", id)
        if (!_navigating && id) {
            const h = history.slice(0, historyIndex + 1).filter(x => x !== id)
            h.push(id)
            history = h.slice(-50)
            historyIndex = history.length - 1
        }
        findOpen = false
    }

    function goBack() { navigate(-1) }
    function goForward() { navigate(1) }
    function navigate(delta) {
        let i = historyIndex + delta
        while (i >= 0 && i < history.length) {
            const n = noteData(history[i])
            if (n.id && !n.is_trashed) {
                historyIndex = i
                _navigating = true
                selectNote(history[i])
                _navigating = false
                return
            }
            i += delta
        }
    }

    // Opens a note from anywhere (search, palette), switching to a view that
    // contains it.
    function openNote(id) {
        const n = Store.note(id)
        if (!n.id) return
        if (n.is_trashed) setView("trash")
        else if (view === "todos" || view === "trash" || view === "today"
                 || (view === "list" && n.list_id !== viewId) || view === "tag" || view === "synced") {
            if (n.list_id) setView("list", n.list_id)
            else setView("all")
        }
        selectNote(id)
    }

    function newNote(opts) {
        const data = {
            title: "Untitled",
            note_type: (opts && opts.type) || defaultNoteType,
            list_id: view === "list" ? viewId : ""
        }
        if (view === "trash" || view === "todos" || view === "today" || view === "synced") setView(data.list_id ? "list" : "all", data.list_id)
        const n = Store.createNote(data)
        if (view === "tag" && viewId !== "") {
            for (let i = 0; i < tags.length; ++i) if (tags[i].id === viewId) Store.addTagToNote(n.id, tags[i].name)
        }
        selectNote(n.id)
        focusTitleRequested(true)
        return n.id
    }

    function trashNote(id) {
        const idx = Notes.indexOf(id)
        Store.trashNote(id)
        if (id === selectedNoteId) {
            const next = Notes.idAt(Math.min(idx, Notes.count - 1))
            selectNote(next !== id ? next : "")
        }
        toast("Moved to trash")
    }

    function restoreNote(id) { Store.restoreNote(id); if (id === selectedNoteId) refreshCurrent(); toast("Restored") }

    function deleteForever(id) {
        const idx = Notes.indexOf(id)
        Store.deleteNotePermanently(id)
        if (id === selectedNoteId) selectNote(Notes.idAt(Math.min(idx, Notes.count - 1)))
    }

    function duplicate(id) { const n = Store.duplicateNote(id); if (n.id) selectNote(n.id) }

    function toggleLock(id) {
        if (!Store.hasLockPin) { pinPromptRequested("set", id); return }
        const locked = Store.toggleNoteLock(id)
        if (!locked) Store.markUnlocked(id)
        refreshCurrent()
        toast(locked ? "Note locked" : "Note unlocked")
    }

    // Ticks a checklist item from outside the editor (open to-dos panel). The
    // open note goes through the editor so its undo stack and caret survive.
    function checkTask(noteId, index) {
        if (noteId === selectedNoteId && currentNote.note_type !== "plain") editorTaskToggleRequested(index)
        else Store.setTaskChecked(noteId, index, true)
    }

    function convertToRich(id) {
        const n = Store.note(id)
        if (!n.id || n.note_type !== "plain") return
        Store.updateNote(id, { note_type: "rich", content: App.plainToRich(n.content || "") })
        refreshCurrent()
    }

    property Connections _store: Connections {
        target: Store
        function onNotesChanged() { state.refreshCounts(); state.refreshLists(); state.refreshTags() }
        function onNoteChanged(id) { if (id === state.selectedNoteId) { state.currentNote = Store.note(id); state.currentTags = Store.tagsForNote(id) } }
        function onListsChanged() { state.refreshLists() }
        function onTagsChanged() { state.refreshTags() }
        function onTodosChanged() { state.refreshCounts(); state.refreshTodoLists() }
    }
    property Connections _files: Connections {
        target: Files
        function onExternallyChanged(id) { if (id === state.selectedNoteId) state.refreshCurrent() }
        function onWriteFailed(id, error) { state.toast("Couldn't save " + Files.pathOf(id) + ": " + error) }
    }
}
