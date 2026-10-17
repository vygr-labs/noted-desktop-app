#pragma once

// Updates from GitHub Releases, with no code-signing certificate: each
// release carries noted-update.json (version, installer file, size, SHA-256)
// signed with the project's key (core/tools/release_tool.cpp), and the app
// takes an installer only when that signature checks out against the public
// key built in here and the download matches the manifest.
//
// It checks a minute after launch and every six hours (Settings > About can
// turn that off), downloads in the background, and says so. "Restart to
// update" runs the installer silently and opens noted again after.

#include <QFile>
#include <QNetworkAccessManager>
#include <QObject>
#include <QPointer>
#include <QTimer>

#include <memory>

namespace noted {
class NoteStore;
}
class QNetworkReply;

class Updater : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString state READ state NOTIFY changed)  // idle checking downloading ready current failed
    Q_PROPERTY(QString version READ version CONSTANT)
    Q_PROPERTY(QString latest READ latest NOTIFY changed)
    Q_PROPERTY(QString notes READ notes NOTIFY changed)
    Q_PROPERTY(double progress READ progress NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
    Q_PROPERTY(bool automatic READ automatic WRITE setAutomatic NOTIFY changed)
    Q_PROPERTY(bool supported READ supported CONSTANT)  // false in a dev build

public:
    Updater(noted::NoteStore& store, bool devBuild, QObject* parent = nullptr);
    ~Updater() override;

    QString state() const { return m_state; }
    QString version() const;
    QString latest() const { return m_latest; }
    QString notes() const { return m_notes; }
    double progress() const { return m_progress; }
    QString error() const { return m_error; }
    bool automatic() const { return m_automatic; }
    void setAutomatic(bool on);
    bool supported() const { return m_supported; }

    Q_INVOKABLE void check();
    // Runs the downloaded installer silently; noted should quit right after.
    Q_INVOKABLE bool install();

    // a newer than b ("2.0.10" > "2.0.9")
    static bool newer(const QString& a, const QString& b);

signals:
    void changed();

private:
    void set(const QString& state, const QString& error = {});
    void gotManifest(QNetworkReply* reply);
    void download(const QUrl& url);
    QString updatesDir() const;

    noted::NoteStore& m_store;
    QNetworkAccessManager m_net;
    QTimer m_timer;
    QString m_state = QStringLiteral("idle");
    QString m_latest, m_notes, m_error;
    double m_progress = 0;
    bool m_automatic = true;
    bool m_supported = true;
    QString m_feed;
    QString m_file, m_sha256;
    qint64 m_size = 0;
    QString m_installer;  // a verified installer, ready to run
    QPointer<QNetworkReply> m_reply;
    std::unique_ptr<QFile> m_part;
};
