#pragma once

// Merging two versions of a note body edited on different computers. A body is
// a run of blocks: the TipTap document's top-level nodes for a rich note, its
// lines for a plain one. Blocks only one side touched merge cleanly; where
// both sides changed the same stretch, both versions are kept, the earlier
// edit first, so nothing typed is ever lost.

#include <QJsonArray>
#include <QString>
#include <QStringList>

#include <utility>
#include <vector>

namespace noted::sync {

// A body cut into blocks, keeping the exact text around them, so joining it
// back gives the same bytes (`exact` says it does).
struct Body
{
    QString head, tail;
    QStringList blocks;
    bool exact = true;
};
Body splitBody(const QString& content, bool plain);
QString joinBody(const Body& body, bool plain);

// Three-way merge. `firstIsA` says whose changes go first where both sides
// changed the same blocks; pass the same answer on every computer (from the
// edits' clocks) and they all reach the same result.
QStringList merge3(const QStringList& base, const QStringList& a, const QStringList& b, bool firstIsA);

// Two versions with no known common ancestor: shared blocks once, in place,
// and each side's own blocks around them.
QStringList merge2(const QStringList& a, const QStringList& b, bool firstIsA);

QString mergeContent(const QString* base, const QString& a, const QString& b, bool firstIsA, bool plain);

// Pairs (i, j) of blocks a[i] == b[j] in a longest common run, in order.
std::vector<std::pair<int, int>> matchBlocks(const QStringList& a, const QStringList& b);

// A compact edit script turning `from` into `to`: [n] keeps n blocks,
// [-n] drops n, ["block", ...] inserts. Small when an edit touches one block
// of a long note.
QJsonArray delta(const QStringList& from, const QStringList& to);
bool applyDelta(const QStringList& from, const QJsonArray& ops, QStringList* out);

}  // namespace noted::sync
