#pragma once

// Sync through a folder: OneDrive, Dropbox, Google Drive, Syncthing, a network
// share. No server of ours; whatever already copies that folder between
// computers carries the changes.
//
// The folder holds one subfolder per computer (devices/<id>), and only that
// computer writes in it: numbered change files, never edited after they're
// written, so a cloud drive never has two versions of one file to fight
// over. Every computer reads everyone else's. All of it is encrypted: with a
// key from the passphrase for the library, with a random key (the share code)
// for a shared list.
//
//   noted-sync.json         what this folder is, and a check value for the key
//   devices/<id>/00000001.nchg …   changes, in order
//   devices/<id>/device.nmeta      that computer's name and how far it has read
//   attachments/<file>             images notes use
//
// The library syncs everything between your own computers. A shared list is
// its own folder you share with other people through your cloud drive; its
// notes travel through both.

#include <QDateTime>
#include <QFutureWatcher>
#include <QObject>
#include <QSet>
#include <QTimer>
#include <QVariant>

#include <memory>

#include "noted/sync/Ledger.h"

namespace noted {

class Database;
class NoteStore;

class SyncEngine : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool enabled READ enabled NOTIFY changed)
    Q_PROPERTY(QString folder READ folder NOTIFY changed)
    Q_PROPERTY(QString status READ status NOTIFY changed)        // off | idle | syncing | error | unreachable
    Q_PROPERTY(QString error READ error NOTIFY changed)
    Q_PROPERTY(QDateTime lastSynced READ lastSynced NOTIFY changed)
    Q_PROPERTY(QVariantList devices READ devices NOTIFY changed)
    Q_PROPERTY(QVariantList sharedLists READ sharedLists NOTIFY changed)
    Q_PROPERTY(bool busy READ busy NOTIFY changed)

public:
    SyncEngine(Database& db, NoteStore& store, QObject* parent = nullptr);
    ~SyncEngine() override;

    bool enabled() const;
    QString folder() const;
    QString status() const { return m_status; }
    QString error() const { return m_error; }
    QDateTime lastSynced() const { return m_lastSynced; }
    QVariantList devices() const { return m_devices; }
    QVariantList sharedLists() const;
    bool busy() const { return m_busy; }

    // What a chosen folder is: { kind: "" | "library" | "list", root, name }.
    Q_INVOKABLE QVariantMap inspect(const QString& folder) const;

    // Starts syncing the library through `folder`: joins the library there,
    // or makes one. Finishes with setupFinished().
    Q_INVOKABLE void setUp(const QString& folder, const QString& passphrase);
    Q_INVOKABLE void turnOff();
    Q_INVOKABLE void syncNow();

    // Shares a list through a new folder inside `folder`. Returns the share
    // code to send, or "" (see error).
    Q_INVOKABLE QString shareList(const QString& listId, const QString& folder);
    Q_INVOKABLE bool joinList(const QString& folder, const QString& code);
    Q_INVOKABLE void stopSharing(const QString& listId);
    Q_INVOKABLE QString codeFor(const QString& listId) const;
    Q_INVOKABLE bool isShared(const QString& listId) const;

    // For tests: one full round, synchronously.
    void runOnce();

signals:
    void changed();
    void setupFinished(bool ok, const QString& message);
    // About to write changes from elsewhere: save anything still in an editor.
    void aboutToApply();

private:
    struct Pulled
    {
        QString space;
        QList<sync::Ledger::Incoming> records;
        QHash<QString, qint64> cursors;
        QHash<QString, QString> names;  // device -> computer name
        QHash<QString, QDateTime> seen;
        bool reachable = true;
    };
    static QList<Pulled> read(const QList<sync::Space>& spaces, const QString& me);

    void schedule();
    void pull();
    void finishPull(const QList<Pulled>& pulled);
    void publish();
    void writeMeta(const sync::Space& s);
    void fetchAttachments(const QStringList& names);
    void ensureTriggers();
    void markSharedLists();
    void setStatus(const QString& s, const QString& error = {});
    QString localPath(const QString& folder) const;
    sync::Space* library();

    Database& m_db;
    NoteStore& m_store;
    std::unique_ptr<sync::Ledger> m_ledger;
    QList<sync::Space> m_spaces;
    QString m_me;
    QString m_status = QStringLiteral("off");
    QString m_error;
    QDateTime m_lastSynced;
    QVariantList m_devices;
    bool m_busy = false;
    bool m_pulling = false;
    QTimer m_debounce, m_poll;
    qint64 m_firstPending = 0;
    QSet<QString> m_missingAttachments;
    qint64 m_metaAt = 0;
    QFutureWatcher<QList<Pulled>> m_reader;
};

}  // namespace noted
