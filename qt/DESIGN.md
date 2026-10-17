# noted. design reference

What the Qt build should look like and how it should behave. The prototype is the source of truth
for anything this page doesn't spell out:
https://claude.ai/artifact/GjvcS1uZshE13v7Eomg3f8 (private to the owner). Every frame there is
interactive. Click around it before building a screen.

This replaces the current look (IBM Plex, the three-pane note list, the settings dialog). The data
model doesn't change: same database, same settings keys unless noted under
[Settings](#settings).

## Ground rules

- **Calm, not clever.** One typeface, warm greys, and colour that only means something: the accent
  marks state (ticked, today, selected, focused), red marks overdue and destructive, list colours
  mark lists. Nothing else gets colour.
- **No AI-template look.** No pill chips, no all-caps or mono section labels, no tiny progress bars,
  no gradient or glow, no icon tiles behind menu icons, no dividers between notes in a list.
  Section labels are sentence case, 12–13px, weight 500.
- **Words over badges.** "3 of 5 done", "Edited 12m ago", "Shared with Tunde". A count is plain
  muted text after its label, never in a bubble.
- **Copy:** sentence case everywhere, curly quotes and apostrophes (’ “ ”), an ellipsis on any item
  that opens a dialog or picker ("Export…", "Move to list…"), and no exclamation marks.
- **Private by construction.** A locked note's body is never drawn, measured, previewed or indexed
  into anything visible. See [Locked notes](#locked-notes).

## Colour tokens

These replace `Theme.palettes`. Names are the contract. Use them as-is in `Theme.qml` (as `c.bg`,
`c.ink`, …) so the prototype and the build stay greppable against each other.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#1C1C1B` | page, main area |
| `sidebar` | `#F5F4F1` | `#161615` | sidebar (darker than the page in dark) |
| `selected` | `#E8E6E0` | `#2B2B29` | selected sidebar row, current settings section |
| `pressed` | `#ECEAE5` | `#2E2E2B` | pressed or active button, highlighted menu row |
| `raised` | `#FFFFFF` | `#262624` | menus, pickers, quick find |
| `card` | `#FFFFFF` | `#222221` | list sheets |
| `field` | `#FFFFFF` | `#222221` | inputs, secondary buttons, keycaps |
| `folder` | `#FAFAF8` | `#212120` | list folder cards, notice banners |
| `code-bg` | `#F7F6F3` | `#252523` | code blocks, text-size preview |
| `inline-code` | `#F1EFEA` | `#2D2D2A` | inline code |
| `hl` | `#FBEFB8` | `#4D4220` | highlight mark, search matches |
| `ink` | `#1B1B1A` | `#EDECE9` | titles, strongest text |
| `ink-2` | `#22221F` | `#E4E3DF` | to-do text, menu items |
| `text` | `#2A2926` | `#D9D8D3` | body text |
| `text-2` | `#3A3936` | `#CAC9C3` | selection toolbar buttons |
| `secondary` | `#4A4945` | `#B5B4AE` | icons, section labels, quotes |
| `tertiary` | `#5F5E59` | `#9E9D97` | sidebar group labels, snippets |
| `muted` | `#6E6D68` | `#8F8E88` | meta text, counts, dates |
| `placeholder` | `#767570` | `#86857F` | placeholders |
| `faint` | `#8F8D87` | `#6F6E69` | bullets, empty checkbox border, "Add date" |
| `faintest` | `#B9B7B0` | `#55544F` | breadcrumb slash, strike-through line |
| `underline` | `#C9C6BF` | `#55544F` | link-style button underline |
| `link-line` | `#A9A7A0` | `#77766F` | in-note link underline |
| `quote` | `#D6D3CC` | `#46453F` | quote bar |
| `line` | `#E7E5E0` | `#2B2B29` | hairlines: sidebar edge, rules, card borders |
| `line-strong` | `#E2E0DA` | `#353532` | field and button borders, table header rule |
| `line-soft` | `#ECEAE5` | `#2A2A28` | tab underline track, code block border |
| `line-faint` | `#F0EEE9` | `#262625` | table rows, settings rows, footer |
| `card-line` | `#E5E3DE` | `#2F2F2D` | sheet border |
| `menu-line` | `#EDEBE6` | `#363633` | separators inside menus |
| `red` | `#B4432F` | `#E2765F` | overdue, destructive, errors |
| `on-accent` | `#FFFFFF` | `#FFFFFF` | tick and text on an accent fill |
| `seg-track` | `#EFEDE8` | `#2A2A28` | segmented control track |
| `seg-on` | `#FFFFFF` | `#3B3B38` | segmented control selected segment |
| `switch-off` | `#D6D3CC` | `#46453F` | switch track when off |
| `knob` | `#FFFFFF` | `#F2F1EE` | switch knob |
| `scrim` | `rgba(27,27,26,.16)` | `rgba(0,0,0,.5)` | behind quick find |

Shadows (dark mode swaps shadow for a faint light ring, since shadows vanish on dark):

| Token | Light | Dark |
|---|---|---|
| `shadow-pop` (menus, pickers) | `0 8 24 rgba(0,0,0,.12)` + 1px ring `rgba(0,0,0,.08)` | `0 10 28 rgba(0,0,0,.45)` + 1px ring `rgba(255,255,255,.07)` |
| `shadow-modal` (quick find) | `0 24 60 rgba(0,0,0,.16)` + ring `rgba(0,0,0,.07)` | `0 24 60 rgba(0,0,0,.55)` + ring `rgba(255,255,255,.08)` |
| `shadow-card` (sheets) | `0 1 2 rgba(0,0,0,.04)` | none |

**Accent.** One user setting, four choices: Blue `#2F5AC8` (default), Green `#1F7A5C`,
Rust `#9A4A1F`, Ink `#1B1B1A`. In dark mode the accent is mixed 22% towards white so it holds on
the darker ground. Ink becomes `ink` (near-white), and `on-accent` becomes `bg` so ticks stay
visible. Selected text uses the accent at 20% alpha (34% in dark).

**List colours.** The database stores colour *names*, so keep the names and re-tone them:

| Name | Hex | | Name | Hex |
|---|---|---|---|---|
| blue | `#4A6FA5` | | purple | `#8A5A83` |
| teal | `#3E8A8A` | | gray | `#6E6D68` |
| green | `#5E8C61` | | red | `#A8483B` |
| yellow | `#B07D2B` | | indigo | `#5B62A8` |
| orange | `#B4543A` | | pink | `#A85A78` |
| cyan | `#3D7F9E` | | | |

The list page's colour picker shows the first seven (Blue, Teal, Green, Ochre=yellow,
Rust=orange, Plum=purple, Grey). The other four still render for lists that already use them. In
dark mode every list colour is mixed 20% towards white.

## Type

- **Geist** for everything, **Geist Mono** for code, paths, server URLs and markdown hints in the
  `/` menu. Both are OFL. Bundle them in `resources/fonts` in place of IBM Plex.
- Numbers that line up (counts, dates, word counts, calendar) use tabular figures.

| Role | Size / weight / line-height | Notes |
|---|---|---|
| Page title (note, list, To-dos, Settings section) | 34 / 650 / 1.15, tracking −0.02em | |
| Heading in a note | 21 / 600 / 1.35, −0.01em | |
| Subheading | 17 / 600 / 1.4 | |
| Body in a note | 16 / 400 / 1.5 | scales with Text size |
| Body on the desk | 16 / 400 / 1.65 | |
| Card title, search result title | 15 / 500 / 1.35–1.4 | two lines max on cards |
| Sidebar row | 14 | nested note rows 13.5 |
| Menu row, settings label | 14 / 14.5 (500) | |
| Snippet, description | 13.5 / 1.45–1.55 | `tertiary` or `muted` |
| Meta row, section label | 13 (label 500) | |
| Count, date | 12.5 tabular | `muted` |
| Sidebar group label (Pinned, Lists, Files) | 12 / 500 | `tertiary` |
| Code block | Mono 13 / 1.6 | |
| Table | 14.5 / 1.5; header 13 / 500 | |

## Layout

**Shell.** The sidebar is 248–272px with a 1px `line` right edge. The main area has a 44px header
(sidebar toggle when hidden, breadcrumb, page actions, Windows caption buttons), the scrolling
content, and on notes a 30px footer.

**Tabs.** With two or more tabs, a 38px strip in `sidebar` sits above the header and takes the
caption buttons. Tabs are 96–220px, radius 7 at the top; the active one is `bg` with a `line` edge
and runs into the page, the rest are text on the strip with hairlines between. Notes show just their
title (a lock or file icon when that applies), lists their folder in the list colour. Middle- or
Ctrl-click anything to open it in a new tab; Ctrl+T, Ctrl+W, Ctrl+Tab; drag to reorder. Each tab
keeps its own back/forward, and the set comes back next launch (`qt.tabs`).

**Sidebar tree.** An open list shows its 8 latest notes, then "Show more" (20 at a time). While you
scroll through an open list its row stays pinned at the top of the tree.

**Images.** Paste, drop, or `/` Image. An image is its own block, as wide as it is up to the text
column, with the box gap (22px) around it. Files are copied to `attachments/` beside the database and
the note keeps `{"type":"image","attrs":{"src":"attachment:<file>"}}`. Electron has no image node and
drops it if it saves that note.

**Note page.** A four-column grid gives equal gutters either side of the text, with the outline in
a column of its own:

```
normal: minmax(48px,1fr) | minmax(0, clamp(680px, 62%, 960px) − 96px) | minmax(48px,1fr) | 200px or 0
wide:   64px | 1fr | 64px | 200px or 0
```

The outline ("On this page") only appears with two or more headings, and it's sticky. The title
block starts 40px from the top. The meta row sits 12px under the title and 30px above the body.

**Block rhythm.** One rule decides the space between any two blocks (it's `gapFor` in the
prototype). Use it in `doc/Styler` instead of per-block margins:

| Between | Gap |
|---|---|
| first block | 0 |
| anything and a divider, either side | 28 |
| anything → heading | 40 |
| heading → subheading | 14 |
| anything else → subheading | 30 |
| heading/subheading → next block | 10 |
| to-do → to-do, bullet → bullet, number → number | 4 |
| around code, tables, quotes | 22 |
| two plain-text file lines | 0 |
| a file's `#` title → heading | 24, → anything else 14 |
| everything else | 16 |

**Desk, list, To-dos, search.** Content max 1440px (main column up to 960px), padding 32/48/72, a 56px gap to a 260–320px
right column that wraps under on narrow windows. To-dos and Settings use a single centred column
the same width as a note's text.

**Radii.** 4–5 checkboxes, 6 rows and icon buttons, 7 fields and buttons, 8 code blocks,
banners and segmented tracks, 10 cards, sheets and menus, 12 quick find.

## Components

| Component | Spec |
|---|---|
| Secondary button | 32px tall, 12px padding, 1px `line-strong`, `field` fill, 13.5px `ink`. Destructive ones only change the text to `red`. |
| Primary button | Only on the lock screen: `ink` fill, `bg` text, 38px. Not accent. |
| Link button | Text in `secondary`, underline `underline`, offset 3px. "All 9", "Clear filters", "Copy into notes". |
| Segmented control | `seg-track` track with 3px padding and radius 8; segments 28px, radius 6; selected segment `seg-on` with a 1px shadow, weight 500. |
| Switch | 36×22 track, 16px knob, `accent` on / `switch-off` off. |
| Checkbox | 18px in notes and to-dos, 16px in side columns. Radius 5. Empty: 1.5px `faint` border; ticked: `accent` fill, `on-accent` tick. |
| Tabs | 38px text tabs, 24px apart, 2px `ink` underline on the current one over a 1px `line-soft` track. Count follows in `muted`. |
| Menu | `raised`, `shadow-pop`, radius 10, 6px padding, 34px rows, separators 1px `menu-line` with 6/4px margin. Highlighted row `pressed`. Widths 224–236 for menus, 248–300 for pickers. |
| Keycap | 26px tall, `field` fill, 1px `line-strong` with a 2px bottom edge, radius 6. |
| Folder card (desk) | 72×16 tab plus a body, both `folder` with `line-strong`. List dot, name, count, latest note, "Edited …". |
| Sheet (list page) | 180px tall, `card`, `card-line`, radius 10: a 45%-scale render of the note's first nine blocks, faded out at the bottom. Title (2 lines) and date under it. |

## Screens and states

Each line is a frame in the prototype.

- **Home ("desk"):** today's daily note (blocks inline, to-dos tickable), Recently edited (4
  cards), Your lists (folder cards), and the right column with the month calendar (dots on days
  with a daily note) and Open to-dos grouped Overdue / Today / This week / Later / Whenever.
