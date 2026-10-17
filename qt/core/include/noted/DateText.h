#pragma once

// Human date strings for SQLite timestamps (CURRENT_TIMESTAMP is UTC,
// "YYYY-MM-DD HH:MM:SS"). Exposed to QML as the `Dates` singleton.

#include <QDateTime>
#include <QObject>

namespace noted {

class DateText : public QObject
{
    Q_OBJECT

public:
    using QObject::QObject;

    static QDateTime parse(const QString& ts);

    // "Just now", "5m ago", "3h ago", "2d ago", "Mar 4", "Mar 4, 2024"
    Q_INVOKABLE QString relative(const QString& ts) const;
    // "Mar 4" / "Mar 4, 2024"
    Q_INVOKABLE QString shortDate(const QString& ts) const;
    // "Tuesday, March 4, 2025 at 14:05"
    Q_INVOKABLE QString full(const QString& ts) const;
    // Due-date label for todos: "Today", "Tomorrow", "Yesterday", "Mon", "Mar 4",
    // with ", 14:00" appended when the value carries a time.
    Q_INVOKABLE QString due(const QString& value) const;
    // -1 overdue, 0 today, 1 future, 2 none
    Q_INVOKABLE int dueState(const QString& value) const;
    Q_INVOKABLE QString isoDate(int addDays = 0) const;
    Q_INVOKABLE QString greeting() const;
};

}  // namespace noted
