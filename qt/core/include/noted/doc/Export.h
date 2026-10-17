#pragma once

// Converters from TipTap JSON to other text formats.

#include <QJsonObject>
#include <QString>

namespace noted::doc {

// Mirrors app/src/lib/tiptap-to-plaintext.ts exactly: this is what goes into
// notes.content_plain (FTS + previews), which noted-cli and the Electron build
// also write. Changing it makes search results drift between builds.
QString toPlainText(const QJsonObject& doc);

// GitHub-flavoured markdown. Nested lists are indented, task items become
// `- [ ]`/`- [x]`, tables become pipe tables.
QString toMarkdown(const QJsonObject& doc);

// HTML body fragment (no <html> wrapper).
QString toHtmlBody(const QJsonObject& doc);

// A standalone, styled HTML document — used for HTML/Word/PDF export.
// `wordCompatible` adds the Office namespaces so Word opens it as a .doc.
QString toHtmlDocument(const QJsonObject& doc, const QString& title, bool wordCompatible = false);

QString escapeHtml(const QString& s);

}  // namespace noted::doc
