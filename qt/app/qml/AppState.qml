pragma Singleton

import QtQuick
import Noted

// Transient UI state + the actions every panel shares. Persistent choices
// live in the settings table (same keys as the Electron build where one
// existed) and are loaded once at startup.
QtObject {
    id: state

    // ── navigation ───────────────────────────────────────────────────
    // One page fills the main area:
    //   desk      home: today's note, recent notes, lists, calendar, open to-dos
    //   note      selectedNoteId (a note, or a file opened from disk)
    //   list      viewId = list id
    //   todos     every open to-do
    //   search    viewId = the query
    //   settings  viewId = section (appearance, editor, sharing, …)
    //   trash
    property string view: "desk"
    property string viewId: ""
    property string selectedNoteId: ""
    property var currentNote: ({})
    property var currentTags: []

    // Back/forward through pages (Alt+Left / Alt+Right): [{view, viewId, note}].
    property var history: []
    property int historyIndex: -1
    property bool _navigating: false

    // Tabs: each is a place {view, viewId, note} with its own back/forward
    // history. The page on screen is the active tab's, and going somewhere
    // changes that tab. The strip shows once there are two.
    property var tabs: [{ view: "desk", viewId: "", note: "", history: [], historyIndex: -1 }]
    property int activeTab: 0
    // Bumps when note titles or lists may have changed, for tab labels.
    property int tabsTick: 0

    // ── layout ───────────────────────────────────────────────────────
    property bool sidebarCollapsed: false
    property bool focusMode: false
    property bool fullWidth: false           // note text fills the page instead of a centred column

    // ── preferences ──────────────────────────────────────────────────
    property string noteSort: "updated_at"
    property bool showPreview: true
    property string defaultNoteType: "rich"
    property bool popoutSkipTaskbar: false
    property bool spellcheckHint: true
    property string listLayout: "sheets"     // sheets | rows (list pages)
    property var expandedLists: ({})         // list id -> true while open in the sidebar tree
    property var foldedTodoGroups: ({})      // "tab:group" -> true while folded on the To-dos page

    // ── overlays ─────────────────────────────────────────────────────
    property bool paletteOpen: false
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
    // Every checklist item in the notes (done ones too), see Store.allTasks.
    property var tasks: []
    readonly property int openTaskCount: tasks.filter(t => !t.checked).length
    // Bumps when a note is unlocked or locked again, so bindings that ask
    // isLocked() re-evaluate.
    property int lockTick: 0

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
    signal newListRequested()
    signal pinPromptRequested(string mode, string noteId)  // set | unlock | remove
    signal editorTaskToggleRequested(string noteId, int taskIndex)  // an open note's n-th checklist item
    signal popOutRequested(string noteId)
    signal syncSetupRequested()
    signal shareListRequested(var list)
    signal joinListRequested()

    // A note's right-click menu, the same wherever the note is listed.
    function noteMenuItems(note) {
        const locked = isLocked(note)
        return [
            { text: "Open", action: () => openNote(note.id) },
            { text: "Open in new tab", action: () => openNoteInNewTab(note.id) },
            { text: "Open in new window", action: () => popOutRequested(note.id) },
            { text: note.is_pinned ? "Unpin" : "Pin", action: () => Store.setPinned(note.id, !note.is_pinned) },
            { text: "Move to", children: lists.map(l => ({
                text: l.name, color: l.color || "gray", checked: note.list_id === l.id,
                action: () => { Store.moveToList(note.id, l.id); refreshCurrent() }
            })) },
            { text: "Copy as Markdown", disabled: locked, action: () => { if (App.copyAsMarkdown(note.id)) toast("Copied as Markdown") } },
            { text: "Duplicate", disabled: locked, action: () => duplicate(note.id) },
            { separator: true },
            { text: "Move to trash", danger: true, action: () => trashNote(note.id) }
        ]
    }

    function listById(id) {
        for (const l of lists) if (l.id === id) return l
        for (const h of hiddenLists) if (h.id === id) return h
        return null
    }

    function load() {
        // Slate (the Electron build's light grey) is gone: it becomes Light.
        let theme = Store.setting("appTheme", "system")
        if (theme === "slate") { theme = "light"; save("appTheme", theme) }
        Theme.mode = theme
        Theme.accentChoice = Store.setting("qt.accent", "#2F5AC8")
        noteSort = Store.setting("noteSort", "updated_at")
        showPreview = Store.setting("showNotePreview", "1") !== "0"
        defaultNoteType = Store.setting("defaultNoteType", "rich")
        popoutSkipTaskbar = Store.setting("popoutSkipTaskbar", "false") === "true"
        fullWidth = Store.setting("qt.wideText", "false") === "true"
        sidebarCollapsed = Store.setting("qt.sidebarCollapsed", "false") === "true"
        listLayout = Store.setting("qt.listLayout", "sheets")
        try { expandedLists = JSON.parse(Store.setting("qt.expandedLists", "{}")) } catch (e) { expandedLists = ({}) }
        try { foldedTodoGroups = JSON.parse(Store.setting("qt.foldedTodoGroups", "{}")) } catch (e) { foldedTodoGroups = ({}) }
        Theme.textScale = parseFloat(Store.setting("qt.textScale", "1")) || 1
        Notes.sort = noteSort
        refreshAll()
        restoreTabs()
    }

    function save(key, value) { Store.setSetting(key, String(value)) }

    function setTheme(m) { Theme.mode = m; save("appTheme", m) }
    function cycleTheme() { setTheme(Theme.dark ? "light" : Theme.warm ? "dark" : "warm") }
    function setAccent(hex) { Theme.accentChoice = hex; save("qt.accent", hex) }
    function setSort(s) { noteSort = s; Notes.sort = s; save("noteSort", s) }
    function setShowPreview(v) { showPreview = v; save("showNotePreview", v ? "1" : "0") }
    function setListLayout(v) { listLayout = v; save("qt.listLayout", v) }
    function setFullWidth(v) { fullWidth = v; save("qt.wideText", v) }
    function setSidebarCollapsed(v) { sidebarCollapsed = v; save("qt.sidebarCollapsed", v) }
    function setTextScale(s) {
        Theme.textScale = Math.max(0.8, Math.min(1.6, Math.round(s * 1000) / 1000))
        save("qt.textScale", Theme.textScale)
    }
    function setListExpanded(id, open) {
        const e = Object.assign({}, expandedLists)
        if (open) e[id] = true
        else delete e[id]
        expandedLists = e
        save("qt.expandedLists", JSON.stringify(e))
    }

    function setTodoGroupFolded(key, folded) {
        const f = Object.assign({}, foldedTodoGroups)
        if (folded) f[key] = true
        else delete f[key]
        foldedTodoGroups = f
        save("qt.foldedTodoGroups", JSON.stringify(f))
    }

    function refreshAll() {
        refreshCounts()
        refreshLists()
        refreshTags()
        refreshTodoLists()
        refreshTasks()
        refreshCurrent()
    }
    // Note to-dos, then the standalone ones from the older To-dos lists
    // (kind "todo"), shaped alike so every page can show both.
    function refreshTasks() {
        const owners = {}
        for (const l of Store.todoLists()) owners[l.id] = l
        const standalone = Store.todos("").map(t => ({
            kind: "todo", todoId: t.id, noteId: "", index: -1, text: t.text, checked: !!t.is_completed,
            due: (t.due_date || "").slice(0, 10), title: owners[t.todo_list_id] ? owners[t.todo_list_id].name : "To-dos",
            todoListId: owners[t.todo_list_id] ? t.todo_list_id : "", description: t.description || "",
            listId: "", isDaily: false, dailyDate: "", updatedAt: t.updated_at
        }))
        tasks = Store.allTasks(true).concat(standalone)
    }
    function taskKey(t) { return t.kind === "todo" ? "todo:" + t.todoId : t.noteId + ":" + t.index }
    function setTaskDone(t, done) {
        if (t.kind === "todo") Store.updateTodo(t.todoId, { is_completed: done })
        else checkTask(t.noteId, t.index, done)
    }
    function openTask(t) { if (t.kind === "todo") go("todos"); else openNote(t.noteId) }
    property Timer _tasksLater: Timer { interval: 300; onTriggered: state.refreshTasks() }
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

    // A locked note stays closed until its PIN is entered this session.
    function isLocked(n) { lockTick; return !!n && !!n.is_locked && !Store.isUnlocked(n.id || n.note_id || "") }

    // ── files on disk (edited in place, see OpenFiles.h) ─────────────
    // Opens each path and shows the last one. Returns how many opened.
    function openFiles(paths) {
        let last = "", opened = 0
        for (const p of paths) {
            const id = Files.open(p)
            if (id) { last = id; opened++ }
        }
        if (last) openNote(last)
        if (opened < paths.length) toast(paths.length > 1 ? (paths.length - opened) + " files couldn't be opened" : "Couldn't open that file")
        return opened
    }
    function closeFile(id) {
        // Leave the page first so the editor writes any pending change to the file.
        if (selectedNoteId === id) go("desk")
        Files.close(id)
    }
    // Copies an open file into the database as an ordinary note.
    function copyFileToNotes(id) {
        const noteId = App.importFile(Files.pathOf(id))
        if (noteId) { openNote(noteId); toast("Copied into your notes") }
    }

    // ── navigation actions ───────────────────────────────────────────
    // Shows a page. A note page needs `noteId`.
    function go(v, id, noteId) {
        if (v === "today" || v === "all" || v === "") v = "desk"
        id = id || ""
        noteId = v === "note" ? (noteId || id) : ""
        if (v === "note") id = ""
        if (v === "list") {
            Notes.filter = ""
            Notes.view = "list"
            Notes.filterId = id
        } else if (v === "trash") {
            Notes.filter = ""
            Notes.view = "trash"
            Notes.filterId = ""
        }
        view = v
        viewId = id
        if (selectedNoteId !== noteId) {
            // The note first, then its id: anything reacting to the id sees it.
            const n = noteId ? noteData(noteId) : ({})
            currentNote = n.id ? n : ({})
            currentTags = n.id && !n.is_file ? Store.tagsForNote(noteId) : []
            selectedNoteId = n.id ? noteId : ""
        }
        findOpen = false
        if (!_navigating) {
            const entry = { view: v, viewId: id, note: noteId }
            const top = history[historyIndex]
            if (!top || top.view !== v || top.viewId !== id || top.note !== noteId) {
                const h = history.slice(0, historyIndex + 1)
                h.push(entry)
                history = h.slice(-60)
                historyIndex = history.length - 1
            }
        }
        _storeTab()
    }

    // ── tabs ─────────────────────────────────────────────────────────
    function _storeTab() {
        const t = tabs.slice()
        t[activeTab] = { view: view, viewId: viewId, note: selectedNoteId, history: history, historyIndex: historyIndex }
        tabs = t
        _saveTabs.restart()
    }
    // Opens a place in a new tab after the current one and shows it.
    function openInNewTab(v, id, noteId) {
        if (v === "note" && !noteData(noteId || id).id) return
        const t = tabs.slice()
        t.splice(activeTab + 1, 0, { view: "desk", viewId: "", note: "", history: [], historyIndex: -1 })
        tabs = t
        activeTab = activeTab + 1
        history = []
        historyIndex = -1
        if (v === "note") openNote(noteId || id)
        else go(v || "desk", id)
    }
    function openNoteInNewTab(id) { openInNewTab("note", "", id) }
    // A click on a note or list: middle- or Ctrl-click opens it in a new tab.
    function wantsNewTab(mouse) { return mouse.button === Qt.MiddleButton || !!(mouse.modifiers & Qt.ControlModifier) }
    function openNoteFrom(mouse, id) { if (wantsNewTab(mouse)) openNoteInNewTab(id); else openNote(id) }
    function goFrom(mouse, v, id) { if (wantsNewTab(mouse)) openInNewTab(v, id); else go(v, id) }
    function newTab() { openInNewTab("desk") }
    function switchTab(i) {
        if (i < 0 || i >= tabs.length || i === activeTab) return
        activeTab = i
        _showTab()
    }
    function _showTab() {
        const t = tabs[activeTab]
        history = t.history || []
        historyIndex = t.historyIndex !== undefined ? t.historyIndex : -1
        const n = t.note ? noteData(t.note) : null
        // A tab with no history yet (restored) starts one with this place.
        _navigating = history.length > 0
        if (t.note && !(n && n.id)) go("desk")       // its note (or file) is gone
        else go(t.view, t.viewId, t.note)
        _navigating = false
    }
    function closeTab(i) {
        if (tabs.length < 2 || i < 0 || i >= tabs.length) return
        const t = tabs.slice()
        t.splice(i, 1)
        const wasActive = i === activeTab
        tabs = t
        if (wasActive) {
            activeTab = Math.min(i, t.length - 1)
            _showTab()
        } else if (i < activeTab) activeTab = activeTab - 1
        _saveTabs.restart()
    }
    function closeOtherTabs(i) {
        tabs = [tabs[i]]
        activeTab = 0
        _showTab()
        _saveTabs.restart()
    }
    function cycleTab(delta) {
        if (tabs.length > 1) switchTab((activeTab + delta + tabs.length) % tabs.length)
    }
    function moveTab(from, to) {
        if (from === to || from < 0 || to < 0 || from >= tabs.length || to >= tabs.length) return
        const t = tabs.slice()
        const [moved] = t.splice(from, 1)
        t.splice(to, 0, moved)
        const active = tabs[activeTab]
        tabs = t
        activeTab = t.indexOf(active)
        _saveTabs.restart()
    }
    // The tab's label and icon, from the place it shows.
    function tabInfo(t) {
        tabsTick
        switch (t.view) {
        case "note": {
            const n = t.note === selectedNoteId ? currentNote : noteData(t.note)
            if (n.is_file) return { title: n.title || "File", icon: "file", color: "" }
            return { title: n.title || "Untitled", icon: n.is_locked ? "lock" : "", color: "" }
        }
        case "list": { const l = listById(t.viewId); return { title: l ? l.name : "List", icon: "folder", color: l ? l.color : "" } }
        case "todos": return { title: "To-dos", icon: "circle-check", color: "" }
        case "search": return { title: t.viewId ? "Search: " + t.viewId : "Search", icon: "search", color: "" }
        case "settings": return { title: "Settings", icon: "sliders-horizontal", color: "" }
        case "trash": return { title: "Trash", icon: "trash-2", color: "" }
        default: return { title: "Today", icon: "calendar", color: "" }
        }
    }
    // Tabs come back next time (just the places; history starts fresh).
    property Timer _saveTabs: Timer {
        interval: 800
        onTriggered: state.save("qt.tabs", JSON.stringify({
            active: state.activeTab,
            tabs: state.tabs.map(t => ({ view: t.view, viewId: t.viewId, note: t.note }))
        }))
    }
    function restoreTabs() {
        let saved = null
        try { saved = JSON.parse(Store.setting("qt.tabs", "")) } catch (e) { saved = null }
        const list = saved && Array.isArray(saved.tabs) ? saved.tabs.filter(t => t && t.view) : []
        if (list.length < 2) { go("desk"); return }
        tabs = list.map(t => ({ view: t.view, viewId: t.viewId || "", note: t.note || "", history: [], historyIndex: -1 }))
        activeTab = Math.max(0, Math.min(list.length - 1, saved.active || 0))
        _showTab()
    }
    // Older callers.
    function setView(v, id) { if (v === "tag") openTag(id); else go(v, id) }
    function selectNote(id) { if (id) openNote(id); else go("desk") }

    function goBack() { navigate(-1) }
    function goForward() { navigate(1) }
    function navigate(delta) {
        let i = historyIndex + delta
        while (i >= 0 && i < history.length) {
            const e = history[i]
            const n = e.note ? noteData(e.note) : null
            if (!e.note || (n.id && !n.is_trashed)) {
                historyIndex = i
                _navigating = true
                go(e.view, e.viewId, e.note)
                _navigating = false
                return
            }
            i += delta
        }
    }

    // Opens a note from anywhere. Today's daily note lives on the desk.
    // From search: open the note with its find bar on `query`, at the first match.
    signal findInNoteRequested(string query)
    function openNoteAt(id, query, mouse) {
        if (mouse && wantsNewTab(mouse)) openNoteInNewTab(id)
        else openNote(id)
        if (selectedNoteId === id && (query || "").trim() !== "") findInNoteRequested(query.trim())
    }
    function openNote(id) {
        const n = noteData(id)
        if (!n.id) return
        if (n.is_daily && n.daily_date === todayIso && !n.is_trashed) { go("desk"); return }
        if (n.id && !Files.isFile(id)) save("qt.lastNote", id)
        go("note", "", id)
    }
    function openTag(tagId) {
        for (const t of tags) if (t.id === tagId) { go("search", "#" + t.name); return }
    }
    function openSettings(section) { go("settings", section || "appearance") }
    function openSearch(query) { go("search", query || "") }

    function newNote(opts) {
        const data = {
            title: (opts && opts.title) || "Untitled",
            note_type: (opts && opts.type) || defaultNoteType,
            list_id: (opts && opts.listId !== undefined) ? opts.listId : (view === "list" ? viewId : (currentNote.list_id || ""))
        }
        const n = Store.createNote(data)
        openNote(n.id)
        if (!(opts && opts.title)) focusTitleRequested(true)
        return n.id
    }

    function trashNote(id) {
        const n = Store.note(id)
        Store.trashNote(id)
        if (id === selectedNoteId) {
            if (n.list_id) go("list", n.list_id)
            else go("desk")
        }
        toast("Moved to trash")
    }

    function restoreNote(id) { Store.restoreNote(id); if (id === selectedNoteId) refreshCurrent(); toast("Restored") }

    function deleteForever(id) {
        Store.deleteNotePermanently(id)
        if (id === selectedNoteId) go("trash")
    }

    function duplicate(id) { const n = Store.duplicateNote(id); if (n.id) openNote(n.id) }

    function toggleLock(id) {
        if (!Store.hasLockPin) { pinPromptRequested("set", id); return }
        const locked = Store.toggleNoteLock(id)
        if (!locked) Store.markUnlocked(id)
        refreshCurrent()
        toast(locked ? "Note locked" : "Note unlocked")
    }
    // Closes an unlocked note again without asking for the PIN.
    function lockAgain(id) {
        Store.relock(id)
        refreshCurrent()
    }

    // Ticks a checklist item from outside the editor (desk, to-dos, search).
    // An open editor gets it, so its undo stack and caret survive.
    signal taskChecked(string noteId, int index, bool checked)
    function checkTask(noteId, index, checked) {
        if (checked === undefined) checked = true
        editorTaskToggleRequested(noteId, index)
        if (!_taskHandled) Store.setTaskChecked(noteId, index, checked)
        _taskHandled = false
        taskChecked(noteId, index, checked)
    }
    property bool _taskHandled: false
    function claimTask() { _taskHandled = true }

    function convertToRich(id) {
        const n = Store.note(id)
        if (!n.id || n.note_type !== "plain") return
        Store.updateNote(id, { note_type: "rich", content: App.plainToRich(n.content || "") })
        refreshCurrent()
    }

    property Connections _store: Connections {
        target: Store
        function onNotesChanged() { state.refreshCounts(); state.refreshLists(); state.refreshTags(); state._tasksLater.restart(); state.tabsTick++ }
        function onLockStateChanged() { state.lockTick++; state.refreshTasks() }
        function onNoteChanged(id) { if (id === state.selectedNoteId) { state.currentNote = Store.note(id); state.currentTags = Store.tagsForNote(id) } }
        function onListsChanged() { state.refreshLists(); state.tabsTick++ }
        function onTagsChanged() { state.refreshTags() }
        function onTodosChanged() { state.refreshCounts(); state.refreshTodoLists(); state._tasksLater.restart() }
    }
    property Connections _files: Connections {
        target: Files
        function onExternallyChanged(id) { if (id === state.selectedNoteId) state.refreshCurrent() }
        function onWriteFailed(id, error) { state.toast("Couldn't save " + Files.pathOf(id) + ": " + error) }
    }
}
