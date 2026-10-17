#pragma once

// Spelling, through the system's own checker: on Windows the one Edge and
// Office use (ISpellChecker), with its dictionaries and the words people
// have added there. Elsewhere it reports itself unavailable for now.
//
// Notes opt in one at a time (the note's ⋯ menu); the editor asks this for
// the misspelled words in each paragraph and draws the underlines itself.

#include <QObject>
#include <QStringList>
#include <QVector>

#include <memory>

class SpellChecker : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool available READ available CONSTANT)
    Q_PROPERTY(QString language READ language CONSTANT)  // "English (United States)"

public:
    explicit SpellChecker(QObject* parent = nullptr);
    ~SpellChecker() override;
    static SpellChecker* instance();

    bool available() const;
    QString language() const;

    struct Miss
    {
        int start, length;
    };
    QVector<Miss> check(const QString& text) const;

    Q_INVOKABLE QStringList suggest(const QString& word) const;
    Q_INVOKABLE void addToDictionary(const QString& word);  // for good, in Windows' own word list
    Q_INVOKABLE void ignore(const QString& word);           // until noted quits

signals:
    void wordsChanged();  // added or ignored: underlines need redoing

private:
    struct Impl;
    std::unique_ptr<Impl> d;
};
