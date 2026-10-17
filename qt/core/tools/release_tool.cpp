// noted-release: the signing half of updates.
//
//   noted-release genkey <keyfile>              new signing key; prints the public key
//   noted-release pubkey <keyfile>              prints the public key again
//   noted-release sign <keyfile> <in> <out>     signs an update manifest
//   noted-release backup <keyfile> <out>        the key, locked with a passphrase
//                                               (asked for here, never shown)
//   noted-release restore <backup> <keyfile>    the key back from such a backup
//
// The app only installs an update whose manifest (noted-update.json) carries
// a signature from this key, checked against the public key built into it
// (app/src/Updater.cpp). Keep the key file out of the repo, and backed up:
// without it no further update can be published to existing installs.

#include <QCoreApplication>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTextStream>

#include "noted/sync/Crypto.h"

#ifdef Q_OS_WIN
#include <conio.h>
#endif
#include <iostream>
#include <string>

using namespace noted::sync;

namespace {

QTextStream out(stdout), err(stderr);

// A line typed without echoing it.
QString askHidden(const QString& prompt)
{
    out << prompt << Qt::flush;
    QString s;
#ifdef Q_OS_WIN
    for (;;) {
        const wint_t ch = _getwch();
        if (ch == L'\r' || ch == L'\n') break;
        if (ch == 3) return {};  // Ctrl+C
        if (ch == L'\b') { if (!s.isEmpty()) s.chop(1); continue; }
        if (ch == 0 || ch == 0xE0) { _getwch(); continue; }  // arrow keys and the like
        s += QChar(char16_t(ch));
    }
#else
    std::string line;
    std::getline(std::cin, line);
    s = QString::fromStdString(line);
#endif
    out << "\n" << Qt::flush;
    return s;
}

const QByteArray kBackupAd("noted-update-signing-key");

QByteArray readSeed(const QString& path)
{
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return {};
    return QByteArray::fromBase64(f.readAll().trimmed());
}

}  // namespace

int main(int argc, char** argv)
{
    QCoreApplication app(argc, argv);
    const QStringList a = app.arguments();
    const QString cmd = a.value(1);
    if (cmd == u"genkey" && a.size() == 3) {
        if (QFile::exists(a[2])) { err << "refusing to overwrite " << a[2] << "\n"; return 1; }
        const QByteArray seed = randomBytes(32);
        QFile f(a[2]);
        if (!f.open(QIODevice::WriteOnly)) { err << "can't write " << a[2] << "\n"; return 1; }
        f.write(seed.toBase64() + "\n");
        out << signingKeys(seed).pub.toBase64() << "\n";
        return 0;
    }
    if (cmd == u"pubkey" && a.size() == 3) {
        const QByteArray seed = readSeed(a[2]);
        if (seed.size() != 32) { err << "not a key file: " << a[2] << "\n"; return 1; }
        out << signingKeys(seed).pub.toBase64() << "\n";
        return 0;
    }
    if (cmd == u"sign" && a.size() == 5) {
        const QByteArray seed = readSeed(a[2]);
        if (seed.size() != 32) { err << "not a key file: " << a[2] << "\n"; return 1; }
        QFile in(a[3]);
        if (!in.open(QIODevice::ReadOnly)) { err << "can't read " << a[3] << "\n"; return 1; }
        QJsonObject m = QJsonDocument::fromJson(in.readAll()).object();
        m.remove(QStringLiteral("sig"));
        // What's signed: the manifest's compact JSON (keys sorted, as Qt writes it).
        const QByteArray body = QJsonDocument(m).toJson(QJsonDocument::Compact);
        m.insert(QStringLiteral("sig"), QString::fromLatin1(sign(signingKeys(seed).secret, body).toBase64()));
        QFile o(a[4]);
        if (!o.open(QIODevice::WriteOnly)) { err << "can't write " << a[4] << "\n"; return 1; }
        o.write(QJsonDocument(m).toJson(QJsonDocument::Indented));
        return 0;
    }
    if (cmd == u"backup" && a.size() == 4) {
        const QByteArray seed = readSeed(a[2]);
        if (seed.size() != 32) { err << "not a key file: " << a[2] << "\n"; return 1; }
        out << "Choose a passphrase for this backup: at least 12 characters, one you'll remember\n"
               "or keep written down at home. Without it the backup can't be opened.\n\n";
        const QString pass = askHidden(QStringLiteral("Passphrase: "));
        if (pass.size() < 12) { err << "That's shorter than 12 characters. Nothing was written.\n"; return 1; }
        if (askHidden(QStringLiteral("Same again: ")) != pass) { err << "Those don't match. Nothing was written.\n"; return 1; }
        out << "Locking it (a few seconds)...\n" << Qt::flush;
        const QByteArray salt = randomBytes(16);
        const QJsonObject b{{"format", "noted-key-backup-1"},
                            {"what", "noted's update signing key. Restore with: noted-release restore <this file> <keyfile>"},
                            {"public", QString::fromLatin1(signingKeys(seed).pub.toBase64())},
                            {"salt", QString::fromLatin1(salt.toBase64())},
                            {"key", QString::fromLatin1(seal(deriveKey(pass, salt), seed, kBackupAd).toBase64())}};
        QFile o(a[3]);
        if (!o.open(QIODevice::WriteOnly)) { err << "can't write " << a[3] << "\n"; return 1; }
        o.write(QJsonDocument(b).toJson(QJsonDocument::Indented));
        o.close();
        // Prove it opens before calling it a backup.
        QFile back(a[3]);
        back.open(QIODevice::ReadOnly);
        const QJsonObject r = QJsonDocument::fromJson(back.readAll()).object();
        const auto again = open(deriveKey(pass, QByteArray::fromBase64(r.value("salt").toString().toLatin1())),
                                QByteArray::fromBase64(r.value("key").toString().toLatin1()), kBackupAd);
        if (!again || *again != seed) { err << "The backup didn't read back. Delete it and try again.\n"; return 1; }
        out << "Backed up and checked: " << a[3] << "\n";
        return 0;
    }
    if (cmd == u"restore" && a.size() == 4) {
        if (QFile::exists(a[3])) { err << "refusing to overwrite " << a[3] << "\n"; return 1; }
        QFile in(a[2]);
        if (!in.open(QIODevice::ReadOnly)) { err << "can't read " << a[2] << "\n"; return 1; }
        const QJsonObject b = QJsonDocument::fromJson(in.readAll()).object();
        const QString pass = askHidden(QStringLiteral("Passphrase: "));
        const auto seed = open(deriveKey(pass, QByteArray::fromBase64(b.value("salt").toString().toLatin1())),
                               QByteArray::fromBase64(b.value("key").toString().toLatin1()), kBackupAd);
        if (!seed || seed->size() != 32) { err << "That passphrase doesn't open this backup.\n"; return 1; }
        QFile o(a[3]);
        if (!o.open(QIODevice::WriteOnly)) { err << "can't write " << a[3] << "\n"; return 1; }
        o.write(seed->toBase64() + "\n");
        out << "Restored. Public key: " << signingKeys(*seed).pub.toBase64() << "\n";
        return 0;
    }
    err << "usage: noted-release genkey|pubkey <keyfile> | sign <keyfile> <manifest.json> <out.json>\n"
           "                     backup <keyfile> <out> | restore <backup> <keyfile>\n";
    return 2;
}
