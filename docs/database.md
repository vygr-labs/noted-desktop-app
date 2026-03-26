# Database Schema

SQLite database with WAL mode and foreign keys enabled. Migrations run automatically on startup.

**Current schema version:** 7

## Tables

### notes
The primary table. Stores all note content and metadata.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | UUID | Unique identifier |
| `title` | TEXT | `'Untitled'` | Note title |
| `content` | TEXT | null | TipTap JSON (rich) or raw text (plain) |
| `content_plain` | TEXT | null | Plain text extraction (for FTS and previews) |
| `note_type` | TEXT | `'rich'` | `'rich'` or `'plain'` |
| `list_id` | TEXT FK | null | References `lists.id` |
| `is_daily` | INTEGER | 0 | Whether this is a daily note |
| `daily_date` | TEXT | null | `YYYY-MM-DD` for daily notes |
| `is_pinned` | INTEGER | 0 | Pinned to top |
| `is_trashed` | INTEGER | 0 | Soft-deleted |
| `spellcheck` | INTEGER | 1 | Spellcheck enabled |
| `sync_id` | TEXT | null | Yjs document ID for collaboration |
| `sync_secret` | TEXT | null | Per-document access token |
| `is_shared` | INTEGER | 0 | Whether the note is shared |
| `is_locked` | INTEGER | 0 | Whether the note is PIN-locked |
| `created_at` | DATETIME | CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | CURRENT_TIMESTAMP | |

### lists
Custom note lists/folders.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | UUID | |
| `name` | TEXT | | List name |
| `icon` | TEXT | `'folder'` | Icon identifier |
| `color` | TEXT | `'gray'` | Color name |
| `sort_order` | INTEGER | 0 | Display order |
| `created_at` | DATETIME | CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | CURRENT_TIMESTAMP | |

### tags
Note tags for organization.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | UUID | |
| `name` | TEXT UNIQUE | | Tag name |
| `color` | TEXT | `'gray'` | Color name |
| `created_at` | DATETIME | CURRENT_TIMESTAMP | |

### note_tags
Many-to-many junction for notes and tags.

| Column | Type | Description |
|--------|------|-------------|
| `note_id` | TEXT FK | References `notes.id` (CASCADE) |
| `tag_id` | TEXT FK | References `tags.id` (CASCADE) |

### todos
Task items, optionally linked to notes or todo lists.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | UUID | |
| `note_id` | TEXT FK | null | References `notes.id` (CASCADE) |
| `todo_list_id` | TEXT FK | null | References `todo_lists.id` (SET NULL) |
| `text` | TEXT | | Todo content |
| `is_completed` | INTEGER | 0 | |
| `due_date` | TEXT | null | `YYYY-MM-DD` |
| `source_daily_date` | TEXT | null | For rollover tracking |
| `sort_order` | INTEGER | 0 | |
| `created_at` | DATETIME | CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | CURRENT_TIMESTAMP | |

### todo_lists
Dedicated todo list collections.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | UUID | |
| `name` | TEXT | | List name |
| `color` | TEXT | `'gray'` | |
| `sort_order` | INTEGER | 0 | |
| `created_at` | DATETIME | CURRENT_TIMESTAMP | |

### notes_fts
FTS5 virtual table for full-text search.

| Column | Type | Description |
|--------|------|-------------|
| `note_id` | TEXT (UNINDEXED) | References `notes.id` |
| `title` | TEXT | Indexed title |
| `content_plain` | TEXT | Indexed plain text content |

### settings
Key-value store for app settings.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PK | Setting name |
| `value` | TEXT | Setting value |

### schema_version
Tracks applied migrations.

| Column | Type | Description |
|--------|------|-------------|
| `version` | INTEGER PK | Migration version number |
| `applied_at` | DATETIME | When the migration ran |

## Migration History

| Version | Changes |
|---------|---------|
| 1 | Initial schema (notes, lists, tags, note_tags, todos, settings, indexes) |
| 2 | FTS5 virtual table (`notes_fts`) |
| 3 | Todo lists (`todo_lists` table, `todo_list_id` column on todos) |
| 4 | Spellcheck toggle (`spellcheck` column on notes) |
| 5 | Collaboration (`sync_id`, `is_shared` columns on notes) |
| 6 | Note locking (`is_locked` column on notes) |
| 7 | Sync secrets (`sync_secret` column on notes) |
