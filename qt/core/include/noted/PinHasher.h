#pragma once

#include <QByteArray>
#include <QString>

namespace noted {

// scrypt, byte-compatible with Node's crypto.scryptSync(pin, salt, 64) using
// its defaults (N=16384, r=8, p=1). The Electron build stored lock PINs that
// way, so existing PINs keep working. Salt is the hex string itself (as Node
// was handed a string, it hashes its UTF-8 bytes).
QByteArray scrypt(const QByteArray& password, const QByteArray& salt, int N, int r, int p, int dkLen);

QString hashPin(const QString& pin, const QString& salt);  // hex, 128 chars
QString newPinSalt();                                       // 32 hex chars

}  // namespace noted
