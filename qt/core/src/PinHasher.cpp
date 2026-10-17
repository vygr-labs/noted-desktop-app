#include "noted/PinHasher.h"

#include <QCryptographicHash>
#include <QPasswordDigestor>
#include <QRandomGenerator>

#include <cstring>
#include <vector>

namespace noted {

namespace {

inline quint32 rotl(quint32 a, int b) { return (a << b) | (a >> (32 - b)); }

void salsa20_8(quint32 B[16])
{
    quint32 x[16];
    std::memcpy(x, B, sizeof(x));
    for (int i = 0; i < 8; i += 2) {
        x[4] ^= rotl(x[0] + x[12], 7);   x[8] ^= rotl(x[4] + x[0], 9);
        x[12] ^= rotl(x[8] + x[4], 13);  x[0] ^= rotl(x[12] + x[8], 18);
        x[9] ^= rotl(x[5] + x[1], 7);    x[13] ^= rotl(x[9] + x[5], 9);
        x[1] ^= rotl(x[13] + x[9], 13);  x[5] ^= rotl(x[1] + x[13], 18);
        x[14] ^= rotl(x[10] + x[6], 7);  x[2] ^= rotl(x[14] + x[10], 9);
        x[6] ^= rotl(x[2] + x[14], 13);  x[10] ^= rotl(x[6] + x[2], 18);
        x[3] ^= rotl(x[15] + x[11], 7);  x[7] ^= rotl(x[3] + x[15], 9);
        x[11] ^= rotl(x[7] + x[3], 13);  x[15] ^= rotl(x[11] + x[7], 18);
        x[1] ^= rotl(x[0] + x[3], 7);    x[2] ^= rotl(x[1] + x[0], 9);
        x[3] ^= rotl(x[2] + x[1], 13);   x[0] ^= rotl(x[3] + x[2], 18);
        x[6] ^= rotl(x[5] + x[4], 7);    x[7] ^= rotl(x[6] + x[5], 9);
        x[4] ^= rotl(x[7] + x[6], 13);   x[5] ^= rotl(x[4] + x[7], 18);
        x[11] ^= rotl(x[10] + x[9], 7);  x[8] ^= rotl(x[11] + x[10], 9);
        x[9] ^= rotl(x[8] + x[11], 13);  x[10] ^= rotl(x[9] + x[8], 18);
        x[12] ^= rotl(x[15] + x[14], 7); x[13] ^= rotl(x[12] + x[15], 9);
        x[14] ^= rotl(x[13] + x[12], 13); x[15] ^= rotl(x[14] + x[13], 18);
    }
    for (int i = 0; i < 16; ++i) B[i] += x[i];
}

// BlockMix_salsa20/8 over 2r 64-byte blocks (as 32-bit words).
void blockMix(const quint32* B, quint32* Y, int r)
{
    quint32 X[16];
    std::memcpy(X, &B[(2 * r - 1) * 16], 64);
    for (int i = 0; i < 2 * r; ++i) {
        for (int j = 0; j < 16; ++j) X[j] ^= B[i * 16 + j];
        salsa20_8(X);
        // Even blocks go to the first half, odd to the second.
        std::memcpy(&Y[((i / 2) + (i % 2) * r) * 16], X, 64);
    }
}

void roMix(quint32* B, int r, int N)
{
    const int words = 32 * r;
    std::vector<quint32> V(size_t(words) * N);
    std::vector<quint32> X(B, B + words), Y(words);
    for (int i = 0; i < N; ++i) {
        std::memcpy(&V[size_t(i) * words], X.data(), words * 4);
        blockMix(X.data(), Y.data(), r);
        X.swap(Y);
    }
    for (int i = 0; i < N; ++i) {
        const quint32 j = X[(2 * r - 1) * 16] & quint32(N - 1);
        for (int k = 0; k < words; ++k) X[k] ^= V[size_t(j) * words + k];
        blockMix(X.data(), Y.data(), r);
        X.swap(Y);
    }
    std::memcpy(B, X.data(), words * 4);
}

}  // namespace

QByteArray scrypt(const QByteArray& password, const QByteArray& salt, int N, int r, int p, int dkLen)
{
    const int blockBytes = 128 * r;
    QByteArray B = QPasswordDigestor::deriveKeyPbkdf2(QCryptographicHash::Sha256, password, salt, 1, quint64(p) * blockBytes);
    std::vector<quint32> words(size_t(32) * r);
    for (int i = 0; i < p; ++i) {
        auto* chunk = reinterpret_cast<uchar*>(B.data()) + size_t(i) * blockBytes;
        for (int k = 0; k < 32 * r; ++k)  // little-endian decode
            words[k] = quint32(chunk[4 * k]) | quint32(chunk[4 * k + 1]) << 8 | quint32(chunk[4 * k + 2]) << 16
                       | quint32(chunk[4 * k + 3]) << 24;
        roMix(words.data(), r, N);
        for (int k = 0; k < 32 * r; ++k) {
            chunk[4 * k] = uchar(words[k]);
            chunk[4 * k + 1] = uchar(words[k] >> 8);
            chunk[4 * k + 2] = uchar(words[k] >> 16);
            chunk[4 * k + 3] = uchar(words[k] >> 24);
        }
    }
    return QPasswordDigestor::deriveKeyPbkdf2(QCryptographicHash::Sha256, password, B, 1, quint64(dkLen));
}

QString hashPin(const QString& pin, const QString& salt)
{
    return QString::fromLatin1(scrypt(pin.toUtf8(), salt.toUtf8(), 16384, 8, 1, 64).toHex());
}

QString newPinSalt()
{
    QByteArray bytes(16, Qt::Uninitialized);
    QRandomGenerator::system()->fillRange(reinterpret_cast<quint32*>(bytes.data()), 4);
    return QString::fromLatin1(bytes.toHex());
}

}  // namespace noted
