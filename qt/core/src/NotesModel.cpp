#include "noted/NotesModel.h"

#include "noted/Sqlite.h"
#include "noted/Database.h"
#include "noted/NoteStore.h"
#include "noted/DateText.h"

#include <QLocale>
#include <QRegularExpression>

namespace noted {

NotesModel::NotesModel(NoteStore& store, QObject* parent)
    : QAbstractListModel(parent)
    , m_store(store)
{
    // Coalesce bursts (save + tag change + list change) into one query.
    m_debounce.setSingleShot(true);
    m_debounce.setInterval(0);
    connect(&m_debounce, &QTimer::timeout, this, &NotesModel::refresh);
    connect(&m_store, &NoteStore::notesChanged, this, &NotesModel::scheduleRefresh);
    connect(&m_store, &NoteStore::tagsChanged, this, &NotesModel::scheduleRefresh);
    connect(&m_store, &NoteStore::noteChanged, this, [this](const QString& id) { m_taskCounts.remove(id); });
    connect(&m_store, &NoteStore::externalChange, this, [this] { m_taskCounts.clear(); });
    refresh();
}

void NotesModel::scheduleRefresh() { m_debounce.start(); }

int NotesModel::rowCount(const QModelIndex& parent) const
{
    return parent.isValid() ? 0 : int(m_rows.size());
}

QVariant NotesModel::data(const QModelIndex& index, int role) const
{
    if (!index.isValid() || index.row() >= m_rows.size()) return {};
    const Row& r = m_rows.at(index.row());
    switch (role) {
    case IdRole:        return r.id;
    case TitleRole:     return r.title;
    case PreviewRole:   return r.preview;
    case NoteTypeRole:  return r.noteType;
    case ListIdRole:    return r.listId;
    case PinnedRole:    return r.pinned;
    case LockedRole:    return r.locked;
    case SharedRole:    return r.shared;
    case OwnerRole:     return r.owner;
    case DailyRole:     return r.daily;
    case DailyDateRole: return r.dailyDate;
    case CreatedRole:   return r.created;
    case UpdatedRole:   return r.updated;
    case TagsRole:      return r.tags;
    case TasksDoneRole: return r.tasksDone;
    case TasksTotalRole: return r.tasksTotal;
    case GroupRole:     return r.group;
    case DateLabelRole: return r.dateLabel;
    case ListNameRole:  return r.listName;
    case ListColorRole: return r.listColor;
    default:            return {};
    }
}

QHash<int, QByteArray> NotesModel::roleNames() const
{
    return {{IdRole, "noteId"},       {TitleRole, "title"},       {PreviewRole, "preview"},
            {NoteTypeRole, "noteType"}, {ListIdRole, "listId"},   {PinnedRole, "pinned"},
            {LockedRole, "locked"},   {SharedRole, "shared"},     {OwnerRole, "owner"},
            {DailyRole, "daily"},     {DailyDateRole, "dailyDate"}, {CreatedRole, "createdAt"},
            {UpdatedRole, "updatedAt"}, {TagsRole, "tags"},
            {TasksDoneRole, "tasksDone"}, {TasksTotalRole, "tasksTotal"}, {GroupRole, "group"},
            {DateLabelRole, "dateLabel"}, {ListNameRole, "listName"}, {ListColorRole, "listColor"}};
}

void NotesModel::setView(const QString& v)
{
    if (v == m_view) return;
    m_view = v;
    emit viewChanged();
    refresh();
}

void NotesModel::setFilterId(const QString& id)
{
    if (id == m_filterId) return;
    m_filterId = id;
    emit filterIdChanged();
    refresh();
}

void NotesModel::setSort(const QString& s)
{
    if (s == m_sort) return;
    m_sort = s;
    emit sortChanged();
    refresh();
}

void NotesModel::setFilter(const QString& f)
{
    if (f == m_filter) return;
    m_filter = f;
    emit filterChanged();
    refresh();
}

int NotesModel::pinnedCount() const
{
    if (m_view == u"trash") return 0;
    int n = 0;
    for (const Row& r : m_rows)
        if (r.pinned) ++n;
    return n;
}

namespace {

// Checklist progress straight from the stored TipTap JSON, without parsing it:
// the editor, the Electron app and noted-cli all serialize task items as
// {"type":"taskItem","attrs":{"checked":…}}.
const QString kTaskItem = QStringLiteral(R"("type":"taskItem")");
const QString kTaskDone = QStringLiteral(R"("type":"taskItem","attrs":{"checked":true})");

QString occurrences(const QString& needle)
{
    return QStringLiteral("CASE WHEN n.note_type = 'rich' AND n.content LIKE '%%1%' "
                          "THEN (length(n.content) - length(replace(n.content, '%1', ''))) / %2 ELSE 0 END")
        .arg(needle)
        .arg(needle.size());
}

const QLocale kEn(QLocale::English);

// One line of body text for the card: markdown syntax (notes written by
// noted-cli keep it in content_plain) and a repeat of the title dropped.
QString snippet(const QString& plain, const QString& title)
{
    static const QRegularExpression lineMarks(QStringLiteral(R"(^\s*(#{1,6}\s+|>\s*|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|\[[ xX]\]\s+|```\w*|-{3,}\s*$))"));
    static const QRegularExpression inlineMarks(QStringLiteral(R"(\*\*|__|`|~~|\[([^\]]*)\]\([^)]*\))"));
    QStringList parts;
    int len = 0;
    const QStringList lines = plain.split(u'\n');
    for (QString line : lines) {
        line.remove(lineMarks);
        line.replace(inlineMarks, QStringLiteral("\\1"));
        line = line.simplified();
        if (line.isEmpty()) continue;
        if (parts.isEmpty() && line.compare(title.simplified(), Qt::CaseInsensitive) == 0) continue;
        parts << line;
        len += int(line.size()) + 1;
        if (len > 180) break;
    }
    return parts.join(u' ').left(180);
}

}  // namespace

QList<NotesModel::Row> NotesModel::query()
{
    QString where;
    QVariantList args;
    QString order;
    if (m_sort == u"title") order = QStringLiteral("n.title COLLATE NOCASE ASC");
    else if (m_sort == u"created_at") order = QStringLiteral("n.created_at DESC");
    else order = QStringLiteral("n.updated_at DESC");
    order = QStringLiteral("n.is_pinned DESC, ") + order;

    if (m_view == u"trash") {
        where = QStringLiteral("n.is_trashed = 1");
        order = QStringLiteral("n.updated_at DESC");
    } else if (m_view == u"synced") {
        where = QStringLiteral("n.is_trashed = 0 AND n.is_shared = 1");
    } else if (m_view == u"list") {
        where = QStringLiteral("n.is_trashed = 0 AND n.list_id = ?");
        args << m_filterId;
    } else if (m_view == u"tag") {
        where = QStringLiteral("n.is_trashed = 0 AND n.id IN (SELECT note_id FROM note_tags WHERE tag_id = ?)");
        args << m_filterId;
    } else if (m_view == u"daily") {
        where = QStringLiteral("n.is_trashed = 0 AND n.is_daily = 1 AND (n.daily_date = ? OR COALESCE(n.content_plain, '') <> '')");
        args << m_store.todayIso();
        order = QStringLiteral("n.daily_date DESC");
    } else {
        where = QStringLiteral("n.is_trashed = 0 AND (n.list_id IS NULL OR n.list_id NOT IN (SELECT id FROM lists WHERE is_hidden = 1))");
    }
    const QString openTodos = QStringLiteral(R"(n.note_type = 'rich' AND n.content LIKE '%"type":"taskItem","attrs":{"checked":false}%')");
    if (m_view != u"trash") {
        // What each filter would leave, so the list can hide filters that match nothing.
        const QVariantMap fc = m_store.database().conn().all(
            QStringLiteral("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN %1 THEN 1 ELSE 0 END), 0) AS todos, "
                           "COALESCE(SUM(n.is_daily = 1), 0) AS daily, COALESCE(SUM(n.is_shared = 1), 0) AS shared "
                           "FROM notes n WHERE %2").arg(openTodos, where),
            args).value(0).toMap();
        const QVariantMap counts{{"total", fc.value("total").toInt()}, {"todos", fc.value("todos").toInt()}, {"daily", fc.value("daily").toInt()}, {"shared", fc.value("shared").toInt()}};
        if (counts != m_filterCounts) {
            m_filterCounts = counts;
            emit filterCountsChanged();
        }
        if (m_filter == u"todos") where += QStringLiteral(" AND ") + openTodos;
        else if (m_filter == u"daily") where += QStringLiteral(" AND n.is_daily = 1");
        else if (m_filter == u"shared") where += QStringLiteral(" AND n.is_shared = 1");
    }

    const QVariantList rows = m_store.database().conn().all(
        QStringLiteral("SELECT n.id, n.title, substr(COALESCE(n.content_plain, ''), 1, 480) AS preview, n.note_type, n.list_id, "
                       "n.is_pinned, n.is_locked, n.is_shared, n.is_owner, n.is_daily, n.daily_date, n.created_at, n.updated_at, "
                       "l.name AS list_name, l.color AS list_color "
                       "FROM notes n LEFT JOIN lists l ON l.id = n.list_id WHERE %1 ORDER BY %2")
            .arg(where, order),
        args);

    QStringList ids;
    ids.reserve(rows.size());
    for (const QVariant& v : rows) ids << v.toMap().value("id").toString();
    const auto tags = m_store.tagsForNotes(ids);
    fillTaskCounts(ids);

    const QDate today = QDate::currentDate();
    // Headings only help once there's a list to scan; a handful of notes reads better ungrouped.
    const bool byDate = (m_sort != u"title" || m_view == u"trash") && rows.size() >= 15;
    const bool byDaily = m_view == u"daily";

    QList<Row> out;
    out.reserve(rows.size());
    for (const QVariant& v : rows) {
        const QVariantMap m = v.toMap();
        Row r;
        r.id = m.value("id").toString();
        r.title = m.value("title").toString();
        r.preview = snippet(m.value("preview").toString(), r.title);
        r.noteType = m.value("note_type").toString();
        r.listId = m.value("list_id").toString();
        r.pinned = m.value("is_pinned").toBool() && m_view != u"trash";
        r.locked = m.value("is_locked").toBool();
        r.shared = m.value("is_shared").toBool();
        r.owner = m.value("is_owner").isNull() ? true : m.value("is_owner").toBool();
        r.daily = m.value("is_daily").toBool();
        r.dailyDate = m.value("daily_date").toString();
        r.created = m.value("created_at").toString();
        r.updated = m.value("updated_at").toString();
        r.tags = tags.value(r.id);
        r.listName = m.value("list_name").toString();
        r.listColor = m.value("list_color").toString();
        const auto counts = m_taskCounts.value(r.id);
        r.tasksTotal = counts.second;
        r.tasksDone = qMin(counts.first, counts.second);

        // Date the row is sorted by, in local time.
        QDateTime when = DateText::parse(m_sort == u"created_at" && m_view != u"trash" ? r.created : r.updated);
        if (byDaily && !r.dailyDate.isEmpty()) when = QDateTime(QDate::fromString(r.dailyDate, Qt::ISODate), QTime(12, 0));
        const QDate d = when.date();
        const qint64 age = d.isValid() ? d.daysTo(today) : 9999;

        if (!d.isValid()) r.dateLabel.clear();
        else if (age == 0 && !byDaily) r.dateLabel = when.toString(QStringLiteral("HH:mm"));
        else if (age > 0 && age < 7) r.dateLabel = kEn.toString(d, QStringLiteral("ddd"));
        else r.dateLabel = d.year() == today.year() ? kEn.toString(d, QStringLiteral("MMM d")) : kEn.toString(d, QStringLiteral("MMM d, yyyy"));

        if (rows.size() < 15) r.group.clear();
        else if (r.pinned) r.group = QStringLiteral("Pinned");
        else if (!byDate || !d.isValid()) r.group.clear();
        else if (age <= 0) r.group = QStringLiteral("Today");
        else if (age == 1) r.group = QStringLiteral("Yesterday");
        else if (age < 7) r.group = QStringLiteral("This week");
        else if (d.year() == today.year() && d.month() == today.month()) r.group = QStringLiteral("Earlier this month");
        else if (d.year() == today.year()) r.group = kEn.toString(d, QStringLiteral("MMMM"));
        else r.group = kEn.toString(d, QStringLiteral("MMMM yyyy"));
        out << r;
    }
    return out;
}

// Counting scans note bodies, so it's done once per note and redone only
// for notes that changed since (see the constructor).
void NotesModel::fillTaskCounts(const QStringList& ids)
{
    QStringList missing;
    for (const QString& id : ids)
        if (!m_taskCounts.contains(id)) missing << id;
    for (qsizetype at = 0; at < missing.size(); at += 400) {
        const QStringList chunk = missing.mid(at, 400);
        QVariantList args;
        for (const QString& id : chunk) args << id;
        const QString marks = QStringList(QList<QString>(chunk.size(), QStringLiteral("?"))).join(u',');
        const QVariantList rows = m_store.database().conn().all(
            QStringLiteral("SELECT n.id, %1 AS total, %2 AS done FROM notes n WHERE n.id IN (%3)")
                .arg(occurrences(kTaskItem), occurrences(kTaskDone), marks),
            args);
        for (const QVariant& v : rows) {
            const QVariantMap m = v.toMap();
            m_taskCounts.insert(m.value("id").toString(), {m.value("done").toInt(), m.value("total").toInt()});
        }
    }
}

void NotesModel::refresh()
{
    const QList<Row> next = query();
    const int oldCount = int(m_rows.size());
    const int oldPinned = pinnedCount();

    // 1. Remove rows that disappeared (bottom-up keeps indexes valid).
    QSet<QString> nextIds;
    for (const Row& r : next) nextIds.insert(r.id);
    for (int i = int(m_rows.size()) - 1; i >= 0; --i) {
        if (!nextIds.contains(m_rows[i].id)) {
            beginRemoveRows({}, i, i);
            m_rows.removeAt(i);
            endRemoveRows();
        }
    }
    // 2. Walk the target order, moving/inserting/updating in place.
    for (int i = 0; i < next.size(); ++i) {
        const Row& want = next[i];
        if (i < m_rows.size() && m_rows[i].id == want.id) {
            if (!(m_rows[i] == want)) {
                m_rows[i] = want;
                emit dataChanged(index(i), index(i));
            }
            continue;
        }
        int j = -1;
        for (int k = i + 1; k < m_rows.size(); ++k)
            if (m_rows[k].id == want.id) {
                j = k;
                break;
            }
        if (j >= 0) {
            beginMoveRows({}, j, j, {}, i);
            m_rows.move(j, i);
            endMoveRows();
            if (!(m_rows[i] == want)) {
                m_rows[i] = want;
                emit dataChanged(index(i), index(i));
            }
        } else {
            beginInsertRows({}, i, i);
            m_rows.insert(i, want);
            endInsertRows();
        }
    }
    if (m_rows.size() != oldCount || pinnedCount() != oldPinned) emit countChanged();
}

int NotesModel::indexOf(const QString& id) const
{
    for (int i = 0; i < m_rows.size(); ++i)
        if (m_rows[i].id == id) return i;
    return -1;
}

QString NotesModel::idAt(int row) const
{
    return row >= 0 && row < m_rows.size() ? m_rows[row].id : QString();
}

QVariantMap NotesModel::get(int row) const
{
    if (row < 0 || row >= m_rows.size()) return {};
    QVariantMap m;
    const auto roles = roleNames();
    for (auto it = roles.begin(); it != roles.end(); ++it)
        m.insert(QString::fromLatin1(it.value()), data(index(row), it.key()));
    return m;
}

void NotesModel::patch(const QString& id, const QString& title, const QString& preview)
{
    const int i = indexOf(id);
    if (i < 0) return;
    Row& r = m_rows[i];
    const QString p = snippet(preview, title);
    if (r.title == title && r.preview == p) return;
    r.title = title;
    r.preview = p;
    emit dataChanged(index(i), index(i), {TitleRole, PreviewRole});
}

}  // namespace noted
