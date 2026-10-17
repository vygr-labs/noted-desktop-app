#include "noted/doc/Export.h"

#include <QJsonArray>
#include <QStringList>

namespace noted::doc {

namespace {

const QString kType = QStringLiteral("type");
const QString kAttrs = QStringLiteral("attrs");
const QString kContent = QStringLiteral("content");
const QString kText = QStringLiteral("text");
const QString kMarks = QStringLiteral("marks");

QString typeOf(const QJsonObject& n) { return n.value(kType).toString(); }
QJsonArray kidsOf(const QJsonObject& n) { return n.value(kContent).toArray(); }

// ── plain text (exact port of tiptap-to-plaintext.ts) ───────────────────

QString extractText(const QJsonObject& node)
{
    const QString text = node.value(kText).toString();
    if (!text.isEmpty()) return text;
    if (!node.contains(kContent)) return {};
    const QJsonArray kids = kidsOf(node);

    if (typeOf(node) == u"tableRow") {
        QStringList cells;
        for (const QJsonValue& c : kids) cells << extractText(c.toObject()).trimmed();
        return cells.join(QLatin1Char('\t')) + QLatin1Char('\n');
    }

    static const QStringList lineTypes = {
        QStringLiteral("paragraph"), QStringLiteral("heading"),   QStringLiteral("taskItem"),
        QStringLiteral("listItem"),  QStringLiteral("blockquote"), QStringLiteral("codeBlock"),
        QStringLiteral("table"),     QStringLiteral("detailsBlock")};
    QString out;
    for (const QJsonValue& v : kids) {
        const QJsonObject child = v.toObject();
        out += extractText(child);
        if (lineTypes.contains(typeOf(child))) out += QLatin1Char('\n');
    }
    return out;
}

// ── markdown ─────────────────────────────────────────────────────────────

QString mdMarks(QString text, const QJsonArray& marks)
{
    for (const QJsonValue& mv : marks) {
        const QJsonObject m = mv.toObject();
        const QString t = typeOf(m);
        if (t == u"bold") text = QStringLiteral("**%1**").arg(text);
        else if (t == u"italic") text = QStringLiteral("*%1*").arg(text);
        else if (t == u"strike") text = QStringLiteral("~~%1~~").arg(text);
        else if (t == u"code") text = QStringLiteral("`%1`").arg(text);
        else if (t == u"highlight") text = QStringLiteral("==%1==").arg(text);
        else if (t == u"link")
            text = QStringLiteral("[%1](%2)").arg(text, m.value(kAttrs).toObject().value(QStringLiteral("href")).toString());
    }
    return text;
}

QString mdInline(const QJsonArray& content)
{
    QString out;
    for (const QJsonValue& v : content) {
        const QJsonObject n = v.toObject();
        const QString t = typeOf(n);
        if (t == u"text") out += mdMarks(n.value(kText).toString(), n.value(kMarks).toArray());
        else if (t == u"hardBreak") out += QStringLiteral("  \n");
        else if (t == u"inlineCheckbox")
            out += n.value(kAttrs).toObject().value(QStringLiteral("checked")).toBool() ? QStringLiteral("[x]")
                                                                                        : QStringLiteral("[ ]");
    }
    return out;
}

QString mdBlocks(const QJsonArray& blocks, const QString& indent);

QString mdTable(const QJsonObject& node)
{
    QList<QStringList> rows;
    int cols = 0;
    for (const QJsonValue& rv : kidsOf(node)) {
        QStringList cells;
        for (const QJsonValue& cv : kidsOf(rv.toObject())) {
            QString cell = mdBlocks(kidsOf(cv.toObject()), {}).trimmed();
            cell.replace(QLatin1Char('\n'), QStringLiteral("<br>"));
            cell.replace(QLatin1Char('|'), QStringLiteral("\\|"));
            cells << cell;
        }
        cols = qMax(cols, int(cells.size()));
        rows << cells;
    }
    if (rows.isEmpty()) return {};
    QString out;
    for (int r = 0; r < rows.size(); ++r) {
        QStringList cells = rows[r];
        while (cells.size() < cols) cells << QString();
        out += QStringLiteral("| ") + cells.join(QStringLiteral(" | ")) + QStringLiteral(" |\n");
        if (r == 0) {
            QStringList sep;
            for (int i = 0; i < cols; ++i) sep << QStringLiteral("---");
            out += QStringLiteral("| ") + sep.join(QStringLiteral(" | ")) + QStringLiteral(" |\n");
        }
    }
    return out;
}

QString mdList(const QJsonObject& node, const QString& indent)
{
    const QString t = typeOf(node);
    int n = node.value(kAttrs).toObject().value(QStringLiteral("start")).toInt(1);
    QString out;
    for (const QJsonValue& iv : kidsOf(node)) {
        const QJsonObject item = iv.toObject();
        QString bullet;
        if (t == u"orderedList") bullet = QStringLiteral("%1. ").arg(n++);
        else if (t == u"taskList")
            bullet = item.value(kAttrs).toObject().value(QStringLiteral("checked")).toBool() ? QStringLiteral("- [x] ")
                                                                                              : QStringLiteral("- [ ] ");
        else bullet = QStringLiteral("- ");

        const QString childIndent = indent + QString(bullet.size() > 4 ? 2 : int(bullet.size()), QLatin1Char(' '));
        const QJsonArray kids = kidsOf(item);
        bool first = true;
        for (const QJsonValue& kv : kids) {
            const QJsonObject k = kv.toObject();
            if (first) {
                const QString body = mdBlocks(QJsonArray{k}, childIndent).trimmed();
                out += indent + bullet + body + QLatin1Char('\n');
                first = false;
            } else if (typeOf(k) == u"bulletList" || typeOf(k) == u"orderedList" || typeOf(k) == u"taskList") {
                out += mdList(k, childIndent);
            } else {
                out += QLatin1Char('\n') + childIndent + mdBlocks(QJsonArray{k}, childIndent).trimmed() + QLatin1Char('\n');
            }
        }
        if (first) out += indent + bullet.trimmed() + QLatin1Char('\n');
    }
    return out;
}

QString mdBlocks(const QJsonArray& blocks, const QString& indent)
{
    QStringList parts;
    for (const QJsonValue& v : blocks) {
        const QJsonObject n = v.toObject();
        const QString t = typeOf(n);
        if (t == u"paragraph") {
            parts << mdInline(kidsOf(n));
        } else if (t == u"heading") {
            const int level = qBound(1, n.value(kAttrs).toObject().value(QStringLiteral("level")).toInt(1), 6);
            parts << QString(level, QLatin1Char('#')) + QLatin1Char(' ') + mdInline(kidsOf(n)).trimmed();
        } else if (t == u"bulletList" || t == u"orderedList" || t == u"taskList") {
            QString l = mdList(n, {});
            l.chop(1);
            parts << l;
        } else if (t == u"codeBlock") {
            QString code;
            for (const QJsonValue& c : kidsOf(n)) code += c.toObject().value(kText).toString();
            const QString lang = n.value(kAttrs).toObject().value(QStringLiteral("language")).toString();
            parts << QStringLiteral("```%1\n%2\n```").arg(lang, code);
        } else if (t == u"blockquote") {
            const QString inner = mdBlocks(kidsOf(n), {}).trimmed();
            QStringList lines;
            for (const QString& l : inner.split(QLatin1Char('\n'))) lines << (l.isEmpty() ? QStringLiteral(">") : QStringLiteral("> ") + l);
            parts << lines.join(QLatin1Char('\n'));
        } else if (t == u"horizontalRule") {
            parts << QStringLiteral("---");
        } else if (t == u"table") {
            QString tbl = mdTable(n);
            tbl.chop(1);
            parts << tbl;
        } else if (t == u"detailsBlock") {
            const QString summary = n.value(kAttrs).toObject().value(QStringLiteral("summary")).toString(QStringLiteral("Hidden section"));
            parts << QStringLiteral("<details>\n<summary>%1</summary>\n\n%2\n</details>").arg(summary, mdBlocks(kidsOf(n), {}));
        } else if (n.contains(kContent)) {
            parts << mdBlocks(kidsOf(n), indent);
        }
    }
    // Indent continuation lines of multi-line blocks when nested in a list.
    QString joined = parts.join(QStringLiteral("\n\n"));
    if (!indent.isEmpty()) joined.replace(QLatin1Char('\n'), QLatin1Char('\n') + indent);
    return joined;
}

// ── HTML ─────────────────────────────────────────────────────────────────

QString htmlMarks(const QString& text, const QJsonArray& marks)
{
    QString h = escapeHtml(text);
    for (const QJsonValue& mv : marks) {
        const QJsonObject m = mv.toObject();
        const QString t = typeOf(m);
        if (t == u"bold") h = QStringLiteral("<strong>%1</strong>").arg(h);
        else if (t == u"italic") h = QStringLiteral("<em>%1</em>").arg(h);
        else if (t == u"underline") h = QStringLiteral("<u>%1</u>").arg(h);
        else if (t == u"strike") h = QStringLiteral("<s>%1</s>").arg(h);
        else if (t == u"highlight") h = QStringLiteral("<mark>%1</mark>").arg(h);
        else if (t == u"code") h = QStringLiteral("<code>%1</code>").arg(h);
        else if (t == u"link")
            h = QStringLiteral("<a href=\"%1\">%2</a>")
                    .arg(escapeHtml(m.value(kAttrs).toObject().value(QStringLiteral("href")).toString()), h);
    }
    return h;
}

QString htmlNode(const QJsonObject& n)
{
    const QString t = typeOf(n);
    if (t == u"text") return htmlMarks(n.value(kText).toString(), n.value(kMarks).toArray());
    QString kids;
    for (const QJsonValue& v : kidsOf(n)) kids += htmlNode(v.toObject());
    const QJsonObject a = n.value(kAttrs).toObject();

    if (t == u"doc") return kids;
    if (t == u"paragraph") return QStringLiteral("<p>%1</p>").arg(kids.isEmpty() ? QStringLiteral("<br>") : kids);
    if (t == u"heading") {
        const int l = qBound(1, a.value(QStringLiteral("level")).toInt(1), 6);
        return QStringLiteral("<h%1>%2</h%1>").arg(l).arg(kids);
    }
    if (t == u"bulletList") return QStringLiteral("<ul>%1</ul>").arg(kids);
    if (t == u"orderedList") {
        const int start = a.value(QStringLiteral("start")).toInt(1);
        return start != 1 ? QStringLiteral("<ol start=\"%1\">%2</ol>").arg(start).arg(kids)
                          : QStringLiteral("<ol>%1</ol>").arg(kids);
    }
    if (t == u"listItem") return QStringLiteral("<li>%1</li>").arg(kids);
    if (t == u"taskList") return QStringLiteral("<ul class=\"task-list\">%1</ul>").arg(kids);
    if (t == u"taskItem") {
        const bool c = a.value(QStringLiteral("checked")).toBool();
        return QStringLiteral("<li class=\"task-item%1\"><input type=\"checkbox\" disabled%2> %3</li>")
            .arg(c ? QStringLiteral(" done") : QString(), c ? QStringLiteral(" checked") : QString(), kids);
    }
    if (t == u"codeBlock") {
        QString code;
        for (const QJsonValue& v : kidsOf(n)) code += v.toObject().value(kText).toString();
        return QStringLiteral("<pre><code>%1</code></pre>").arg(escapeHtml(code));
    }
    if (t == u"blockquote") return QStringLiteral("<blockquote>%1</blockquote>").arg(kids);
    if (t == u"horizontalRule") return QStringLiteral("<hr>");
    if (t == u"hardBreak") return QStringLiteral("<br>");
    if (t == u"inlineCheckbox")
        return a.value(QStringLiteral("checked")).toBool() ? QStringLiteral("<input type=\"checkbox\" checked disabled>")
                                                           : QStringLiteral("<input type=\"checkbox\" disabled>");
    if (t == u"table") return QStringLiteral("<table>%1</table>").arg(kids);
    if (t == u"tableRow") return QStringLiteral("<tr>%1</tr>").arg(kids);
    if (t == u"tableHeader" || t == u"tableCell") {
        const QString tag = t == u"tableHeader" ? QStringLiteral("th") : QStringLiteral("td");
        QString span;
        if (a.value(QStringLiteral("colspan")).toInt(1) > 1) span += QStringLiteral(" colspan=\"%1\"").arg(a.value(QStringLiteral("colspan")).toInt());
        if (a.value(QStringLiteral("rowspan")).toInt(1) > 1) span += QStringLiteral(" rowspan=\"%1\"").arg(a.value(QStringLiteral("rowspan")).toInt());
        return QStringLiteral("<%1%2>%3</%1>").arg(tag, span, kids);
    }
    if (t == u"detailsBlock") {
        return QStringLiteral("<details open><summary>%1</summary>%2</details>")
            .arg(escapeHtml(a.value(QStringLiteral("summary")).toString(QStringLiteral("Hidden section"))), kids);
    }
    return kids;
}

}  // namespace

QString escapeHtml(const QString& s)
{
    QString out = s;
    out.replace(QLatin1Char('&'), QStringLiteral("&amp;"));
    out.replace(QLatin1Char('<'), QStringLiteral("&lt;"));
    out.replace(QLatin1Char('>'), QStringLiteral("&gt;"));
    out.replace(QLatin1Char('"'), QStringLiteral("&quot;"));
    return out;
}

QString toPlainText(const QJsonObject& doc)
{
    return extractText(doc).trimmed();
}

QString toMarkdown(const QJsonObject& doc)
{
    return mdBlocks(kidsOf(doc), {}).trimmed() + QLatin1Char('\n');
}

QString toHtmlBody(const QJsonObject& doc)
{
    return htmlNode(doc);
}

QString toHtmlDocument(const QJsonObject& doc, const QString& title, bool wordCompatible)
{
    static const QString css = QStringLiteral(R"(
  body { font-family: 'Inter', 'Segoe UI', -apple-system, sans-serif; font-size: 15px; line-height: 1.65;
         color: #1c2024; max-width: 760px; margin: 48px auto; padding: 0 32px; }
  h1.note-title { font-size: 30px; letter-spacing: -0.02em; margin: 0 0 24px; }
  h1 { font-size: 26px; } h2 { font-size: 21px; } h3 { font-size: 17px; }
  code { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 0.87em; background: #f0f0f3;
         color: #a41a00; padding: 1px 5px; border-radius: 4px; }
  pre { background: #f0f0f3; padding: 16px 20px; border-radius: 10px; overflow-x: auto; }
  pre code { background: none; color: inherit; padding: 0; }
  blockquote { margin: 0; padding-left: 16px; border-left: 3px solid #f9b6a5; color: #60646c; font-style: italic; }
  mark { background: #ffe99a; border-radius: 3px; padding: 0 2px; }
  a { color: #ce2100; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #e0e1e6; padding: 8px 12px; text-align: left; vertical-align: top; }
  th { background: #f9f9fb; font-weight: 600; }
  ul.task-list { list-style: none; padding-left: 4px; }
  li.task-item.done { color: #80838d; text-decoration: line-through; }
  hr { border: none; border-top: 1px solid #e0e1e6; margin: 24px 0; }
)");
    const QString head = wordCompatible
        ? QStringLiteral("<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
                         "xmlns:w=\"urn:schemas-microsoft-com:office:word\" xmlns=\"http://www.w3.org/TR/REC-html40\">")
        : QStringLiteral("<!DOCTYPE html>\n<html lang=\"en\">");
    return QStringLiteral("%1\n<head>\n<meta charset=\"utf-8\">\n<title>%2</title>\n<style>%3</style>\n</head>\n"
                          "<body>\n<h1 class=\"note-title\">%2</h1>\n%4\n</body>\n</html>\n")
        .arg(head, escapeHtml(title), css, toHtmlBody(doc));
}

}  // namespace noted::doc
