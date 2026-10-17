#include "noted/sync/Crypto.h"

#include <QRandomGenerator>

#include <cstring>

#include <vector>

extern "C" {
#include "monocypher/monocypher.h"
}

namespace noted::sync {

namespace {
const QByteArray kMagic("NSY1");
constexpr int kNonce = 24;
constexpr int kMac = 16;
const char kAlphabet[] = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";  // Crockford: no I, L, O, U
}  // namespace

QByteArray randomBytes(int n)
{
    QByteArray out(n, Qt::Uninitialized);
    QRandomGenerator::system()->generate(reinterpret_cast<quint32*>(out.data()),
                                         reinterpret_cast<quint32*>(out.data()) + n / 4);
    for (int i = n - n % 4; i < n; ++i) out[i] = char(QRandomGenerator::system()->generate() & 0xff);
    return out;
}

QByteArray deriveKey(const QString& passphrase, const QByteArray& salt)
{
    const QByteArray pass = passphrase.toUtf8();
    crypto_argon2_config config{CRYPTO_ARGON2_ID, 32 * 1024, 3, 1};  // 32 MiB, 3 passes
    crypto_argon2_inputs inputs{reinterpret_cast<const uint8_t*>(pass.constData()),
                                reinterpret_cast<const uint8_t*>(salt.constData()), uint32_t(pass.size()),
                                uint32_t(salt.size())};
    std::vector<uint8_t> work(size_t(config.nb_blocks) * 1024);
    QByteArray key(kKeySize, Qt::Uninitialized);
    crypto_argon2(reinterpret_cast<uint8_t*>(key.data()), kKeySize, work.data(), config, inputs,
                  crypto_argon2_no_extras);
    crypto_wipe(work.data(), work.size());
    return key;
}

QByteArray seal(const QByteArray& key, const QByteArray& plain, const QByteArray& ad)
{
    Q_ASSERT(key.size() == kKeySize);
    const QByteArray nonce = randomBytes(kNonce);
    QByteArray out = kMagic + nonce + QByteArray(kMac, '\0') + QByteArray(plain.size(), Qt::Uninitialized);
    auto* mac = reinterpret_cast<uint8_t*>(out.data()) + kMagic.size() + kNonce;
    crypto_aead_lock(mac + kMac, mac, reinterpret_cast<const uint8_t*>(key.constData()),
                     reinterpret_cast<const uint8_t*>(nonce.constData()),
                     reinterpret_cast<const uint8_t*>(ad.constData()), size_t(ad.size()),
                     reinterpret_cast<const uint8_t*>(plain.constData()), size_t(plain.size()));
    return out;
}

std::optional<QByteArray> open(const QByteArray& key, const QByteArray& sealed, const QByteArray& ad)
{
    const int head = int(kMagic.size()) + kNonce + kMac;
    if (key.size() != kKeySize || sealed.size() < head || !sealed.startsWith(kMagic)) return std::nullopt;
    const auto* p = reinterpret_cast<const uint8_t*>(sealed.constData());
    QByteArray plain(sealed.size() - head, Qt::Uninitialized);
    if (crypto_aead_unlock(reinterpret_cast<uint8_t*>(plain.data()), p + kMagic.size() + kNonce,
                           reinterpret_cast<const uint8_t*>(key.constData()), p + kMagic.size(),
                           reinterpret_cast<const uint8_t*>(ad.constData()), size_t(ad.size()), p + head,
                           size_t(plain.size())) != 0)
        return std::nullopt;
    return plain;
}

QString keyToCode(const QByteArray& key)
{
    QString out;
    quint32 buffer = 0;
    int bits = 0;
    for (char c : key) {
        buffer = (buffer << 8) | quint8(c);
        bits += 8;
        while (bits >= 5) {
            out += QLatin1Char(kAlphabet[(buffer >> (bits - 5)) & 31]);
            bits -= 5;
        }
    }
    if (bits > 0) out += QLatin1Char(kAlphabet[(buffer << (5 - bits)) & 31]);
    QString grouped;
    for (int i = 0; i < out.size(); i += 4) {
        if (i) grouped += QLatin1Char('-');
        grouped += out.mid(i, 4);
    }
    return grouped;
}

std::optional<QByteArray> codeToKey(const QString& code)
{
    QByteArray out;
    quint32 buffer = 0;
    int bits = 0;
    for (QChar ch : code.toUpper()) {
        if (ch == u'-' || ch.isSpace()) continue;
        if (ch == u'O') ch = u'0';
        if (ch == u'I' || ch == u'L') ch = u'1';
        const char* at = strchr(kAlphabet, ch.toLatin1());
        if (!at || !*at) return std::nullopt;
        buffer = (buffer << 5) | quint32(at - kAlphabet);
        bits += 5;
        if (bits >= 8) {
            out += char((buffer >> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    if (out.size() != kKeySize) return std::nullopt;
    return out;
}

}  // namespace noted::sync
