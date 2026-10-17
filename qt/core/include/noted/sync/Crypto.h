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

// Signatures (EdDSA, curve25519 + BLAKE2b): updates are signed with a key
// kept off this repo, and the app checks them against the public half.
struct SigningKeys
{
    QByteArray secret;  // 64 bytes
    QByteArray pub;     // 32 bytes
};
SigningKeys signingKeys(const QByteArray& seed);  // seed: 32 random bytes
QByteArray sign(const QByteArray& secret, const QByteArray& message);
bool verify(const QByteArray& pub, const QByteArray& message, const QByteArray& signature);

// A key as something a person can paste: groups of four, Crockford base32.
QString keyToCode(const QByteArray& key);
std::optional<QByteArray> codeToKey(const QString& code);

}  // namespace noted::sync
