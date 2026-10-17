#include "SpellChecker.h"

#include <QDebug>
#include <QLocale>

#ifdef Q_OS_WIN
#include <windows.h>
#include <objbase.h>
#include <spellcheck.h>
#endif

namespace {
SpellChecker* g_instance = nullptr;
}

struct SpellChecker::Impl
{
#ifdef Q_OS_WIN
    ISpellChecker* checker = nullptr;
#endif
    QString language;
};

SpellChecker::SpellChecker(QObject* parent)
    : QObject(parent)
    , d(std::make_unique<Impl>())
{
    g_instance = this;
#ifdef Q_OS_WIN
    // The GUI thread already has COM; this is a no-op there.
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    ISpellCheckerFactory* factory = nullptr;
    if (FAILED(CoCreateInstance(__uuidof(SpellCheckerFactory), nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&factory)))) {
        qInfo() << "spellcheck: no system spell checker";
        return;
    }
    // The system language if Windows has a dictionary for it, else US English.
    for (const QString& tag : {QLocale::system().name().replace(QLatin1Char('_'), QLatin1Char('-')), QStringLiteral("en-US")}) {
        BOOL ok = FALSE;
        const std::wstring w = tag.toStdWString();
        if (SUCCEEDED(factory->IsSupported(w.c_str(), &ok)) && ok
            && SUCCEEDED(factory->CreateSpellChecker(w.c_str(), &d->checker))) {
            d->language = QLocale(tag).nativeLanguageName() + QStringLiteral(" (") + QLocale(tag).nativeTerritoryName() + QLatin1Char(')');
            break;
        }
    }
    factory->Release();
    if (!d->checker) qInfo() << "spellcheck: no dictionary for" << QLocale::system().name();
#endif
}

SpellChecker::~SpellChecker()
{
#ifdef Q_OS_WIN
    if (d->checker) d->checker->Release();
#endif
    if (g_instance == this) g_instance = nullptr;
}

SpellChecker* SpellChecker::instance() { return g_instance; }

bool SpellChecker::available() const
{
#ifdef Q_OS_WIN
    return d->checker != nullptr;
#else
    return false;
#endif
}

QString SpellChecker::language() const { return d->language; }

QVector<SpellChecker::Miss> SpellChecker::check(const QString& text) const
{
    QVector<Miss> out;
#ifdef Q_OS_WIN
    if (!d->checker || text.trimmed().isEmpty()) return out;
    const std::wstring w = text.toStdWString();
    IEnumSpellingError* errors = nullptr;
    if (FAILED(d->checker->Check(w.c_str(), &errors)) || !errors) return out;
    ISpellingError* e = nullptr;
    while (errors->Next(&e) == S_OK) {
        ULONG start = 0, length = 0;
        CORRECTIVE_ACTION action = CORRECTIVE_ACTION_NONE;
        e->get_StartIndex(&start);
        e->get_Length(&length);
        e->get_CorrectiveAction(&action);
        e->Release();
        if (action != CORRECTIVE_ACTION_NONE && length > 0) out.append({int(start), int(length)});
    }
    errors->Release();
#else
    Q_UNUSED(text)
#endif
    return out;
}

QStringList SpellChecker::suggest(const QString& word) const
{
    QStringList out;
#ifdef Q_OS_WIN
    if (!d->checker || word.isEmpty()) return out;
    const std::wstring w = word.toStdWString();
    IEnumString* list = nullptr;
    if (FAILED(d->checker->Suggest(w.c_str(), &list)) || !list) return out;
    LPOLESTR s = nullptr;
    while (out.size() < 6 && list->Next(1, &s, nullptr) == S_OK) {
        out << QString::fromWCharArray(s);
        CoTaskMemFree(s);
    }
    list->Release();
#else
    Q_UNUSED(word)
#endif
    return out;
}

void SpellChecker::addToDictionary(const QString& word)
{
#ifdef Q_OS_WIN
    if (!d->checker || word.isEmpty()) return;
    d->checker->Add(word.toStdWString().c_str());
    emit wordsChanged();
#else
    Q_UNUSED(word)
#endif
}

void SpellChecker::ignore(const QString& word)
{
#ifdef Q_OS_WIN
    if (!d->checker || word.isEmpty()) return;
    d->checker->Ignore(word.toStdWString().c_str());
    emit wordsChanged();
#else
    Q_UNUSED(word)
#endif
}