- **Note:** breadcrumb (list folder icon in the list colour / note title), pin, More. Meta row: list
  name (opens Move to), Edited, "n of m done", `#tags`, Add tag, "Shared with …" for shared
  notes. Body, then an empty line that takes typing or `/`. Footer: words and save state.
- **Selection toolbar:** Bold, Italic, Strike, Inline code, Link, Highlight | Turn into ▾. It floats
  10px above the selection.
- **More menu (note):** Full width ✓, Move to list…, Copy as Markdown, Export…, Lock with PIN /
  Lock again, ― Move to trash (red).
- **To-dos page:** tabs Upcoming / By list / Done. The add field puts a to-do in today's note.
  Anything ticked stays in place, struck through, until you leave, so a mis-tap is easy to undo.
- **List page:** "List · n notes", title, New note, Sheets/Rows, sort (Last edited / Title A–Z).
  Right column: the list's open to-dos and its colour.
  - **Time groups:** only when a list has more than 15 notes *and* is sorted by date. Pinned
    first, then This week, Last week, Earlier in \<month\>, then month names. Each heading shows a
    count. Sorting A–Z or having 15 or fewer notes gives one flat grid.
  - **Rows view:** title, date, snippet (when Note previews is on), "n open to-dos · #tags".
- **Files:** a sidebar group, shown only while a file is open. Rows are the file name; add the
  folder when two open files share a name. The page shows the file exactly as it is: no
  separate title (a markdown file's first `#` heading is the title), and a `.txt` file's lines stay
  lines. Meta row: "Markdown file", the full path (ellipsized, tooltip), "Saved …", Copy into
  notes. Footer says "Saved to disk". More menu: Show in folder, Copy into notes, ― Close file.
- **Quick find (Ctrl K):** centred dialog, 560px. Recent notes when empty, title-and-text matches
  as you type. A last row reads "Search everywhere for “…”" (Ctrl Shift F). With no match,
  "Create a note called “…”" (Enter).
- **Search page:** big field, tabs All / Notes / To-dos / Files with counts. All shows up to 4
  notes, 3 to-dos and 3 files, each with a "Show all n …" link. Notes rank title matches first,
  then the most mentions, then recency. Results show the title and snippet with matches in `hl`,
  plus list, date, "n matches" and tags. To-dos can be ticked right there. The right column
  filters by list and tag (counts follow the query, not the filters). Files hide while a list or
  tag filter is on. Empty field: Recent searches and a one-line explanation.
- **Settings page** (not a dialog): see [Settings](#settings).

**States**

- **First run:** an empty sidebar ("No lists yet"), today's note with a placeholder line, and a
  Getting started block with three settings-style rows: Make a list (New list), Open a markdown
  file (Open file…), Jot something down from anywhere (Ctrl Alt N). No tour or modal.
- **Empty list:** "Nothing in X yet.", one line on how notes get in, and a dashed sheet that makes
  a new note. Layout and sort controls hide until there's a note.
- **No to-dos:** "No to-dos yet. Add one above, or type [ ] at the start of a line in any note."
- **Nothing found:** "Nothing matches “x”." Adds "with these filters" plus Clear filters when
  filters are on.
- **Locked note:** see below.
- **Footer** says "Saved". Sync problems show on the Sync settings page, not on every note.

### Locked notes

- The title, list and edited time stay visible. Everything derived from the body is hidden: the
  body, the outline, "n of m done", the word count, the sheet's mini render (it shows a lock and
  "Locked" instead), the row snippet, the desk card snippet, its to-dos (left out of every to-do
  list), and the search body (title only).
- The lock panel: lock icon, "This note is locked", "Enter your PIN to open it. It stays open
  until you quit noted.", a numeric PIN field and Unlock (Enter works). A wrong PIN clears the
  field, gives it a `red` border and shows "That PIN didn't work. Try again." The message is
  announced (`role="alert"`).
- **Don't blur the real text.** A blur still draws the content and leaks its shape. Leave it out of
  the scene graph entirely. This replaces the current `LockOverlay` approach.
- Once unlocked, the More menu offers "Lock again". Sidebar rows show a small lock after the title
  while a note is locked.

## Floating pieces

- **`/` menu:** typing `/` on any line opens 10 blocks: Text, Heading `##`, Subheading `###`,
  To-do `[ ]`, Bulleted list `-`, Numbered list `1.`, Quote `>`, Code block ```` ``` ````,
  Table, Divider `---`. Typing filters by name and aliases (todo, check, bullet, h2, hr…). ↑↓
  move, Enter inserts, Esc closes, and a footer hint says so. It's 300px wide, below the line, or
  above when there's less than ~440px of room. Text-type picks turn the current line into that
  block; Divider, Code and Table insert at once. Enter on an empty list or to-do line drops back
  to plain text, and Backspace on an empty typed line does too.
- **Due date:** click a to-do's date, or the faint "Add date" that appears on hover. The picker is
  272px: Today (Sat), Tomorrow (Sun), Next week (Mon 19), Next weekend (Sat 24), a Monday-first
  month calendar with ‹ ›, today in accent text, the chosen day in an accent fill, past days in
  `faint`, and Remove date. Labels: "Today", "Tomorrow", "Wed 21" within the week, "3 Nov" later.
  Groups: past = Overdue, today = Today, the next seven days = This week, after that = Later,
  no date = Whenever.
- **Tags:** "Add tag" opens a 260px picker: a search field, existing tags sorted by use with their
  counts and a tick when the note has them, and "Create #name" when nothing matches exactly. Names
  are lower case, with spaces turned into hyphens.
- **Move to list:** the list name in the meta row, or More → Move to list…, opens a 248px picker:
  search plus the lists (folder in colour, tick on the current one). The same rows form the
  right-click "Move to" submenu.
- **Right-click menus** (sidebar). The row keeps a 1.5px accent inset ring while its menu is open.
  The menu opens at the pointer, clamped inside the window, and the submenu flips left at the
  right edge.
  - Note: Open, Open in new window, Pin/Unpin, Move to ›, Copy as Markdown, Duplicate, ― Move to
    trash.
  - List: New note in X, Collapse/Expand, Rename, Change colour, ― Delete list…
  - File: Open, Show in folder, Copy into notes, ― Close file.
- Only one floating piece is open at a time. A click anywhere else closes it.

## Settings

A page in the main area. The sidebar stays, and the gear in the sidebar footer shows as selected.
Sections are on the left; the section name is the page title.

| Section | Rows | Key |
|---|---|---|
| Appearance | Theme: Light / Warm / Dark / Match Windows (preview cards) | `appTheme` = `light` \| `warm` \| `dark` \| `system` |
| | Accent: 4 swatches | **new** `qt.accent` (hex) |
| | Text size: Small / Default / Large / Larger, with a live sample | `qt.textScale` = 0.9375 / 1 / 1.094 / 1.1875 (15 / 16 / 17.5 / 19px body) |
| | Text width: Normal / Wide | `qt.wideText` |
| Editor | New notes start as: Rich text / Plain text | `defaultNoteType` |
| | Note previews (switch) | `showNotePreview` |
| | Markdown and text files: open in noted (switch) | file association, OS-level |
| Sync | Sync: Off + Set up…, or the folder, when it last synced, Sync now / Turn off | `sync_spaces` (own tables) |
| | Computers: this one, then each other one with when it last synced | — |
| | Shared lists: one row per list (folder, Copy code, Stop sharing), then Join a shared list | — |
| Security | Lock PIN: Change / Remove, or Set a PIN | `lock_pin_hash`, `lock_pin_salt` |
| | Locked notes: count and how locking works | — |
| Quick capture | Shortcut (keycaps + Change) | global hotkey |
| | Hide pop-outs from Alt+Tab (switch) | `popoutSkipTaskbar` |
| Data | Where your notes live (path + Show in folder) | — |
| | Export (JSON or SQL) | — |
| | Command line: noted-cli installed / Install | — |
| | Trash: count + Empty trash (red) | — |
| About | Wordmark, version, one-line credit | — |

Rows are a label (14.5/500) with a description (13.5 `muted`) on the left and the control on the
right, 16px padding, and `line-faint` between rows.

## Sync and sharing

There's no server. Sync goes through a folder something else already keeps in step between
computers (OneDrive, Dropbox, Google Drive, Syncthing, a network share). How it works is in
`core/include/noted/sync/SyncEngine.h` and `Ledger.h`. What people see:

- **Setting up** (Settings, Sync, Set up…): a folder and a passphrase. A folder that already has
  noted's notes is joined, and the dialog says so and asks for the passphrase used on the other
  computer. Otherwise it's a new library, and the passphrase is asked for twice, with a line
  saying it can't be recovered. Everything noted writes there is encrypted.
- **Sharing a list** (its sidebar menu, Share…): noted makes "<List> (noted)" inside a folder you
  pick. You share that folder with people through your cloud drive and send them the code: 13
  groups of four, shown whole on two lines with Copy. On a shared list the item reads Sharing…
  and shows the code, the folder and Stop sharing. Removing someone means unsharing the folder in
  the cloud drive. The dialog says so.
- **Joining a list** (Settings, Sync, Join…): the folder (once it's arrived) and the code.
- **Conflicts never ask.** Fields take the latest edit. Note bodies edited on two computers at
  once merge paragraph by paragraph. Where both changed the same paragraph, both versions stay,
  the earlier one first.

## Mapping onto the current QML

| Prototype | Qt today | Change |
|---|---|---|
| tokens above | `Theme.qml` palettes, IBM Plex | replace palettes and fonts; keep `mode`, add accent |
| sidebar | `panels/Sidebar.qml` | Pinned / Lists tree / Files; right-click menus |
| desk | `panels/MiniCalendar.qml`, `panels/OpenTasks.qml` | new home view composing them |
| list page | `panels/NoteListPane.qml`, `NoteCard.qml` | becomes a page (sheets / rows, time groups) instead of a middle pane |
| note page | `editor/EditorPane.qml`, `NoteHeader.qml`, `TagsBar.qml` | grid layout, meta row, outline, footer |
| selection toolbar, `/` menu | `editor/EditorToolbar.qml` | fixed toolbar goes; the `qt.toolbarPosition` setting goes with it |
| lock | `editor/LockOverlay.qml`, `dialogs/PinDialog.qml` | inline lock panel, no blur |
| quick find | `dialogs/CommandPalette.qml` | restyle + the two new last rows |
| search page | (none) | new; uses the FTS5 search in `NoteStore` |
| settings | `dialogs/SettingsDialog.qml` | becomes a page |
| to-dos | `todos/TodoView.qml`, `TodoRow.qml` | tabs, add field, stay-in-place ticking |
| menus, switch, keycaps | `controls/PopupMenu.qml`, `MenuRow.qml`, `Toggle.qml`, `Kbd.qml` | restyle to the component specs |

## Still open

- **Warm is back** (parchment, from the Electron build; `Theme.warmTokens`). Slate is gone and
  becomes Light.
- **Hover and focus.** Not prototyped. Suggested: hover = `pressed` at 60%, keyboard focus = a 2px
  accent ring offset 2px, only on keyboard focus.
- **Narrow windows.** The right columns wrap under the content below about 900px, and the outline
  hides first. The sidebar should collapse to its toggle under about 720px.
- **Not redesigned yet:** the trash view, pop-out note windows and the quick-capture window. Build
  them from the same tokens and components.
