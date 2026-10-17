#pragma once

// App-level services for QML (the `App` singleton): export, copying files into notes,
// opening links, the global quick-capture hotkey, and single-instance
// hand-off (a second launch — e.g. "Open with noted" — forwards its files to
// the running window and exits).

#include <QObject>
#include <QQmlEngine>
#include <QStringList>

class QLocalServer;

namespace noted {
class NoteStore;
}

class AppController : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString version READ version CONSTANT)
    Q_PROPERTY(QString dataPath READ dataPath CONSTANT)
    Q_PROPERTY(bool devData READ devData CONSTANT)
    Q_PROPERTY(bool hotkeyRegistered READ hotkeyRegistered NOTIFY hotkeyChanged)

public:
    AppController(noted::NoteStore& store, QString dataPath, bool devData, QObject* parent = nullptr);
    ~AppController() override;

    QString version() const;
    QString dataPath() const { return m_dataPath; }
    bool devData() const { return m_devData; }
    bool hotkeyRegistered() const { return m_hotkey; }

    // Becomes the primary instance, or forwards `files` to it and returns false.
    bool claimSingleInstance(const QStringList& files);

    Q_INVOKABLE void openExternal(const QString& url);
    Q_INVOKABLE void revealFile(const QString& path);
    // A file (path or file:// URL) the editor can show as an image.
    Q_INVOKABLE bool isImageFile(const QString& pathOrUrl) const;

    // format: pdf | doc | html | md | txt. Returns an error string or "".
    Q_INVOKABLE QString exportNote(const QString& noteId, const QString& format, const QUrl& target);
    // format: json | sql | zip
    Q_INVOKABLE QString exportAll(const QString& format, const QUrl& target);
    // Puts the note on the clipboard as Markdown (its title as a # heading).
    // Locked notes are refused.
    Q_INVOKABLE bool copyAsMarkdown(const QString& noteId);
    Q_INVOKABLE QString suggestedFileName(const QString& noteId, const QString& format);

    // Copies a .md/.markdown/.txt file into a new note; returns its id.
    Q_INVOKABLE QString importFile(const QString& path);

    Q_INVOKABLE void registerQuickCaptureHotkey();
    // Plain text -> TipTap JSON (one paragraph per line), for "Convert to rich text".
    Q_INVOKABLE QString plainToRich(const QString& text) const;

signals:
    void quickCaptureRequested();
    void filesOpened(const QStringList& paths);  // from a second instance
    void activateRequested();
    void hotkeyChanged();

private:
    bool nativeHotkey(void* message);
    friend class HotkeyFilter;

    noted::NoteStore& m_store;
    QString m_dataPath;
    bool m_devData = false;
    bool m_hotkey = false;
    QLocalServer* m_server = nullptr;
    class HotkeyFilter* m_filter = nullptr;
};
