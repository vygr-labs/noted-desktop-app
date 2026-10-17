#pragma once

// The database half of sync: noticing what changed here, and taking in what
// changed elsewhere.
//
// Triggers mark every row that's written (by the app, noted-cli, anything) in
// sync_dirty. capture() turns those marks into journal entries, stamping each
// changed field with a hybrid logical clock, and keeps sync_state: the last
// value and clock of every field, which is what local edits are measured
// against and remote ones are judged by. A field takes the value with the
// newest clock. Note bodies are the exception: they carry a version hash and
// its parents, so an edit made on top of what we have simply replaces it, and
// two edits made side by side are merged block by block (Merge.h) from their
// common version.
//
// A "space" is one sync folder: the whole library, or one shared list.
// outgoing() gathers the journal entries a space hasn't published yet into
// records; apply() takes records read from a space's folder.

#include <QHash>
#include <QJsonArray>
#include <QJsonObject>
#include <QSet>
#include <QString>
#include <QStringList>

#include <functional>

namespace noted {
class Database;
}

namespace noted::sync {

struct Space
{
    QString id;
    QString kind;     // "library" | "list"
    QString root;     // the folder
    QByteArray key;
    QString listId;   // kind == "list"
    QString name;
    qint64 published = 0;  // last journal seq written out
    qint64 fileSeq = 0;    // last file number written
    QHash<QString, qint64> cursors;  // device -> last file read
    qint64 snapSeq = 0;    // our last snapshot covers our files up to here
    qint64 snapAt = 0;     // when we wrote it (seconds)
};

class Clock
{
public:
    void setDevice(const QString& device) { m_device = device; }
    QString next();
    QString at(qint64 ms) const;  // a clock for something last changed at `ms`
    void observe(const QString& hlc);

private:
    QString m_device;
    qint64 m_ms = 0;
    int m_counter = 0;
};

class Ledger
{
public:
    using PlainFn = std::function<QString(const QString& content, bool plain)>;
    Ledger(Database& db, PlainFn plainOf);

    void install();     // tables and triggers (idempotent)
    void uninstall();   // drops the triggers; the tables stay
    bool installed();

    QString deviceId();
    QString deviceName();
    Clock& clock() { return m_clock; }

    QList<Space> spaces();
    void saveSpace(const Space& s);
    void removeSpace(const QString& id);

    // Journals what changed since the last capture. Returns the entries made.
    // `seeding`: rows met for the first time are dated by when they were last
    // edited (their updated_at), not now, so a computer joining with an old
    // copy of the notes doesn't overrule newer edits made elsewhere.
    int capture(bool seeding = false);
    // Journals every row a new space should start with.
    void seed(const Space& s);

    struct Outgoing
    {
        QJsonArray records;
        qint64 upTo = 0;
        QStringList attachments;          // attachment file names the records use
        QHash<QString, QString> heads;    // note -> body version now in the folder
        QList<QPair<QString, QString>> joined, left;  // (entity, id) entering / leaving the space
        bool empty() const { return records.isEmpty(); }
    };
    Outgoing outgoing(const Space& s, qint64 maxBytes = 4 << 20);
    // The records are safely in the folder: remember that.
    void published(Space& s, const Outgoing& out);

    struct Incoming
    {
        QString device;
        QJsonObject record;
    };
    struct Applied
    {
        int records = 0;
        QSet<QString> notes;
        bool lists = false, tags = false, todos = false, settings = false;
        QStringList attachments;
        bool any() const { return records > 0; }
    };
    // `ownDevices`: devices of this computer's library. They also hear about
    // a note leaving a shared list through the library, so their "leave"
    // isn't taken as one.
    Applied apply(const Space& s, QList<Incoming> records, const QSet<QString>& ownDevices);

    // Everything the space holds as of now, as full records (and the
    // library's deletions), for a computer starting from scratch.
    QJsonArray snapshot(const Space& s);
    // Image files the space's notes use.
    QSet<QString> attachmentsUsed(const Space& s);

    void prune();

private:
    struct State
    {
        bool exists = false;
        bool deleted = false;
        QString delClock;
        QJsonObject data, clocks;
    };
    State state(const QString& e, const QString& id);
    void writeState(const QString& e, const QString& id, const State& st);
    QJsonObject readRow(const QString& e, const QString& id);
    QString contentOf(const QString& noteId, const QString& hash);
    void storeVersion(const QString& noteId, const QString& hash, const QStringList& parents, const QString& content);
    QStringList parentsOf(const QString& noteId, const QString& hash);
    QString commonBase(const QString& noteId, const QString& a, const QStringList& bParents);
    bool isAncestor(const QString& noteId, const QString& older, const QString& newer);
    bool memberOf(const Space& s, const QString& e, const QString& id, const QJsonObject& data);
    // `out` null: for a snapshot (whole bodies, nothing remembered).
    QJsonObject record(const Space& s, const QString& e, const QString& id, const State& st, const QSet<QString>& fields,
                       Outgoing* out);
    void journal(const QString& e, const QString& id, const QStringList& fields, const QString& hlc, bool del,
                 const QString& origin, const QString& only = {});
    void markDirty(const QString& e, const QString& id);
    void writeRow(const QString& e, const QString& id, const QJsonObject& values, bool insert);
    void deleteRow(const QString& e, const QString& id);
    void setAlias(const QString& e, const QString& from, const QString& to);
    bool resolveTagName(const QString& id, const QString& name, Applied& out);
    void resolveDaily(const QString& id, Applied& out);
    void retryUnresolved(Applied& out);
    void refreshSearch(const QString& noteId);
    QString alias(const QString& e, const QString& id);

    Database& m_db;
    PlainFn m_plainOf;
    Clock m_clock;
};

QString contentHash(const QString& content);

}  // namespace noted::sync
