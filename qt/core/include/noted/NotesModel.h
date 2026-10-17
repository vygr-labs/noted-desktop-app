#pragma once

// The middle-column note list.
//
// refresh() re-queries and applies the difference as row inserts, removes,
// moves and dataChanged — never a model reset — so the ListView keeps its
// scroll position while the note being edited hops to the top of a
// "last modified" sort.

#include <QAbstractListModel>
#include <QTimer>

namespace noted {

class NoteStore;

class NotesModel : public QAbstractListModel
{
    Q_OBJECT
    // all | synced | trash | list | daily | tag
    Q_PROPERTY(QString view READ view WRITE setView NOTIFY viewChanged)
    Q_PROPERTY(QString filterId READ filterId WRITE setFilterId NOTIFY filterIdChanged)
    // updated_at | created_at | title
    Q_PROPERTY(QString sort READ sort WRITE setSort NOTIFY sortChanged)
    // "" | todos (has open checklist items) | daily | shared
    Q_PROPERTY(QString filter READ filter WRITE setFilter NOTIFY filterChanged)
    Q_PROPERTY(int count READ count NOTIFY countChanged)
    Q_PROPERTY(int pinnedCount READ pinnedCount NOTIFY countChanged)
    // How many notes in the view each filter would keep: {total, todos, daily, shared}.
    Q_PROPERTY(QVariantMap filterCounts READ filterCounts NOTIFY filterCountsChanged)

public:
    enum Role {
        IdRole = Qt::UserRole + 1,
        TitleRole,
        PreviewRole,
        NoteTypeRole,
        ListIdRole,
        PinnedRole,
        LockedRole,
        SharedRole,
        OwnerRole,
        DailyRole,
        DailyDateRole,
        CreatedRole,
        UpdatedRole,
        TagsRole,
        TasksDoneRole,
        TasksTotalRole,
        GroupRole,      // "Pinned", "Today", "Yesterday", "This week", "August", "August 2025", or "" (short lists aren't grouped)
        DateLabelRole,  // "09:12" today, "Mon" this week, else "Sep 5"
        ListNameRole,
        ListColorRole,
    };

    explicit NotesModel(NoteStore& store, QObject* parent = nullptr);

    int rowCount(const QModelIndex& parent = {}) const override;
    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    QString view() const { return m_view; }
    void setView(const QString& v);
    QString filterId() const { return m_filterId; }
    void setFilterId(const QString& id);
    QString sort() const { return m_sort; }
    void setSort(const QString& s);
    QString filter() const { return m_filter; }
    void setFilter(const QString& f);
    int count() const { return int(m_rows.size()); }
    int pinnedCount() const;
    QVariantMap filterCounts() const { return m_filterCounts; }

    Q_INVOKABLE void refresh();
    Q_INVOKABLE int indexOf(const QString& id) const;
    Q_INVOKABLE QString idAt(int row) const;
    Q_INVOKABLE QVariantMap get(int row) const;
    // Live preview while typing — updates the row without touching the DB.
    Q_INVOKABLE void patch(const QString& id, const QString& title, const QString& preview);

signals:
    void viewChanged();
    void filterIdChanged();
    void sortChanged();
    void filterChanged();
    void countChanged();
    void filterCountsChanged();

private:
    struct Row {
        QString id, title, preview, noteType, listId, dailyDate, created, updated;
        QString group, dateLabel, listName, listColor;
        int tasksDone = 0, tasksTotal = 0;
        bool pinned = false, locked = false, shared = false, owner = true, daily = false;
        QVariantList tags;
        bool operator==(const Row& o) const = default;
    };
    QList<Row> query();
    void fillTaskCounts(const QStringList& ids);
    void scheduleRefresh();

    NoteStore& m_store;
    QList<Row> m_rows;
    QString m_view = QStringLiteral("all");
    QString m_filterId;
    QString m_sort = QStringLiteral("updated_at");
    QString m_filter;
    QVariantMap m_filterCounts;
    QHash<QString, QPair<int, int>> m_taskCounts;  // id -> (done, total)
    QTimer m_debounce;
};

}  // namespace noted
