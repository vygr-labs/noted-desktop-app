# CLI Tool (noted-cli)

A standalone command-line interface for creating and managing notes. Works on Windows, macOS, and Linux.

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

Create a new note. Defaults to rich text with markdown-to-TipTap conversion.

```bash
noted-cli create --title "Meeting Notes" --content "# Agenda\n\n- Review Q4\n- Plan Q1"
```

**Pipe from stdin:**
```bash
echo "Quick thought" | noted-cli create --title "Idea"
cat document.md | noted-cli create --title "Imported Doc"
curl -s https://example.com/notes.md | noted-cli create --title "From Web"
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `--title <text>` | Note title | `"Untitled"` |
| `--content <text>` | Note content | empty |
| `--type <rich\|plain>` | Note type | `rich` |
| `--list <list-id>` | Add to a list | none |

**Output:** JSON with the created note's ID and title.

### list / ls

```bash
noted-cli list
noted-cli list --limit 10
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
```

### delete / rm

Moves a note to trash (soft delete).

```bash
noted-cli delete <note-id>
```

### lists

Show all custom lists.

```bash
noted-cli lists
```

### tags

Show all tags.

```bash
noted-cli tags
```

### help

```bash
noted-cli help
```

## Database Path

The CLI reads/writes the same SQLite database as the desktop app:

| OS | Path |
|----|------|
| Windows | `%APPDATA%/noted/databases/app.sqlite` |
| macOS | `~/Library/Application Support/noted/databases/app.sqlite` |
| Linux | `~/.config/noted/databases/app.sqlite` |

If the database doesn't exist, the CLI creates it with the full schema (safe to run before the app has ever been opened).

## AI Integration

The CLI is designed for programmatic use. An AI agent or script can create rich-text notes with full markdown support:

```bash
# AI writes a markdown note
ai-tool generate-report | noted-cli create --title "Daily Report"

# Create from a file
noted-cli create --title "Analysis" --content "$(cat report.md)"
```

Markdown headings, lists, tables, code blocks, bold/italic, and links are all converted to TipTap rich text on creation.
