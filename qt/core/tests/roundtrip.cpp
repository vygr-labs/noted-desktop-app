// Round-trips every rich note of a real database through the editor model:
//   JSON -> QTextDocument (load) -> styler -> JSON (save)
// and reports notes whose canonical JSON changed. Read-only: opens the DB
// with SQLITE_OPEN_READONLY.
//
//   roundtrip <path-to-app.sqlite> [--verbose] [--id <note-id>]

#include <QGuiApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QTextDocument>
#include <QAbstractTextDocumentLayout>
#include <QTextBlock>
#include <QTextLayout>

#include <cstdio>

#include "noted/Sqlite.h"
#include "noted/doc/Export.h"
#include "noted/doc/Styler.h"
#include "noted/doc/TipTap.h"

using namespace noted;

namespace {

// Canonical form: marks sorted by type; known-equivalent defaults filled in.
QJsonValue canon(const QJsonValue& v)
{
    if (v.isArray()) {
        QJsonArray out;
        for (const QJsonValue& x : v.toArray()) out.append(canon(x));
        return out;
    }
    if (!v.isObject()) return v;
    QJsonObject o = v.toObject();
    QJsonObject out;
    for (auto it = o.begin(); it != o.end(); ++it) {
        if (it.key() == u"marks") {
            QJsonArray marks = it.value().toArray();
            QList<QJsonValue> list(marks.begin(), marks.end());
            std::sort(list.begin(), list.end(), [](const QJsonValue& a, const QJsonValue& b) {
                return a.toObject().value("type").toString() < b.toObject().value("type").toString();
            });
            QJsonArray sorted;
            for (const auto& m : list) sorted.append(canon(m));
            if (!sorted.isEmpty()) out.insert("marks", sorted);
        } else if (it.key() == u"text" && it.value().isString()) {
            // Line endings are normalized to LF on import (see Importer::codeBlock).
            QString t = it.value().toString();
            t.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));
            t.replace(QLatin1Char('\r'), QLatin1Char('\n'));
            out.insert(it.key(), t);
        } else {
            out.insert(it.key(), canon(it.value()));
        }
    }
    // Merge adjacent text nodes with identical marks (ProseMirror normalizes this too).
    if (out.contains("content")) {
        QJsonArray merged;
        for (const QJsonValue& c : out.value("content").toArray()) {
            QJsonObject co = c.toObject();
            if (!merged.isEmpty() && co.value("type").toString() == u"text") {
                QJsonObject last = merged.last().toObject();
                if (last.value("type").toString() == u"text" && last.value("marks") == co.value("marks")) {
                    last.insert("text", last.value("text").toString() + co.value("text").toString());
                    merged.replace(merged.size() - 1, last);
                    continue;
                }
            }
            merged.append(co);
        }
        out.insert("content", merged);
    }
    return out;
}

QString firstDiff(const QJsonValue& a, const QJsonValue& b, const QString& path)
{
    if (a == b) return {};
    if (a.isObject() && b.isObject()) {
        const QJsonObject x = a.toObject(), y = b.toObject();
        QStringList keys = x.keys();
        for (const QString& k : y.keys())
            if (!keys.contains(k)) keys << k;
        for (const QString& k : keys) {
            const QString d = firstDiff(x.value(k), y.value(k), path + "." + k);
            if (!d.isEmpty()) return d;
        }
    }
    if (a.isArray() && b.isArray()) {
        const QJsonArray x = a.toArray(), y = b.toArray();
        for (int i = 0; i < qMax(x.size(), y.size()); ++i) {
            const QString d = firstDiff(x.at(i), y.at(i), path + QString("[%1]").arg(i));
            if (!d.isEmpty()) return d;
        }
    }
    auto s = [](const QJsonValue& v) {
        if (v.isObject()) return QString::fromUtf8(QJsonDocument(v.toObject()).toJson(QJsonDocument::Compact)).left(300);
        if (v.isArray()) return QString::fromUtf8(QJsonDocument(v.toArray()).toJson(QJsonDocument::Compact)).left(300);
        if (v.isUndefined()) return QStringLiteral("<missing>");
        return QString::fromUtf8(QJsonDocument(QJsonArray{v}).toJson(QJsonDocument::Compact)).left(300);
    };
    return path + "\n      want: " + s(a) + "\n      got:  " + s(b);
}

}  // namespace

