#include "noted/DateText.h"

#include <QLocale>
#include <QTimeZone>

namespace noted {

namespace {
const QLocale kEn(QLocale::English);
}

QDateTime DateText::parse(const QString& ts)
{
    if (ts.isEmpty()) return {};
    QDateTime dt = QDateTime::fromString(ts, QStringLiteral("yyyy-MM-dd HH:mm:ss"));
    if (dt.isValid()) {
        dt.setTimeZone(QTimeZone::UTC);
        return dt.toLocalTime();
    }
    dt = QDateTime::fromString(ts, Qt::ISODateWithMs);
    if (!dt.isValid()) dt = QDateTime::fromString(ts, Qt::ISODate);
    return dt.isValid() ? dt.toLocalTime() : QDateTime();
}

QString DateText::shortDate(const QString& ts) const
{
    const QDateTime dt = parse(ts);
    if (!dt.isValid()) return {};
    return dt.date().year() == QDate::currentDate().year() ? kEn.toString(dt.date(), QStringLiteral("MMM d"))
                                                           : kEn.toString(dt.date(), QStringLiteral("MMM d, yyyy"));
}

QString DateText::relative(const QString& ts) const
{
    const QDateTime dt = parse(ts);
    if (!dt.isValid()) return {};
    const qint64 secs = dt.secsTo(QDateTime::currentDateTime());
    if (secs < 60) return QStringLiteral("Just now");
    if (secs < 3600) return QStringLiteral("%1m ago").arg(secs / 60);
    if (secs < 86400) return QStringLiteral("%1h ago").arg(secs / 3600);
    if (secs < 7 * 86400) return QStringLiteral("%1d ago").arg(secs / 86400);
    return shortDate(ts);
}

QString DateText::full(const QString& ts) const
{
    const QDateTime dt = parse(ts);
    if (!dt.isValid()) return {};
    return kEn.toString(dt, QStringLiteral("dddd, MMMM d, yyyy 'at' HH:mm"));
}

static QDateTime parseDue(const QString& value, bool* hasTime)
{
    *hasTime = value.size() > 10;
    if (!*hasTime) return QDateTime(QDate::fromString(value, Qt::ISODate), QTime(0, 0));
    QDateTime dt = QDateTime::fromString(value, Qt::ISODate);
    if (!dt.isValid()) dt = QDateTime::fromString(value.left(16), QStringLiteral("yyyy-MM-ddTHH:mm"));
    return dt;
}

QString DateText::due(const QString& value) const
{
    if (value.isEmpty()) return {};
    bool hasTime = false;
    const QDateTime dt = parseDue(value, &hasTime);
    if (!dt.isValid()) return value;
    const qint64 days = QDate::currentDate().daysTo(dt.date());
    QString day;
    if (days == 0) day = QStringLiteral("Today");
    else if (days == 1) day = QStringLiteral("Tomorrow");
    else if (days == -1) day = QStringLiteral("Yesterday");
    else if (days > 1 && days < 7) day = kEn.toString(dt.date(), QStringLiteral("dddd"));
    else day = dt.date().year() == QDate::currentDate().year() ? kEn.toString(dt.date(), QStringLiteral("MMM d"))
                                                               : kEn.toString(dt.date(), QStringLiteral("MMM d, yyyy"));
    if (hasTime) day += QStringLiteral(", ") + dt.time().toString(QStringLiteral("HH:mm"));
    return day;
}

int DateText::dueState(const QString& value) const
{
    if (value.isEmpty()) return 2;
    bool hasTime = false;
    const QDateTime dt = parseDue(value, &hasTime);
    if (!dt.isValid()) return 2;
    const QDate today = QDate::currentDate();
    if (dt.date() < today) return -1;
    if (hasTime && dt < QDateTime::currentDateTime()) return -1;
    if (dt.date() == today) return 0;
    return 1;
}

QString DateText::isoDate(int addDays) const
{
    return QDate::currentDate().addDays(addDays).toString(Qt::ISODate);
}

QString DateText::greeting() const
{
    const int h = QTime::currentTime().hour();
    if (h < 12) return QStringLiteral("Good morning");
    if (h < 18) return QStringLiteral("Good afternoon");
    return QStringLiteral("Good evening");
}

}  // namespace noted
