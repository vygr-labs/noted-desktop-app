#include "noted/Database.h"

#include <QDebug>
#include <QDir>
#include <QFileInfo>
#include <QUuid>

#include "noted/Sqlite.h"

namespace noted {

using db::Connection;
using db::Transaction;

Database::Database(const QString& filePath, QObject* parent)
    : QObject(parent)
    , m_path(filePath)
{
    QDir().mkpath(QFileInfo(filePath).absolutePath());
    m_conn = std::make_unique<Connection>(filePath);
    m_conn->exec(QStringLiteral("PRAGMA journal_mode = WAL"));
    m_conn->exec(QStringLiteral("PRAGMA foreign_keys = ON"));
    m_conn->exec(QStringLiteral("PRAGMA synchronous = NORMAL"));
    migrate();

    connect(&m_watch, &QTimer::timeout, this, [this] {
        try {
            const qint64 v = m_conn->scalar(QStringLiteral("PRAGMA data_version")).toLongLong();
            if (m_dataVersion >= 0 && v != m_dataVersion) {
                m_dataVersion = v;
                emit externalChange();
            } else {
                m_dataVersion = v;
            }
        } catch (const db::Error& e) {
            qWarning() << "data_version poll failed:" << e.what();
        }
    });
}

Database::~Database() = default;

QString Database::defaultPath()
{
    QString base;
#if defined(Q_OS_WIN)
    base = qEnvironmentVariable("APPDATA");
    if (base.isEmpty()) base = QDir::homePath() + QStringLiteral("/AppData/Roaming");
#elif defined(Q_OS_MACOS)
    base = QDir::homePath() + QStringLiteral("/Library/Application Support");
#else
    base = qEnvironmentVariable("XDG_CONFIG_HOME");
    if (base.isEmpty()) base = QDir::homePath() + QStringLiteral("/.config");
#endif
    return QDir(base).filePath(QStringLiteral("noted/databases/app.sqlite"));
}

bool Database::snapshot(const QString& source, const QString& dest)
{
    if (QFileInfo::exists(dest) || !QFileInfo::exists(source)) return false;
    QDir().mkpath(QFileInfo(dest).absolutePath());
    try {
        Connection src(source, Connection::Mode::ReadOnly);
        QString escaped = dest;
        escaped.replace(QLatin1Char('\''), QStringLiteral("''"));
        src.exec(QStringLiteral("VACUUM INTO '%1'").arg(escaped));
        return true;
    } catch (const db::Error& e) {
        qWarning() << "snapshot failed:" << e.what();
        return false;
    }
}

QString Database::newId()
{
    return QUuid::createUuid().toString(QUuid::WithoutBraces);
}

int Database::schemaVersion()
{
    const bool hasTable = m_conn->scalar(QStringLiteral(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")).isValid();
    if (!hasTable) return 0;
    return m_conn->scalar(QStringLiteral("SELECT MAX(version) FROM schema_version")).toInt();
}

void Database::startWatching(int intervalMs)
{
    m_dataVersion = m_conn->scalar(QStringLiteral("PRAGMA data_version")).toLongLong();
    m_watch.start(intervalMs);
}

// The very first builds stored notes with an INTEGER AUTOINCREMENT id. That
// table blocks migration 1, so it is rebuilt (as plain-text notes) first.
void Database::migrateLegacyNotesTable()
{
    Connection& c = *m_conn;
    const QString sql = c.scalar(QStringLiteral(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='notes'")).toString();
    if (!sql.contains(QStringLiteral("INTEGER PRIMARY KEY AUTOINCREMENT"))) return;

    const QVariantList rows = c.all(QStringLiteral("SELECT * FROM notes"));
    Transaction tx(c);
    c.exec(QStringLiteral("DROP TABLE notes"));
    c.exec(QStringLiteral(R"(
        CREATE TABLE notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled',
            content TEXT,
            content_plain TEXT,
            note_type TEXT DEFAULT 'rich' CHECK(note_type IN ('rich', 'plain')),
            list_id TEXT,
            is_daily INTEGER DEFAULT 0,
            daily_date TEXT,
            is_pinned INTEGER DEFAULT 0,
            is_trashed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ))"));
    for (const QVariant& r : rows) {
        const QVariantMap m = r.toMap();
        c.run(QStringLiteral("INSERT INTO notes (id, title, content, content_plain, note_type, created_at, updated_at) "
                             "VALUES (?, ?, ?, ?, 'plain', ?, ?)"),
              {newId(), m.value("title"), m.value("content"), m.value("content"), m.value("created_at"),
               m.value("updated_at")});
    }
    tx.commit();
}

void Database::migrate()
{
    migrateLegacyNotesTable();

    Connection& c = *m_conn;
    const int current = schemaVersion();
    if (current >= kSchemaVersion) return;

    auto addColumn = [&c](const QString& table, const QString& column, const QString& decl) {
        if (!c.hasColumn(table, column))
            c.exec(QStringLiteral("ALTER TABLE %1 ADD COLUMN %2 %3").arg(table, column, decl));
    };
    auto step = [&](int version, const std::function<void()>& body) {
        if (current >= version) return;
        Transaction tx(c);
        body();
        c.run(QStringLiteral("INSERT INTO schema_version (version) VALUES (?)"), {version});
        tx.commit();
        qInfo() << "schema migrated to" << version;
    };

    step(1, [&] {
        c.exec(QStringLiteral(R"(
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
        )"));
    });

    step(2, [&] {
        c.exec(QStringLiteral(
            "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(note_id UNINDEXED, title, content_plain)"));
        c.exec(QStringLiteral("INSERT INTO notes_fts (note_id, title, content_plain) "
                              "SELECT id, title, COALESCE(content_plain, '') FROM notes"));
    });

    step(3, [&] {
        c.exec(QStringLiteral(R"(
            CREATE TABLE IF NOT EXISTS todo_lists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT DEFAULT 'gray',
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        )"));
        addColumn("todos", "todo_list_id", "TEXT REFERENCES todo_lists(id) ON DELETE SET NULL");
        c.exec(QStringLiteral("CREATE INDEX IF NOT EXISTS idx_todos_list ON todos(todo_list_id)"));
    });

    step(4, [&] { addColumn("notes", "spellcheck", "INTEGER DEFAULT 1"); });

    step(5, [&] {
        addColumn("notes", "sync_id", "TEXT");
        addColumn("notes", "is_shared", "INTEGER DEFAULT 0");
    });

    step(6, [&] { addColumn("notes", "is_locked", "INTEGER DEFAULT 0"); });

    step(7, [&] { addColumn("notes", "sync_secret", "TEXT"); });

    step(8, [&] {
        addColumn("lists", "sync_id", "TEXT");
        addColumn("lists", "sync_secret", "TEXT");
        addColumn("lists", "is_shared", "INTEGER DEFAULT 0");
        c.exec(QStringLiteral(R"(
            CREATE TABLE IF NOT EXISTS yjs_state (
                doc_name TEXT PRIMARY KEY,
                state BLOB NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        )"));
    });

    step(9, [&] { addColumn("todos", "description", "TEXT"); });

    step(10, [&] {
        addColumn("todo_lists", "sync_id", "TEXT");
        addColumn("todo_lists", "sync_secret", "TEXT");
        addColumn("todo_lists", "is_shared", "INTEGER DEFAULT 0");
    });

    step(11, [&] {
        for (const char* t : {"notes", "lists", "todo_lists"}) addColumn(t, "is_owner", "INTEGER DEFAULT 1");
    });

    step(12, [&] { addColumn("lists", "is_hidden", "INTEGER DEFAULT 0"); });
}

}  // namespace noted
