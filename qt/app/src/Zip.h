#pragma once

// Minimal "stored" (uncompressed) ZIP writer — enough for exporting notes
// as markdown files. Every archiver opens it; notes are small, so skipping
// deflate costs little and avoids a zlib dependency.

#include <QByteArray>
#include <QList>
#include <QString>

class ZipWriter
{
public:
    void add(const QString& name, const QByteArray& data);
    QByteArray finish();

private:
    struct Entry {
        QByteArray name;
        quint32 crc = 0;
        quint32 size = 0;
        quint32 offset = 0;
    };
    QByteArray m_out;
    QList<Entry> m_entries;
};
