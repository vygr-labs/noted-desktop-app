#include "noted/Sqlite.h"

#include <utility>

#include "sqlite3.h"

namespace noted::db {

namespace {

[[noreturn]] void fail(sqlite3* db, int rc, const QString& what)
{
    const QString msg = QString::fromUtf8(db ? sqlite3_errmsg(db) : sqlite3_errstr(rc));
    throw Error(QStringLiteral("%1: %2 (%3)").arg(what, msg).arg(rc), rc);
}

QVariantMap rowToMap(const Statement& s)
{
    QVariantMap m;
    const int n = s.columnCount();
    for (int i = 0; i < n; ++i) m.insert(s.columnName(i), s.value(i));
    return m;
}

// Runs `body` against a cached statement and guarantees reset() afterwards,
// even when a step throws — a statement left mid-row pins a WAL snapshot.
template <typename F>
auto withStatement(Connection& c, const QString& sql, const QVariantList& args, F&& body)
{
    Statement& s = c.cached(sql);
    s.reset();
    s.bindAll(args);
    struct Guard {
        Statement& s;
        ~Guard() { s.reset(); }
    } guard{s};
    return body(s);
}

}  // namespace

// ── Statement ────────────────────────────────────────────────────────────

Statement::Statement(sqlite3_stmt* s, sqlite3* owner)
    : m_stmt(s)
    , m_owner(owner)
{}

Statement::~Statement()
{
    if (m_stmt) sqlite3_finalize(m_stmt);
}

Statement::Statement(Statement&& o) noexcept
    : m_stmt(std::exchange(o.m_stmt, nullptr))
    , m_owner(o.m_owner)
{}

Statement& Statement::operator=(Statement&& o) noexcept
{
    if (this != &o) {
        if (m_stmt) sqlite3_finalize(m_stmt);
        m_stmt = std::exchange(o.m_stmt, nullptr);
        m_owner = o.m_owner;
    }
    return *this;
}

Statement& Statement::bind(int idx, const QVariant& v)
{
    int rc = SQLITE_OK;
    if (!v.isValid() || v.isNull()) {
        rc = sqlite3_bind_null(m_stmt, idx);
    } else {
        switch (v.typeId()) {
        case QMetaType::Bool:
        case QMetaType::Int:
        case QMetaType::UInt:
        case QMetaType::LongLong:
        case QMetaType::ULongLong:
            rc = sqlite3_bind_int64(m_stmt, idx, v.toLongLong());
            break;
        case QMetaType::Double:
            rc = sqlite3_bind_double(m_stmt, idx, v.toDouble());
            break;
        case QMetaType::QByteArray: {
            const QByteArray b = v.toByteArray();
            rc = sqlite3_bind_blob64(m_stmt, idx, b.constData(), sqlite3_uint64(b.size()), SQLITE_TRANSIENT);
            break;
        }
        default: {
            const QByteArray u = v.toString().toUtf8();
            rc = sqlite3_bind_text64(m_stmt, idx, u.constData(), sqlite3_uint64(u.size()), SQLITE_TRANSIENT,
                                     SQLITE_UTF8);
            break;
        }
        }
    }
    if (rc != SQLITE_OK) fail(m_owner, rc, QStringLiteral("bind %1").arg(idx));
    return *this;
}

Statement& Statement::bindAll(const QVariantList& values)
{
    for (int i = 0; i < values.size(); ++i) bind(i + 1, values.at(i));
    return *this;
}

bool Statement::step()
{
    const int rc = sqlite3_step(m_stmt);
    if (rc == SQLITE_ROW) return true;
    if (rc == SQLITE_DONE) return false;
    const QString sql = QString::fromUtf8(sqlite3_sql(m_stmt));
    sqlite3_reset(m_stmt);
    fail(m_owner, rc, QStringLiteral("step [%1]").arg(sql.left(120)));
}

void Statement::reset()
{
    if (!m_stmt) return;
    sqlite3_reset(m_stmt);
    sqlite3_clear_bindings(m_stmt);
}

int Statement::columnCount() const { return sqlite3_column_count(m_stmt); }
QString Statement::columnName(int i) const { return QString::fromUtf8(sqlite3_column_name(m_stmt, i)); }
bool Statement::isNull(int i) const { return sqlite3_column_type(m_stmt, i) == SQLITE_NULL; }
qint64 Statement::int64(int i) const { return sqlite3_column_int64(m_stmt, i); }

QString Statement::text(int i) const
{
    const auto* p = reinterpret_cast<const char*>(sqlite3_column_text(m_stmt, i));
    const int n = sqlite3_column_bytes(m_stmt, i);
    return p ? QString::fromUtf8(p, n) : QString();
}

QByteArray Statement::blob(int i) const
{
    const auto* p = static_cast<const char*>(sqlite3_column_blob(m_stmt, i));
    const int n = sqlite3_column_bytes(m_stmt, i);
    return p ? QByteArray(p, n) : QByteArray();
}

QVariant Statement::value(int i) const
{
    switch (sqlite3_column_type(m_stmt, i)) {
    case SQLITE_INTEGER: return QVariant::fromValue<qint64>(int64(i));
    case SQLITE_FLOAT:   return sqlite3_column_double(m_stmt, i);
    case SQLITE_BLOB:    return blob(i);
    case SQLITE_NULL:    return QVariant();
    default:             return text(i);
    }
}

// ── Connection ───────────────────────────────────────────────────────────

Connection::Connection(const QString& path, Mode mode)
    : m_path(path)
{
    const int flags = mode == Mode::ReadOnly ? SQLITE_OPEN_READONLY
                                             : (SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE);
    const int rc = sqlite3_open_v2(path.toUtf8().constData(), &m_db, flags | SQLITE_OPEN_NOMUTEX, nullptr);
    if (rc != SQLITE_OK) {
        const QString msg = QString::fromUtf8(m_db ? sqlite3_errmsg(m_db) : sqlite3_errstr(rc));
        if (m_db) sqlite3_close(m_db);
        m_db = nullptr;
        throw Error(QStringLiteral("open %1: %2").arg(path, msg), rc);
    }
    sqlite3_extended_result_codes(m_db, 1);
    // noted-cli (a separate process) writes the same file; wait rather than
    // fail when it briefly holds the writer lock.
    sqlite3_busy_timeout(m_db, 3000);
}

Connection::~Connection()
{
    m_cache.clear();  // finalize statements before closing
    if (m_db) sqlite3_close_v2(m_db);
}

void Connection::exec(const QString& sql)
{
    char* err = nullptr;
    const int rc = sqlite3_exec(m_db, sql.toUtf8().constData(), nullptr, nullptr, &err);
    if (rc != SQLITE_OK) {
        const QString msg = QString::fromUtf8(err ? err : "");
        sqlite3_free(err);
        throw Error(QStringLiteral("exec: %1 [%2]").arg(msg, sql.left(160)), rc);
    }
}

Statement& Connection::cached(const QString& sql)
{
    auto it = m_cache.find(sql);
    if (it != m_cache.end()) return **it;
    sqlite3_stmt* s = nullptr;
    const QByteArray u = sql.toUtf8();
    const int rc = sqlite3_prepare_v3(m_db, u.constData(), int(u.size()), SQLITE_PREPARE_PERSISTENT, &s, nullptr);
    if (rc != SQLITE_OK) fail(m_db, rc, QStringLiteral("prepare [%1]").arg(sql.left(160)));
    auto st = std::make_shared<Statement>(s, m_db);
    m_cache.insert(sql, st);
    return *st;
}

int Connection::run(const QString& sql, const QVariantList& args)
{
    withStatement(*this, sql, args, [](Statement& s) {
        while (s.step()) {}
        return 0;
    });
    return changes();
}

QVariantMap Connection::one(const QString& sql, const QVariantList& args)
{
    return withStatement(*this, sql, args, [](Statement& s) {
        return s.step() ? rowToMap(s) : QVariantMap();
    });
}

QVariantList Connection::all(const QString& sql, const QVariantList& args)
{
    return withStatement(*this, sql, args, [](Statement& s) {
        QVariantList out;
        while (s.step()) out.append(rowToMap(s));
        return out;
    });
}

QVariant Connection::scalar(const QString& sql, const QVariantList& args)
{
    return withStatement(*this, sql, args, [](Statement& s) {
        return s.step() ? s.value(0) : QVariant();
    });
}

bool Connection::hasColumn(const QString& table, const QString& column)
{
    const QVariantList cols = all(QStringLiteral("PRAGMA table_info(%1)").arg(table));
    for (const QVariant& c : cols)
        if (c.toMap().value(QStringLiteral("name")).toString() == column) return true;
    return false;
}

int Connection::changes() const { return sqlite3_changes(m_db); }

// ── Transaction ──────────────────────────────────────────────────────────

Transaction::Transaction(Connection& c)
    : m_c(c)
{
    m_c.exec(QStringLiteral("BEGIN IMMEDIATE"));
}

Transaction::~Transaction()
{
    if (m_done) return;
    try {
        m_c.exec(QStringLiteral("ROLLBACK"));
    } catch (...) {
    }
}

void Transaction::commit()
{
    if (m_done) return;
    m_c.exec(QStringLiteral("COMMIT"));
    m_done = true;
}

}  // namespace noted::db
