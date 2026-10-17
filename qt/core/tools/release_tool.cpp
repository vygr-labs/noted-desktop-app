// noted-release: the signing half of updates.
//
//   noted-release genkey <keyfile>              new signing key; prints the public key
//   noted-release pubkey <keyfile>              prints the public key again
//   noted-release sign <keyfile> <in> <out>     signs an update manifest
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

using namespace noted::sync;

namespace {

QTextStream out(stdout), err(stderr);

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
    err << "usage: noted-release genkey|pubkey <keyfile> | sign <keyfile> <manifest.json> <out.json>\n";
    return 2;
}