int main(int argc, char** argv)
{
    qputenv("QT_QPA_PLATFORM", "offscreen");
    QGuiApplication app(argc, argv);
    const QStringList args = app.arguments();
    if (args.size() < 2) {
        std::fprintf(stderr, "usage: roundtrip <app.sqlite> [--verbose] [--id <note-id>]\n");
        return 2;
    }
    const bool verbose = args.contains("--verbose");
    const int idIdx = args.indexOf("--id");
    const QString onlyId = idIdx > 0 && idIdx + 1 < args.size() ? args[idIdx + 1] : QString();

    db::Connection conn(args[1], db::Connection::Mode::ReadOnly);
    const QVariantList rows = conn.all(
        "SELECT id, title, content, content_plain FROM notes WHERE note_type = 'rich' AND content IS NOT NULL");

    doc::Styler styler;
    int ok = 0, bad = 0, plainBad = 0;
    for (const QVariant& r : rows) {
        const QVariantMap m = r.toMap();
        if (!onlyId.isEmpty() && m.value("id").toString() != onlyId) continue;
        const QJsonObject in = doc::parse(m.value("content").toString());

        QTextDocument d;
        doc::load(&d, in);
        styler.apply(&d);
        if (args.contains("--layout")) {
            d.setTextWidth(760);
            int n = 0;
            for (QTextBlock b = d.begin(); b.isValid() && n < 12; b = b.next(), ++n) {
                const QRectF r = d.documentLayout()->blockBoundingRect(b);
                QTextLayout* l = b.layout();
                QString lines;
                for (int i = 0; i < l->lineCount(); ++i)
                    lines += QString(" [y=%1 h=%2 lead=%3 asc=%4]").arg(l->lineAt(i).y()).arg(l->lineAt(i).height()).arg(l->lineAt(i).leading()).arg(l->lineAt(i).ascent());
                std::printf("block %d y=%.1f h=%.1f top=%.1f lh=%.1f type=%d text=%s%s\n", n, r.y(), r.height(), b.blockFormat().topMargin(),
                            b.blockFormat().lineHeight(), b.blockFormat().lineHeightType(), qPrintable(b.text().left(30)), qPrintable(lines));
            }
        }
        const QJsonObject out = doc::save(&d);

        const QJsonValue a = canon(in), b = canon(out);
        if (a == b) {
            ++ok;
        } else {
            ++bad;
            std::printf("MISMATCH %s  \"%s\"\n    %s\n", qPrintable(m.value("id").toString()),
                        qPrintable(m.value("title").toString().left(40)),
                        qPrintable(firstDiff(a, b, "doc")));
            if (verbose) {
                std::printf("  in:  %s\n  out: %s\n", QJsonDocument(in).toJson(QJsonDocument::Compact).left(2000).constData(),
                            QJsonDocument(out).toJson(QJsonDocument::Compact).left(2000).constData());
            }
        }
        // content_plain must match what the Electron build computed.
        if (doc::toPlainText(in) != m.value("content_plain").toString()) {
            ++plainBad;
            if (verbose) {
                const QString a = doc::toPlainText(in), b = m.value("content_plain").toString();
                int i = 0;
                while (i < a.size() && i < b.size() && a[i] == b[i]) ++i;
                std::printf("PLAIN %s at %d: ours=%s stored=%s\n", qPrintable(m.value("id").toString()), i,
                            QJsonDocument(QJsonArray{a.mid(qMax(0, i - 20), 60)}).toJson(QJsonDocument::Compact).constData(),
                            QJsonDocument(QJsonArray{b.mid(qMax(0, i - 20), 60)}).toJson(QJsonDocument::Compact).constData());
            }
        }
    }
    std::printf("\n%d identical, %d changed, %d plain-text mismatches (of %lld rich notes)\n", ok, bad, plainBad,
                qlonglong(rows.size()));
    return bad == 0 ? 0 : 1;
}
