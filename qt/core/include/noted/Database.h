#pragma once

// Owns noted's SQLite database: path resolution, schema migrations and
// external-change detection.
//
// The schema is shared with the Electron build and with noted-cli, so the
// migration ladder below mirrors app/src/backend/database/db.ts version for
// version. Never renumber or edit an applied step; append new ones.

#include <QObject>
#include <QString>
#include <QTimer>

#include <memory>

namespace noted::db {
class Connection;
}

namespace noted {

class Database : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString path READ path CONSTANT)

public:
    // Latest schema version this build knows how to create.
    static constexpr int kSchemaVersion = 12;

    explicit Database(const QString& filePath, QObject* parent = nullptr);
    ~Database() override;

    // The real per-user location shared with the Electron app and noted-cli:
    //   Windows  %APPDATA%/noted/databases/app.sqlite
    //   macOS    ~/Library/Application Support/noted/databases/app.sqlite
    //   Linux    $XDG_CONFIG_HOME/noted/databases/app.sqlite (~/.config)
    static QString defaultPath();

    // Copies `source` to `dest` as a consistent snapshot (VACUUM INTO), so a
    // dev build can work on real data without ever writing to it. No-op when
    // `dest` already exists or `source` does not.
    static bool snapshot(const QString& source, const QString& dest);

    static QString newId();

    db::Connection& conn() { return *m_conn; }
    QString path() const { return m_path; }
    int schemaVersion();

    // Starts polling PRAGMA data_version. It only changes when ANOTHER
    // connection commits (noted-cli, a second app instance), never for our
    // own writes, so externalChange() has no false positives.
    void startWatching(int intervalMs = 1000);

signals:
    void externalChange();

private:
    void migrate();
    void migrateLegacyNotesTable();

    QString m_path;
    std::unique_ptr<db::Connection> m_conn;
    QTimer m_watch;
    qint64 m_dataVersion = -1;
};

}  // namespace noted
