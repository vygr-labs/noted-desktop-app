#pragma once

// Encryption for everything noted writes into a sync folder. The folder lives
// in someone's cloud drive and notes hold passwords, so nothing leaves this
// computer in the clear. Monocypher underneath: Argon2id for passphrases,
// XChaCha20-Poly1305 for files.

#include <QByteArray>
#include <QString>

#include <optional>

namespace noted::sync {

constexpr int kKeySize = 32;

QByteArray randomBytes(int n);

// A 32-byte key from a passphrase. Slow on purpose (about half a second).
QByteArray deriveKey(const QString& passphrase, const QByteArray& salt);

// "NSY1" + nonce + MAC + ciphertext. `ad` (say, the file's name) is
// authenticated but not stored, so a file can't be passed off as another.
QByteArray seal(const QByteArray& key, const QByteArray& plain, const QByteArray& ad = {});
std::optional<QByteArray> open(const QByteArray& key, const QByteArray& sealed, const QByteArray& ad = {});

// A key as something a person can paste: groups of four, Crockford base32.
QString keyToCode(const QByteArray& key);
std::optional<QByteArray> codeToKey(const QString& code);

}  // namespace noted::sync
