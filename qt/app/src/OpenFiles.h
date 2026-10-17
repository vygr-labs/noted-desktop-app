#pragma once

// Files opened from disk (the `Files` singleton). They are edited in place,
// never copied into the database: each gets a pseudo note id ("file:" + its
// absolute path) so the editor, history and selection treat it like a note,
// while loading and saving go to the file.
//
// .md/.markdown files open in the rich editor and are written back as
// markdown; anything else opens as plain text. A file's BOM and line endings
// are kept. Changes made by other programs are picked up live.

#include <QFileSystemWatcher>
#include <QHash>
#include <QJsonObject>
#include <QObject>
#include <QVariantList>

namespace noted {
class NoteStore;
}

class OpenFiles : public QObject
{
    Q_OBJECT
    // [{ id, path, name }] in the order they were opened.
    Q_PROPERTY(QVariantList files READ files NOTIFY filesChanged)

public:
    explicit OpenFiles(noted::NoteStore& store, QObject* parent = nullptr);

    QVariantList files() const;

    Q_INVOKABLE static bool isFile(const QString& id);
    Q_INVOKABLE static QString pathOf(const QString& id);

    // Adds the file to the open list (if new) and returns its id, or "" if it
    // can't be read.
    Q_INVOKABLE QString open(const QString& pathOrUrl);
    Q_INVOKABLE void close(const QString& id);
    // A note-shaped map for the editor: id, title, note_type, content,
    // created_at, updated_at, is_file, file_path. Empty if unreadable.
    Q_INVOKABLE QVariantMap note(const QString& id);
    // Writes the editor's text back to disk. Returns false on failure.
    Q_INVOKABLE bool writeText(const QString& id, const QString& text);
    bool writeDoc(const QString& id, const QJsonObject& doc);

signals:
    void filesChanged();
    // Another program changed (or removed) an open file.
    void externallyChanged(const QString& id);
    void writeFailed(const QString& id, const QString& error);

private:
    struct Format {
        bool bom = false;
        bool crlf = false;
        QString text;  // last contents read or written, normalised to \n
        // What the rich editor would write for `text` untouched. Saving that
        // means nothing really changed, so the file keeps its own formatting.
        QString unchangedMarkdown;
    };
    bool readFile(const QString& path, Format& out) const;
    bool write(const QString& path, const QString& text);
    void persist();
    void onDiskChange(const QString& path);

    noted::NoteStore& m_store;
    QStringList m_paths;
    QHash<QString, Format> m_formats;  // path -> how it was stored
    QFileSystemWatcher m_watcher;
};
