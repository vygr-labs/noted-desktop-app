#include "noted/sync/Merge.h"

#include <QHash>
#include <QSet>

#include <vector>

namespace noted::sync {

namespace {

// Pairs (i in a, j in b) of a longest common subsequence, in order.
// Common ends are matched first; past a few million cells the middle is left
// unmatched rather than stalling the app (it then merges as one stretch).
std::vector<std::pair<int, int>> lcs(const QStringList& a, const QStringList& b)
{
    std::vector<std::pair<int, int>> out;
    int lo = 0;
    while (lo < a.size() && lo < b.size() && a[lo] == b[lo]) { out.emplace_back(lo, lo); ++lo; }
    int ea = int(a.size()), eb = int(b.size());
    std::vector<std::pair<int, int>> tail;
    while (ea > lo && eb > lo && a[ea - 1] == b[eb - 1]) { --ea; --eb; tail.emplace_back(ea, eb); }

    const int n = ea - lo, m = eb - lo;
    if (n > 0 && m > 0 && qint64(n) * m <= 4'000'000) {
        std::vector<uint> ha(n), hb(m);
        for (int i = 0; i < n; ++i) ha[i] = uint(qHash(a[lo + i]));
        for (int j = 0; j < m; ++j) hb[j] = uint(qHash(b[lo + j]));
        // dp[i][j]: LCS length of a[i..] and b[j..]
        std::vector<int> dp(size_t(n + 1) * (m + 1), 0);
        auto at = [&](int i, int j) -> int& { return dp[size_t(i) * (m + 1) + j]; };
        for (int i = n - 1; i >= 0; --i)
            for (int j = m - 1; j >= 0; --j)
                at(i, j) = ha[i] == hb[j] && a[lo + i] == b[lo + j] ? at(i + 1, j + 1) + 1
                                                                      : std::max(at(i + 1, j), at(i, j + 1));
        int i = 0, j = 0;
        while (i < n && j < m) {
            if (ha[i] == hb[j] && a[lo + i] == b[lo + j]) { out.emplace_back(lo + i, lo + j); ++i; ++j; }
            else if (at(i + 1, j) >= at(i, j + 1)) ++i;
            else ++j;
        }
    }
    for (auto it = tail.rbegin(); it != tail.rend(); ++it) out.push_back(*it);
    return out;
}

QStringList slice(const QStringList& l, int from, int to) { return l.mid(from, to - from); }

// Both sides changed the same stretch: the first side's blocks, then the
// other's that the first doesn't already have.
QStringList both(const QStringList& first, const QStringList& second)
{
    QStringList out = first;
    QSet<QString> seen(first.begin(), first.end());
    for (const QString& s : second)
        if (!seen.contains(s)) out << s;
    return out;
}

}  // namespace

std::vector<std::pair<int, int>> matchBlocks(const QStringList& a, const QStringList& b) { return lcs(a, b); }

Body splitBody(const QString& content, bool plain)
{
    Body b;
    if (plain) {
        if (!content.isEmpty()) b.blocks = content.split(QLatin1Char('\n'));
        return b;
    }
    if (content.isEmpty()) return b;
    // Walk the JSON text for the root object's "content" array and slice its
    // elements as they are written.
    int depth = 0, arrayAt = -1, itemStart = -1;
    bool inString = false, afterContentKey = false;
    QString lastKey;
    int keyStart = -1;
    for (int i = 0; i < content.size(); ++i) {
        const QChar ch = content[i];
        if (inString) {
            if (ch == u'\\') ++i;
            else if (ch == u'"') {
                inString = false;
                if (depth == 1 && arrayAt < 0) lastKey = content.mid(keyStart + 1, i - keyStart - 1);
            }
            continue;
        }
        if (arrayAt >= 0 && depth == 2 && itemStart < 0 && !ch.isSpace() && ch != u',' && ch != u']') itemStart = i;
        switch (ch.unicode()) {
        case '"':
            inString = true;
            keyStart = i;
            break;
        case ':':
            if (depth == 1 && arrayAt < 0) afterContentKey = lastKey == u"content";
            break;
        case '{':
        case '[':
            if (ch == u'[' && depth == 1 && afterContentKey && arrayAt < 0) arrayAt = i;
            ++depth;
            break;
        case ',':
            if (arrayAt >= 0 && depth == 2 && itemStart >= 0) {
                b.blocks << content.mid(itemStart, i - itemStart).trimmed();
                itemStart = -1;
            }
            if (depth == 1) afterContentKey = false;
            break;
        case '}':
        case ']':
            --depth;
            if (ch == u']' && arrayAt >= 0 && depth == 1) {
                if (itemStart >= 0) b.blocks << content.mid(itemStart, i - itemStart).trimmed();
                b.head = content.left(arrayAt + 1);
                b.tail = content.mid(i);
                b.exact = joinBody(b, false) == content;
                return b;
            }
            break;
        default:
            break;
        }
    }
    b.blocks.clear();
    b.exact = false;
    return b;
}

QString joinBody(const Body& body, bool plain)
{
    if (plain) return body.blocks.join(QLatin1Char('\n'));
    if (body.head.isEmpty()) {
        if (body.blocks.isEmpty()) return {};
        return QStringLiteral("{\"type\":\"doc\",\"content\":[") + body.blocks.join(QLatin1Char(',')) + QStringLiteral("]}");
    }
    return body.head + body.blocks.join(QLatin1Char(',')) + body.tail;
}

QStringList merge3(const QStringList& base, const QStringList& a, const QStringList& b, bool firstIsA)
{
    // Base blocks both sides kept are the anchors; between anchors, take
    // whichever side changed the stretch, or both.
    QHash<int, int> inA, inB;
    for (auto [i, j] : lcs(base, a)) inA.insert(i, j);
    for (auto [i, j] : lcs(base, b)) inB.insert(i, j);

    QStringList out;
    int i = 0, ja = 0, jb = 0;
    auto chunk = [&](int k, int ka, int kb) {
        const QStringList o = slice(base, i, k), ca = slice(a, ja, ka), cb = slice(b, jb, kb);
        if (ca == o) out << cb;
        else if (cb == o || ca == cb) out << ca;
        else out << (firstIsA ? both(ca, cb) : both(cb, ca));
    };
    for (int k = 0; k < base.size(); ++k) {
        if (!inA.contains(k) || !inB.contains(k)) continue;
        const int ka = inA.value(k), kb = inB.value(k);
        if (ka < ja || kb < jb) continue;
        chunk(k, ka, kb);
        out << base[k];
        i = k + 1;
        ja = ka + 1;
        jb = kb + 1;
    }
    chunk(int(base.size()), int(a.size()), int(b.size()));
    return out;
}

QStringList merge2(const QStringList& a, const QStringList& b, bool firstIsA)
{
    QStringList common;
    for (auto [i, j] : lcs(a, b)) common << a[i];
    return merge3(common, a, b, firstIsA);
}

QString mergeContent(const QString* base, const QString& a, const QString& b, bool firstIsA, bool plain)
{
    if (a == b) return a;
    const Body ba = splitBody(a, plain), bb = splitBody(b, plain);
    // A body that isn't a readable document can't be merged block by block:
    // keep both, whole.
    if (!plain && ((!a.isEmpty() && ba.head.isEmpty()) || (!b.isEmpty() && bb.head.isEmpty())))
        return firstIsA ? a : b;
    const QStringList merged = base ? merge3(splitBody(*base, plain).blocks, ba.blocks, bb.blocks, firstIsA)
                                    : merge2(ba.blocks, bb.blocks, firstIsA);
    if (merged == ba.blocks) return a;
    if (merged == bb.blocks) return b;
    Body out = ba.head.isEmpty() ? bb : ba;
    out.blocks = merged;
    return joinBody(out, plain);
}

QJsonArray delta(const QStringList& from, const QStringList& to)
{
    QJsonArray ops;
    auto keep = [&](int n) { if (n > 0) ops.append(n); };
    auto drop = [&](int n) { if (n > 0) ops.append(-n); };
    int i = 0, j = 0, run = 0;
    for (auto [mi, mj] : lcs(from, to)) {
        if (mi == i && mj == j) { ++run; ++i; ++j; continue; }
        keep(run);
        run = 0;
        drop(mi - i);
        if (mj > j) {
            QJsonArray ins;
            for (int k = j; k < mj; ++k) ins.append(to[k]);
            ops.append(ins);
        }
        i = mi + 1;
        j = mj + 1;
        run = 1;
    }
    keep(run);
    drop(int(from.size()) - i);
    if (to.size() > j) {
        QJsonArray ins;
        for (int k = j; k < to.size(); ++k) ins.append(to[k]);
        ops.append(ins);
    }
    return ops;
}

bool applyDelta(const QStringList& from, const QJsonArray& ops, QStringList* out)
{
    out->clear();
    int i = 0;
    for (const QJsonValue& op : ops) {
        if (op.isArray()) {
            for (const QJsonValue& s : op.toArray()) *out << s.toString();
        } else {
            const int n = op.toInt();
            if (n > 0) {
                if (i + n > from.size()) return false;
                *out << from.mid(i, n);
                i += n;
            } else {
                i -= n;
                if (i > from.size()) return false;
            }
        }
    }
    return i == from.size();
}

}  // namespace noted::sync
