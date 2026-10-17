#pragma once

#include <QJsonArray>
#include <QObject>
#include <QPointer>

class QQmlEngine;
class QQuickWindow;

// Plays a script of input against the main window, for checking interactive
// behaviour in dev builds (`--drive steps.json`, with `--screenshot`'s
// placement). Input goes through QWindowSystemInterface, so it takes the same
// path as real input: shortcuts, popups' close-on-press-outside, grabs.
//
//   [ {"wait": 300},
//     {"click": [x, y], "button": "right", "mods": "ctrl"},   // window coordinates
//     {"key": "Ctrl+F"}, {"type": "hello"},
//     {"eval": "AppState.findOpen"},                           // logged
//     {"shot": "C:/…/a.png"},
//     {"activate": true} ]                                     // keys need a focused window
class DevDriver : public QObject
{
    Q_OBJECT
public:
    DevDriver(QQuickWindow* window, QQmlEngine* engine, const QJsonArray& steps, QObject* parent = nullptr);
    void start(int delayMs);

private:
    void next();
    void mouse(const QPointF& logical, Qt::MouseButton button, Qt::KeyboardModifiers mods);
    void key(int key, Qt::KeyboardModifiers mods, const QString& text);

    QPointer<QQuickWindow> m_window;
    QQmlEngine* m_engine = nullptr;
    QJsonArray m_steps;
    int m_at = 0;
};
