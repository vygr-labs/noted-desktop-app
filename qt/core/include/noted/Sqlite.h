#pragma once

// Thin RAII layer over the SQLite amalgamation.
//
// noted keeps ONE read/write connection on the GUI thread (the workload is a
// few hundred small rows; queries take well under a millisecond) plus
// short-lived read-only connections for background work. Statements are cached
// per SQL string, so hot paths like autosave never re-prepare.

#include <QByteArray>
#include <QHash>
#include <QString>
#include <QVariant>

#include <memory>
#include <stdexcept>

struct sqlite3;
struct sqlite3_stmt;

namespace noted::db {

class Error : public std::runtime_error
{
public:
    explicit Error(const QString& msg, int code = 0)
        : std::runtime_error(msg.toStdString())
        , m_code(code)
    {}
    int code() const noexcept { return m_code; }

private:
    int m_code;
};

class Statement
{
public:
    Statement() = default;
    Statement(sqlite3_stmt* s, sqlite3* owner);
    ~Statement();
    Statement(const Statement&) = delete;
    Statement& operator=(const Statement&) = delete;
    Statement(Statement&& o) noexcept;
    Statement& operator=(Statement&& o) noexcept;

    // 1-indexed binds. An invalid/null QVariant binds SQL NULL.
    Statement& bind(int idx, const QVariant& v);
    Statement& bindAll(const QVariantList& values);

    bool step();   // true = row available
    void reset();  // reset + clear bindings. Always call after single-row reads (WAL snapshot pinning).

    int        columnCount() const;
    QString    columnName(int i) const;
    bool       isNull(int i) const;
    qint64     int64(int i) const;
    QString    text(int i) const;
    QByteArray blob(int i) const;
    QVariant   value(int i) const;  // typed by the column's storage class

private:
    sqlite3_stmt* m_stmt = nullptr;
    sqlite3*      m_owner = nullptr;
};

class Connection
{
public:
    enum class Mode { ReadWrite, ReadOnly };

    explicit Connection(const QString& path, Mode mode = Mode::ReadWrite);
    ~Connection();
    Connection(const Connection&) = delete;
    Connection& operator=(const Connection&) = delete;

    void exec(const QString& sql);

    // Cached prepared statement, valid for the connection's lifetime.
    Statement& cached(const QString& sql);

    int          run(const QString& sql, const QVariantList& args = {});  // returns changes()
    QVariantMap  one(const QString& sql, const QVariantList& args = {});  // empty map if no row
    QVariantList all(const QString& sql, const QVariantList& args = {});  // list of QVariantMap
    QVariant     scalar(const QString& sql, const QVariantList& args = {});

    bool hasColumn(const QString& table, const QString& column);
    int  changes() const;
    const QString& path() const { return m_path; }

private:
    sqlite3* m_db = nullptr;
    QString  m_path;
    QHash<QString, std::shared_ptr<Statement>> m_cache;
};

class Transaction
{
public:
    explicit Transaction(Connection& c);
    ~Transaction();
    void commit();

private:
    Connection& m_c;
    bool m_done = false;
};

}  // namespace noted::db
