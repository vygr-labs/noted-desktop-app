#include "Zip.h"

#include <QDateTime>

namespace {

quint32 crc32(const QByteArray& data)
{
    static quint32 table[256];
    static bool init = false;
    if (!init) {
        for (quint32 i = 0; i < 256; ++i) {
            quint32 c = i;
            for (int k = 0; k < 8; ++k) c = (c & 1) ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[i] = c;
        }
        init = true;
    }
    quint32 c = 0xFFFFFFFFu;
    for (char ch : data) c = table[(c ^ quint8(ch)) & 0xFF] ^ (c >> 8);
    return c ^ 0xFFFFFFFFu;
}

void u16(QByteArray& b, quint16 v)
{
    b.append(char(v & 0xFF));
    b.append(char(v >> 8));
}

void u32(QByteArray& b, quint32 v)
{
    for (int i = 0; i < 4; ++i) b.append(char((v >> (8 * i)) & 0xFF));
}

void dosTime(QByteArray& b)
{
    const QDateTime now = QDateTime::currentDateTime();
    const QTime t = now.time();
    const QDate d = now.date();
    u16(b, quint16((t.hour() << 11) | (t.minute() << 5) | (t.second() / 2)));
    u16(b, quint16(((d.year() - 1980) << 9) | (d.month() << 5) | d.day()));
}

}  // namespace

void ZipWriter::add(const QString& name, const QByteArray& data)
{
    Entry e;
    e.name = name.toUtf8();
    e.crc = crc32(data);
    e.size = quint32(data.size());
    e.offset = quint32(m_out.size());

    u32(m_out, 0x04034b50);
    u16(m_out, 20);
    u16(m_out, 0x0800);  // UTF-8 names
    u16(m_out, 0);       // stored
    dosTime(m_out);
    u32(m_out, e.crc);
    u32(m_out, e.size);
    u32(m_out, e.size);
    u16(m_out, quint16(e.name.size()));
    u16(m_out, 0);
    m_out.append(e.name);
    m_out.append(data);
    m_entries.append(e);
}

QByteArray ZipWriter::finish()
{
    const quint32 cdStart = quint32(m_out.size());
    for (const Entry& e : m_entries) {
        u32(m_out, 0x02014b50);
        u16(m_out, 20);
        u16(m_out, 20);
        u16(m_out, 0x0800);
        u16(m_out, 0);
        dosTime(m_out);
        u32(m_out, e.crc);
        u32(m_out, e.size);
        u32(m_out, e.size);
        u16(m_out, quint16(e.name.size()));
        u16(m_out, 0);
        u16(m_out, 0);
        u16(m_out, 0);
        u16(m_out, 0);
        u32(m_out, 0);
        u32(m_out, e.offset);
        m_out.append(e.name);
    }
    const quint32 cdSize = quint32(m_out.size()) - cdStart;
    u32(m_out, 0x06054b50);
    u16(m_out, 0);
    u16(m_out, 0);
    u16(m_out, quint16(m_entries.size()));
    u16(m_out, quint16(m_entries.size()));
    u32(m_out, cdSize);
    u32(m_out, cdStart);
    u16(m_out, 0);
    return m_out;
}
