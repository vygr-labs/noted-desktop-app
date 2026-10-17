#pragma once

// TipTap (ProseMirror) JSON  <->  QTextDocument.
//
// load() writes only the SEMANTIC layer (see Schema.h); run DocumentStyler
// afterwards to make it look right. save() reads only the semantic layer, so
// `save(load(json)) == json` for every node/mark noted produces — the
// round-trip test in core/tests checks this against real databases.

#include <QJsonObject>
#include <QString>

class QTextDocument;
class QTextCursor;

namespace noted::doc {

// Replaces `doc`'s contents with `json` (a {"type":"doc"} object). Undo
// history is cleared.
void load(QTextDocument* doc, const QJsonObject& json);

// Inserts the blocks of `json` at `cursor` (used for paste and templates).
void insert(QTextCursor& cursor, const QJsonObject& json);

QJsonObject save(const QTextDocument* doc);

// Exports the given character range [from, to) as a standalone doc. Partial
// blocks are trimmed to the selection; list/quote context is kept.
QJsonObject saveRange(const QTextDocument* doc, int from, int to);

// Converts a document produced by Qt's own importers (setMarkdown/setHtml)
// into noted's semantic layer in place: bold fonts become `bold` marks,
// monospace spans become `code`, <pre> becomes a code-block frame, and so on.
void semanticize(QTextDocument* doc);

// Convenience importers built on semanticize().
QJsonObject fromMarkdown(const QString& markdown);
QJsonObject fromHtml(const QString& html);
QJsonObject fromPlainText(const QString& text);  // one paragraph per line

QJsonObject emptyDoc();
QJsonObject parse(const QString& json);  // tolerant: invalid/empty → emptyDoc()
QString stringify(const QJsonObject& json);

// Heuristic used by paste: does this plain text look like markdown?
bool looksLikeMarkdown(const QString& text);

}  // namespace noted::doc
