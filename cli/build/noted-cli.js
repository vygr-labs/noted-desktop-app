#!/usr/bin/env node
// ─── Noted CLI ───────────────────────────────────────────
// Standalone CLI tool for creating and managing notes in the
// Noted app. Works on Windows, macOS, and Linux.
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
// ─── Database path resolution (cross-platform) ──────────
function getDbPath() {
    const platform = process.platform;
    let appData;
    if (platform === 'win32') {
        appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    }
    else if (platform === 'darwin') {
        appData = path.join(os.homedir(), 'Library', 'Application Support');
    }
    else {
        appData = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    }
    return path.join(appData, 'noted', 'databases', 'app.sqlite');
}
// ─── Database setup ──────────────────────────────────────
function openDb() {
    const dbPath = getDbPath();
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    ensureSchema(db);
    return db;
}
function getSchemaVersion(db) {
    const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`)
        .get();
    if (!row)
        return 0;
    const ver = db
        .prepare('SELECT MAX(version) as v FROM schema_version')
        .get();
    return ver?.v ?? 0;
}
function ensureSchema(db) {
    const version = getSchemaVersion(db);
    if (version < 1) {
        db.exec(`
			CREATE TABLE IF NOT EXISTS schema_version (
				version INTEGER PRIMARY KEY,
				applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS lists (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				icon TEXT DEFAULT 'folder',
				color TEXT DEFAULT 'gray',
				sort_order INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS notes (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL DEFAULT 'Untitled',
				content TEXT,
				content_plain TEXT,
				note_type TEXT DEFAULT 'rich' CHECK(note_type IN ('rich', 'plain')),
				list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
				is_daily INTEGER DEFAULT 0,
				daily_date TEXT,
				is_pinned INTEGER DEFAULT 0,
				is_trashed INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS tags (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				color TEXT DEFAULT 'gray',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS note_tags (
				note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
				tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
				PRIMARY KEY (note_id, tag_id)
			);
			CREATE TABLE IF NOT EXISTS todos (
				id TEXT PRIMARY KEY,
				note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
				text TEXT NOT NULL,
				is_completed INTEGER DEFAULT 0,
				due_date TEXT,
				source_daily_date TEXT,
				sort_order INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT
			);
			CREATE INDEX IF NOT EXISTS idx_notes_list ON notes(list_id);
			CREATE INDEX IF NOT EXISTS idx_notes_daily ON notes(is_daily, daily_date);
			CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
			CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
			CREATE INDEX IF NOT EXISTS idx_todos_note ON todos(note_id);
			CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date);
			CREATE INDEX IF NOT EXISTS idx_todos_daily ON todos(source_daily_date);
		`);
        db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(1);
    }
    if (version < 2) {
        db.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
				note_id UNINDEXED, title, content_plain
			);
		`);
        const existingNotes = db.prepare('SELECT id, title, content_plain FROM notes').all();
        const insertFts = db.prepare('INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)');
        for (const note of existingNotes) {
            insertFts.run(note.id, note.title, note.content_plain || '');
        }
        db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(2);
    }
    if (version < 3) {
        db.exec(`
			CREATE TABLE IF NOT EXISTS todo_lists (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				color TEXT DEFAULT 'gray',
				sort_order INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`);
        // Check if column exists before adding
        const cols = db.prepare("PRAGMA table_info(todos)").all();
        if (!cols.some(c => c.name === 'todo_list_id')) {
            db.exec(`ALTER TABLE todos ADD COLUMN todo_list_id TEXT REFERENCES todo_lists(id) ON DELETE SET NULL;`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_list ON todos(todo_list_id);`);
        }
        db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(3);
    }
    if (version < 4) {
        const cols = db.prepare("PRAGMA table_info(notes)").all();
        if (!cols.some(c => c.name === 'spellcheck')) {
            db.exec(`ALTER TABLE notes ADD COLUMN spellcheck INTEGER DEFAULT 1;`);
        }
        db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(4);
    }
}
// ─── Argument parsing ────────────────────────────────────
// Flags that never take a value — they must not swallow the following
// positional (e.g. `search --json roadmap` must keep "roadmap" as the query).
const BOOLEAN_FLAGS = new Set(['json', 'append']);
function parseArgs(argv) {
    const raw = argv.slice(2);
    const command = raw[0] || 'help';
    const args = [];
    const flags = {};
    let i = 1;
    while (i < raw.length) {
        const arg = raw[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = raw[i + 1];
            // `next !== undefined` (not truthiness) so an explicit empty value
            // like `--title ""` is kept as '' rather than collapsing to `true`,
            // which lets callers clear a title/body.
            if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith('--')) {
                flags[key] = next;
                i += 2;
            }
            else {
                flags[key] = true;
                i++;
            }
        }
        else {
            args.push(arg);
            i++;
        }
    }
    return { command, args, flags };
}
// Parse a `--limit` value, honouring an explicit 0 (which `parseInt(x) || def`
// would wrongly treat as falsy and replace with the default).
function parseLimit(val, def) {
    if (typeof val !== 'string')
        return def;
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n >= 0 ? n : def;
}
// ─── Read stdin (for piped content) ──────────────────────
function readStdin() {
    return new Promise((resolve) => {
        if (process.stdin.isTTY) {
            resolve('');
            return;
        }
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => resolve(data));
    });
}
function parseInlineMarkdown(text) {
    if (!text)
        return [];
    const nodes = [];
    // Matches: **bold**, *italic*, ~~strike~~, `code`, [text](url)
    const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;
    while ((match = inlineRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
        }
        if (match[2]) {
            nodes.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] });
        }
        else if (match[3]) {
            nodes.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] });
        }
        else if (match[4]) {
            nodes.push({ type: 'text', text: match[4], marks: [{ type: 'strike' }] });
        }
        else if (match[5]) {
            nodes.push({ type: 'text', text: match[5], marks: [{ type: 'code' }] });
        }
        else if (match[6] && match[7]) {
            nodes.push({ type: 'text', text: match[6], marks: [{ type: 'link', attrs: { href: match[7] } }] });
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        nodes.push({ type: 'text', text: text.slice(lastIndex) });
    }
    return nodes.length > 0 ? nodes : [{ type: 'text', text }];
}
function makeTextBlock(type, text, attrs) {
    const content = parseInlineMarkdown(text);
    return { type, content, ...(attrs ? { attrs } : {}) };
}
function parseCellContent(text) {
    if (!text)
        return [];
    // Checkbox inside a table cell: [ ] or [x]
    const checkMatch = text.match(/^\[([ xX])\]\s*(.*)/);
    if (checkMatch) {
        const checked = checkMatch[1].toLowerCase() === 'x';
        const rest = checkMatch[2];
        const nodes = [{ type: 'inlineCheckbox', attrs: { checked } }];
        if (rest) {
            nodes.push({ type: 'text', text: ' ' });
            nodes.push(...parseInlineMarkdown(rest));
        }
        return nodes;
    }
    return parseInlineMarkdown(text);
}
function parseMarkdownTable(lines) {
    const tableLines = lines
        .map((l) => l.trim())
        .filter((l) => l.startsWith('|') && l.endsWith('|'));
    if (tableLines.length < 2)
        return null;
    // Find the separator row (e.g. |---|---|)
    const sepIdx = tableLines.findIndex((l) => /^\|[\s\-:|]+\|$/.test(l));
    if (sepIdx < 1)
        return null;
    function parseCells(line) {
        return line
            .slice(1, -1) // remove leading/trailing |
            .split('|')
            .map((c) => c.trim());
    }
    const headerRows = tableLines.slice(0, sepIdx);
    const bodyRows = tableLines.slice(sepIdx + 1);
    const rows = [];
    for (const row of headerRows) {
        const cells = parseCells(row);
        rows.push({
            type: 'tableRow',
            content: cells.map((cell) => ({
                type: 'tableHeader',
                content: [{ type: 'paragraph', content: cell ? parseCellContent(cell) : undefined }],
            })),
        });
    }
    for (const row of bodyRows) {
        const cells = parseCells(row);
        rows.push({
            type: 'tableRow',
            content: cells.map((cell) => ({
                type: 'tableCell',
                content: [{ type: 'paragraph', content: cell ? parseCellContent(cell) : undefined }],
            })),
        });
    }
    if (rows.length === 0)
        return null;
    return { type: 'table', content: rows };
}
function parseLinesToNodes(lines) {
    const nodes = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // Fenced code block
        if (/^\s*```/.test(line)) {
            const codeLines = [];
            i++;
            while (i < lines.length && !/^\s*```/.test(lines[i])) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length)
                i++;
            nodes.push({
                type: 'codeBlock',
                content: codeLines.length > 0 ? [{ type: 'text', text: codeLines.join('\n') }] : undefined,
            });
            continue;
        }
        // Horizontal rule
        if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
            nodes.push({ type: 'horizontalRule' });
            i++;
            continue;
        }
        // Heading
        const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headingMatch) {
            nodes.push(makeTextBlock('heading', headingMatch[2].trim(), { level: headingMatch[1].length }));
            i++;
            continue;
        }
        // Blockquote
        if (/^\s*>\s+/.test(line)) {
            const quoteLines = [];
            while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
                quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
                i++;
            }
            const innerNodes = parseLinesToNodes(quoteLines);
            nodes.push({
                type: 'blockquote',
                content: innerNodes.length > 0 ? innerNodes : [{ type: 'paragraph' }],
            });
            continue;
        }
        // Markdown table
        if (/^\s*\|.*\|\s*$/.test(line)) {
            const tableLines = [];
            while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
                tableLines.push(lines[i]);
                i++;
            }
            const table = parseMarkdownTable(tableLines);
            if (table) {
                nodes.push(table);
                continue;
            }
            // Not a valid table — rewind and reprocess as normal lines
            i -= tableLines.length;
        }
        // Task list: - [ ] or - [x]
        if (/^\s*[-*•]\s+\[[ xX]\]\s+/.test(line)) {
            const taskItems = [];
            while (i < lines.length) {
                const tm = lines[i].match(/^\s*[-*•]\s+\[([ xX])\]\s+(.*)/);
                if (!tm)
                    break;
                taskItems.push({
                    type: 'taskItem',
                    attrs: { checked: tm[1].toLowerCase() === 'x' },
                    content: [makeTextBlock('paragraph', tm[2].trim())],
                });
                i++;
            }
            nodes.push({ type: 'taskList', content: taskItems });
            continue;
        }
        // Bullet list (- or •, or * followed by space+text — standalone * is italic)
        if (/^\s*[-•]\s+/.test(line) || /^\s*\*\s+[^*]/.test(line)) {
            const listItems = [];
            while (i < lines.length) {
                const bm = lines[i].match(/^\s*[-*•]\s+(.*)/);
                if (!bm)
                    break;
                if (/^\s*[-*•]\s+\[[ xX]\]\s+/.test(lines[i]))
                    break;
                listItems.push({
                    type: 'listItem',
                    content: [makeTextBlock('paragraph', bm[1].trim())],
                });
                i++;
            }
            nodes.push({ type: 'bulletList', content: listItems });
            continue;
        }
        // Ordered list: 1. text, 2) text
        if (/^\s*\d+[.)]\s+/.test(line)) {
            const listItems = [];
            while (i < lines.length) {
                const om = lines[i].match(/^\s*\d+[.)]\s+(.*)/);
                if (!om)
                    break;
                listItems.push({
                    type: 'listItem',
                    content: [makeTextBlock('paragraph', om[1].trim())],
                });
                i++;
            }
            nodes.push({ type: 'orderedList', content: listItems });
            continue;
        }
        // Regular line — parse inline markdown, skip blank lines (CSS margins)
        const trimmed = line.trim();
        if (trimmed) {
            nodes.push(makeTextBlock('paragraph', trimmed));
        }
        i++;
    }
    return nodes;
}
function textToTipTapJson(text) {
    return JSON.stringify({ type: 'doc', content: parseLinesToNodes(text.split('\n')) });
}
// Render markdown to a TipTap `content` value for a rich note. Returns null for
// empty/whitespace input so we store NULL (an empty document the editor renders
// as a clean blank note) instead of `{"type":"doc","content":[]}`, which is an
// invalid ProseMirror doc (the schema requires at least one block). Mirrors the
// null-guard cmdCreate already uses.
function renderRichContent(plain) {
    return plain && plain.trim() ? textToTipTapJson(plain) : null;
}
// Flatten a TipTap node's text for content_plain (FTS / word count). Block
// boundaries at the top level become newlines; inline marks are ignored.
function extractText(node) {
    if (node.type === 'text')
        return node.text || '';
    if (!node.content)
        return '';
    return node.content.map(extractText).join('');
}
function extractPlainFromContent(contentJson) {
    try {
        const doc = JSON.parse(contentJson);
        if (!doc || !Array.isArray(doc.content))
            return '';
        return doc.content.map(extractText).join('\n').trim();
    }
    catch {
        return '';
    }
}
function resolveListId(db, listRef) {
    // Try by ID first
    const byId = db.prepare('SELECT id FROM lists WHERE id = ?').get(listRef);
    if (byId)
        return byId.id;
    // Try by name (case-insensitive)
    const byName = db.prepare('SELECT id FROM lists WHERE LOWER(name) = LOWER(?)').get(listRef);
    if (byName)
        return byName.id;
    // Auto-create the list
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO lists (id, name) VALUES (?, ?)').run(id, listRef);
    console.log(`Created list: ${listRef}`);
    return id;
}
function cmdCreate(db, args, flags, stdinContent) {
    const title = flags.title || args[0] || 'Untitled';
    const content = flags.content || stdinContent || '';
    const noteType = flags.type === 'plain' ? 'plain' : 'rich';
    const listRef = flags.list || null;
    const listId = listRef ? resolveListId(db, listRef) : null;
    const contentPlain = content || null;
    const contentJson = noteType === 'rich' && content
        ? textToTipTapJson(content)
        : (noteType === 'plain' ? content : null);
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO notes (id, title, content, content_plain, note_type, list_id)
		 VALUES (?, ?, ?, ?, ?, ?)`).run(id, title, contentJson, contentPlain, noteType, listId);
    db.prepare('INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)').run(id, title, contentPlain || '');
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    console.log(JSON.stringify({ created: true, id: note.id, title: note.title, list_id: listId }, null, 2));
}
function cmdUpdate(db, args, flags, stdinContent) {
    const id = args[0] || (typeof flags.id === 'string' ? flags.id : undefined);
    if (!id) {
        console.error('Usage: noted-cli update <note-id> [--title "..."] [--content "..."] [--type rich|plain] [--append]');
        process.exit(1);
    }
    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) {
        console.error(`Note not found: ${id}`);
        process.exit(1);
    }
    // Note type (may be flipped via --type)
    let noteType = existing.note_type;
    if (flags.type === 'plain' || flags.type === 'rich')
        noteType = flags.type;
    // Content can come from --content or stdin. Only treat the body as changed
    // when the user explicitly asked (--content or --append) — otherwise a stray
    // pipe on stdin during a `update <id> --title X` would silently wipe the body.
    const append = flags.append === true;
    const contentFromFlag = typeof flags.content === 'string';
    const contentInput = contentFromFlag ? flags.content : stdinContent;
    const wantsContentChange = 'content' in flags || append;
    // `contentFromFlag` keeps `--content ""` (clear body) as a real change.
    const contentProvided = wantsContentChange && (contentFromFlag || contentInput.length > 0);
    const typeChanged = noteType !== existing.note_type;
    // Default: leave content untouched so a title-only edit keeps rich formatting.
    let finalContent = existing.content;
    let finalPlain = existing.content_plain;
    if (contentProvided) {
        if (append) {
            // Derive the existing plain text from the rich doc when content_plain
            // is missing, so the FTS index / word count keep the whole body — not
            // just the appended part — in sync with the rich `content`.
            const existingPlain = existing.content_plain
                || (existing.note_type === 'rich' && existing.content
                    ? extractPlainFromContent(existing.content)
                    : '');
            finalPlain = existingPlain ? `${existingPlain}\n${contentInput}` : contentInput;
            if (noteType === 'rich') {
                // Append new nodes onto the existing rich doc so prior formatting
                // survives (re-parsing content_plain would flatten app-authored marks).
                const newNodes = parseLinesToNodes(contentInput.split('\n'));
                let doc = null;
                if (existing.note_type === 'rich' && existing.content) {
                    try {
                        const parsed = JSON.parse(existing.content);
                        if (parsed && Array.isArray(parsed.content))
                            doc = parsed;
                    }
                    catch {
                        // fall back to re-rendering below
                    }
                }
                if (doc) {
                    doc.content = [...(doc.content || []), ...newNodes];
                    finalContent = JSON.stringify(doc);
                }
                else {
                    finalContent = renderRichContent(finalPlain);
                }
            }
            else {
                finalContent = finalPlain;
            }
        }
        else {
            finalPlain = contentInput;
            finalContent = noteType === 'rich' ? renderRichContent(contentInput) : contentInput;
        }
    }
    else if (typeChanged) {
        // Type flipped without new content — reproject the existing plain text.
        finalPlain = existing.content_plain || '';
        finalContent = noteType === 'rich' ? renderRichContent(finalPlain) : finalPlain;
    }
    const finalTitle = typeof flags.title === 'string' ? flags.title : existing.title;
    db.prepare(`UPDATE notes SET title = ?, content = ?, content_plain = ?, note_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(finalTitle, finalContent, finalPlain, noteType, id);
    // Refresh FTS — but don't resurrect a trashed note into search results.
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id);
    if (!existing.is_trashed) {
        db.prepare('INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)').run(id, finalTitle, finalPlain || '');
    }
    console.log(JSON.stringify({ updated: true, id, title: finalTitle, note_type: noteType }, null, 2));
}
function cmdCreateList(db, args, flags) {
    const name = flags.name || args[0];
    if (!name) {
        console.error('Usage: noted-cli create-list --name "List Name"');
        process.exit(1);
    }
    // Check if it already exists
    const existing = db.prepare('SELECT id, name FROM lists WHERE LOWER(name) = LOWER(?)').get(name);
    if (existing) {
        console.log(JSON.stringify({ exists: true, id: existing.id, name: existing.name }, null, 2));
        return;
    }
    const id = crypto.randomUUID();
    const color = flags.color || 'gray';
    db.prepare('INSERT INTO lists (id, name, color) VALUES (?, ?, ?)').run(id, name, color);
    console.log(JSON.stringify({ created: true, id, name }, null, 2));
}
function cmdMove(db, args, flags) {
    const noteId = args[0];
    const listRef = flags.list || args[1];
    if (!noteId) {
        console.error('Usage: noted-cli move <note-id> --list "List Name"');
        process.exit(1);
    }
    const note = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(noteId);
    if (!note) {
        console.error(`Note not found: ${noteId}`);
        process.exit(1);
    }
    if (!listRef) {
        // Remove from list
        db.prepare('UPDATE notes SET list_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(noteId);
        console.log(`Removed "${note.title}" from its list`);
        return;
    }
    const listId = resolveListId(db, listRef);
    db.prepare('UPDATE notes SET list_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(listId, noteId);
    console.log(`Moved "${note.title}" to list`);
}
function cmdList(db, flags) {
    const limit = parseLimit(flags.limit, 50);
    const notes = db
        .prepare('SELECT id, title, note_type, is_pinned, created_at, updated_at FROM notes WHERE is_trashed = 0 ORDER BY updated_at DESC LIMIT ?')
        .all(limit);
    if (flags.json) {
        console.log(JSON.stringify(notes, null, 2));
        return;
    }
    if (notes.length === 0) {
        console.log('No notes found.');
        return;
    }
    for (const note of notes) {
        const pin = note.is_pinned ? ' [pinned]' : '';
        console.log(`  ${note.id}  ${note.title}${pin}  (${note.updated_at})`);
    }
    console.log(`\n${notes.length} note(s)`);
}
function cmdGet(db, args, flags) {
    const id = args[0];
    if (!id) {
        console.error('Usage: noted-cli get <note-id>');
        process.exit(1);
    }
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!note) {
        console.error(`Note not found: ${id}`);
        process.exit(1);
    }
    if (flags.json) {
        console.log(JSON.stringify(note, null, 2));
    }
    else {
        console.log(`Title: ${note.title}`);
        console.log(`Type:  ${note.note_type}`);
        console.log(`Date:  ${note.created_at}`);
        console.log(`---`);
        console.log(note.content_plain || '(empty)');
    }
}
function cmdSearch(db, args, flags) {
    const query = args.join(' ') || flags.query;
    if (!query) {
        console.error('Usage: noted-cli search <query>');
        process.exit(1);
    }
    const ftsQuery = query
        .trim()
        .split(/\s+/)
        .map((word) => `"${word}"*`)
        .join(' ');
    const limit = parseLimit(flags.limit, 20);
    const results = db.prepare(`
		SELECT n.id, n.title, snippet(notes_fts, 2, '>>>', '<<<', '...', 40) as snippet
		FROM notes_fts
		JOIN notes n ON n.id = notes_fts.note_id
		WHERE notes_fts MATCH ? AND n.is_trashed = 0
		ORDER BY rank
		LIMIT ?
	`).all(ftsQuery, limit);
    if (flags.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
    }
    if (results.length === 0) {
        console.log('No results found.');
        return;
    }
    for (const r of results) {
        console.log(`  ${r.id}  ${r.title}`);
        if (r.snippet)
            console.log(`    ${r.snippet}`);
    }
    console.log(`\n${results.length} result(s)`);
}
function cmdDelete(db, args) {
    const id = args[0];
    if (!id) {
        console.error('Usage: noted-cli delete <note-id>');
        process.exit(1);
    }
    const note = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(id);
    if (!note) {
        console.error(`Note not found: ${id}`);
        process.exit(1);
    }
    db.prepare('UPDATE notes SET is_trashed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id);
    console.log(`Trashed: ${note.title}`);
}
function cmdLists(db, flags) {
    const lists = db.prepare('SELECT id, name, color FROM lists ORDER BY sort_order').all();
    if (flags.json) {
        console.log(JSON.stringify(lists, null, 2));
        return;
    }
    if (lists.length === 0) {
        console.log('No lists found.');
        return;
    }
    for (const list of lists) {
        console.log(`  ${list.id}  ${list.name}`);
    }
}
function cmdTags(db, flags) {
    const tags = db.prepare('SELECT id, name, color FROM tags ORDER BY name').all();
    if (flags.json) {
        console.log(JSON.stringify(tags, null, 2));
        return;
    }
    if (tags.length === 0) {
        console.log('No tags found.');
        return;
    }
    for (const tag of tags) {
        console.log(`  ${tag.id}  ${tag.name}`);
    }
}
function cmdHelp() {
    console.log(`
noted-cli — Command-line interface for the Noted app

USAGE
  noted-cli <command> [options]

COMMANDS
  create       Create a new note
  update       Update an existing note (also: edit)
  create-list  Create a new list
  move         Move a note to a list
  list         List all notes (also: ls)
  get          Get a note by ID
  search       Search notes (also: find)
  delete       Move a note to trash (also: rm)
  lists        Show all lists
  tags         Show all tags
  help         Show this help message

CREATE OPTIONS
  --title <text>       Note title (default: "Untitled")
  --content <text>     Note content (single line; pipe stdin for multi-line)
  --type <rich|plain>  Note type (default: "rich")
  --list <name|id>     Add to a list (creates the list if it doesn't exist)
  (stdin)              Pipe content from stdin

UPDATE OPTIONS
  noted-cli update <note-id> [options]
  --title <text>       Replace the title ("" clears it)
  --content <text>     Replace the content (bare --content reads stdin; "" clears)
  --append             Append --content/stdin instead of replacing
  --type <rich|plain>  Change the note type
  (The body is only touched with --content or --append, so a title-only update
   is safe in a pipeline and preserves the note's existing rich formatting.)

CREATE-LIST OPTIONS
  --name <text>        List name (required)
  --color <color>      List color (default: "gray")

MOVE OPTIONS
  --list <name|id>     Target list (creates if needed). Omit to remove from list.

LIST / SEARCH OPTIONS
  --limit <n>          Max items (list default: 50, search default: 20)

OUTPUT (--json)
  create / update      Always print JSON: { id, title, ... }
  get --json           Full note as JSON
  list / search /
  lists / tags --json  Print results as a JSON array (best for scripts/agents)

MARKDOWN (rich notes)
  Content is parsed as markdown. Supported: # ## ### headings, **bold**,
  *italic*, ~~strike~~, \`code\`, [links](url), "- " bullet and "1." ordered
  lists, "- [ ]" / "- [x]" task lists, | pipe | tables |, > blockquotes,
  fenced \`\`\` code blocks, and --- rules. Multi-line content must be piped
  via stdin — a literal "\\n" inside --content is NOT turned into a newline.

EXAMPLES
  noted-cli create --title "Meeting Notes" --content "# Agenda" --list "Work"
  printf '# Plan\\n\\n- [ ] ship\\n- [x] design' | noted-cli create --title "Plan"
  cat report.md | noted-cli create --title "Report" --list "Reports"
  noted-cli update abc123 --title "Renamed"
  echo "## Follow-up" | noted-cli update abc123 --append
  noted-cli create-list --name "Projects" --color "indigo"
  noted-cli move abc123 --list "Archive"
  noted-cli list --json
  noted-cli search "roadmap" --json
  noted-cli delete abc123

DATABASE
  ${getDbPath()}
`.trim());
}
// ─── Main ────────────────────────────────────────────────
async function main() {
    const { command, args, flags } = parseArgs(process.argv);
    if (command === 'help' || flags.help) {
        cmdHelp();
        return;
    }
    const stdinContent = await readStdin();
    const db = openDb();
    try {
        switch (command) {
            case 'create':
                cmdCreate(db, args, flags, stdinContent);
                break;
            case 'update':
            case 'edit':
                cmdUpdate(db, args, flags, stdinContent);
                break;
            case 'list':
            case 'ls':
                cmdList(db, flags);
                break;
            case 'get':
                cmdGet(db, args, flags);
                break;
            case 'search':
            case 'find':
                cmdSearch(db, args, flags);
                break;
            case 'delete':
            case 'rm':
                cmdDelete(db, args);
                break;
            case 'create-list':
                cmdCreateList(db, args, flags);
                break;
            case 'move':
                cmdMove(db, args, flags);
                break;
            case 'lists':
                cmdLists(db, flags);
                break;
            case 'tags':
                cmdTags(db, flags);
                break;
            default:
                console.error(`Unknown command: ${command}`);
                console.error('Run "noted-cli help" for usage.');
                process.exit(1);
        }
    }
    finally {
        db.close();
    }
}
main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
