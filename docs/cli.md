# CLI Tool (noted-cli)

A standalone command-line interface for creating and managing notes. Works on Windows, macOS, and Linux. The command is `noted-cli` (there is no bare `noted` command).

## Setup

### Development (your machine)

```bash
cd cli
yarn install    # installs its own better-sqlite3 (compiled for system Node)
cd ..
yarn cli:build  # compiles TypeScript
cd cli
npm link        # makes `noted-cli` available globally
```

### Installed App Users

Settings > Command Line > toggle **Install CLI**. This creates a system wrapper that uses the app's bundled Node.js — no separate Node installation needed.

## Commands

### create

Create a new note. Defaults to rich text with markdown → TipTap conversion.

```bash
noted-cli create --title "Meeting Notes" --content "# Agenda"
```

**Multi-line content must come from stdin** — a literal `\n` inside `--content` is passed through verbatim and is *not* turned into a newline. Pipe instead:

```bash
printf '# Agenda\n\n- Review Q4\n- Plan Q1' | noted-cli create --title "Meeting Notes"
cat document.md | noted-cli create --title "Imported Doc"
curl -s https://example.com/notes.md | noted-cli create --title "From Web"
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `--title <text>` | Note title | `"Untitled"` |
| `--content <text>` | Note content (single line; use stdin for multi-line) | empty |
| `--type <rich\|plain>` | Note type | `rich` |
| `--list <name\|id>` | Add to a list (creates the list if it doesn't exist) | none |

**Output:** JSON — `{ "created": true, "id": "...", "title": "...", "list_id": ... }`.

### update / edit

Modify an existing note. A **title-only** update preserves the note's existing rich formatting (it does not re-render the body).

```bash
noted-cli update <note-id> --title "Renamed"
noted-cli update <note-id> --content "# Replaced body"
echo "## Follow-up" | noted-cli update <note-id> --append   # append, don't replace
noted-cli update <note-id> --type plain
```

**Options:**
| Flag | Description |
|------|-------------|
| `--title <text>` | Replace the title (`--title ""` clears it) |
| `--content <text>` | Replace the content (or pass `--content` with no value to take it from stdin; `--content ""` clears it) |
| `--append` | Append `--content`/stdin to the existing content instead of replacing it |
| `--type <rich\|plain>` | Change the note type |

The body is **only** touched when you pass `--content` or `--append`. A
title-only update never reads stdin, so it's safe to run inside a pipeline
(`somecmd | noted-cli update <id> --title "X"` keeps the existing body).

**Output:** JSON — `{ "updated": true, "id": "...", "title": "...", "note_type": "..." }`.

### create-list

Create a list. No-op (returns the existing list) if a list with that name already exists.

```bash
noted-cli create-list --name "Projects" --color "indigo"
```

### move

Move a note to a list (created if needed). Omit `--list` to remove the note from its list.

```bash
noted-cli move <note-id> --list "Archive"
noted-cli move <note-id>                 # remove from list
```

### list / ls

```bash
noted-cli list
noted-cli list --limit 10
noted-cli list --json     # JSON array — use this for scripting/agents
```

### get

```bash
noted-cli get <note-id>
noted-cli get <note-id> --json    # full JSON output
```

### search / find

Full-text search using SQLite FTS5.

```bash
noted-cli search "meeting notes"
noted-cli search "roadmap" --limit 5
noted-cli search "roadmap" --json
```

### delete / rm

Moves a note to trash (soft delete).

```bash
noted-cli delete <note-id>
```

### lists / tags

Show all custom lists / tags. Both accept `--json`.

```bash
noted-cli lists --json
noted-cli tags --json
```

### help

```bash
noted-cli help
```

## Machine-readable output

For agents and scripts, prefer JSON:

- `create` and `update` **always** print JSON containing the note `id`.
- `get --json` prints the full note (including `content`, the TipTap JSON).
- `list`, `search`, `lists`, and `tags` print a JSON **array** when given `--json`.

Without `--json`, the read commands print a human-friendly format whose `id`/`title` columns are not safe to split on (titles contain spaces).

## Database Path

The CLI reads/writes the same SQLite database as the desktop app:

| OS | Path |
|----|------|
| Windows | `%APPDATA%/noted/databases/app.sqlite` |
| macOS | `~/Library/Application Support/noted/databases/app.sqlite` |
| Linux | `~/.config/noted/databases/app.sqlite` |

If the database doesn't exist, the CLI creates it with the full schema (safe to run before the app has ever been opened).

## Live updates

If the desktop app is open while the CLI writes, the app detects the external
change (via SQLite's `PRAGMA data_version`) within ~1s and refreshes the note
list, lists, tags and todos automatically — including any pop-out windows — with
no restart needed. If the edited note is the one currently open, the editor
reloads it too, unless you have unsaved local edits in progress (those are never
overwritten).

## AI Integration

The CLI is designed for programmatic use. An AI agent or script can create and
edit rich-text notes with markdown support:

```bash
# AI writes a markdown note (pipe multi-line content via stdin)
ai-tool generate-report | noted-cli create --title "Daily Report"

# Append a section to an existing note
echo "## Addendum" | noted-cli update <note-id> --append

# Read a note back as structured JSON
noted-cli get <note-id> --json
```

**Markdown converted to rich text:** headings (`#` `##` `###`), `**bold**`,
`*italic*`, `~~strikethrough~~`, `` `code` ``, `[links](url)`, bullet
(`-`) and ordered (`1.`) lists, task lists (`- [ ]` / `- [x]`), pipe tables,
blockquotes (`>`), fenced code blocks, and horizontal rules (`---`). The
conversion uses the same parser as the in-app markdown paste handler, so CLI
notes render identically to ones created in the editor.
