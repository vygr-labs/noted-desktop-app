#include "DevDriver.h"

#include <QCoreApplication>
#include <QGuiApplication>
#include <QJsonObject>
#include <QKeySequence>
#include <QMimeData>
#include <QUrl>
#include <qpa/qplatformdrag.h>
#include <QQmlContext>
#include <QQmlEngine>
#include <QQmlExpression>
#include <QQuickItem>
#include <QQuickWindow>
#include <QTimer>
#include <qpa/qwindowsysteminterface.h>

DevDriver::DevDriver(QQuickWindow* window, QQmlEngine* engine, const QJsonArray& steps, QObject* parent)
    : QObject(parent), m_window(window), m_engine(engine), m_steps(steps)
{
}

void DevDriver::start(int delayMs)
{
    QTimer::singleShot(delayMs, this, &DevDriver::next);
}

static Qt::KeyboardModifiers modsOf(const QString& s)
{
    Qt::KeyboardModifiers m;
    if (s.contains(QLatin1String("ctrl"))) m |= Qt::ControlModifier;
    if (s.contains(QLatin1String("shift"))) m |= Qt::ShiftModifier;
    if (s.contains(QLatin1String("alt"))) m |= Qt::AltModifier;
    return m;
}

// The system interface takes native (device) pixels; steps use the window's.
static QPointF native(QWindow* w, const QPointF& p) { return p * w->devicePixelRatio(); }

void DevDriver::mouse(const QPointF& logical, Qt::MouseButton button, Qt::KeyboardModifiers mods)
{
    const QPointF at = native(m_window, logical);
    const QPointF global = native(m_window, m_window->mapToGlobal(logical));
    QWindowSystemInterface::handleMouseEvent(m_window, at, global, Qt::NoButton, Qt::NoButton, QEvent::MouseMove, mods);
    QWindowSystemInterface::handleMouseEvent(m_window, at, global, button, button, QEvent::MouseButtonPress, mods);
    QWindowSystemInterface::handleMouseEvent(m_window, at, global, Qt::NoButton, button, QEvent::MouseButtonRelease, mods);
}

void DevDriver::key(int k, Qt::KeyboardModifiers mods, const QString& text)
{
    QWindowSystemInterface::handleKeyEvent(m_window, QEvent::KeyPress, k, mods, text);
    QWindowSystemInterface::handleKeyEvent(m_window, QEvent::KeyRelease, k, mods, text);
}

void DevDriver::next()
{
    if (!m_window) return;
    if (m_at >= m_steps.size()) {
        QCoreApplication::quit();
        return;
    }
    const QJsonObject s = m_steps.at(m_at++).toObject();
    int wait = 120;
    if (s.contains(QLatin1String("wait"))) {
        wait = s.value(QLatin1String("wait")).toInt();
    } else if (s.contains(QLatin1String("click"))) {
        const QJsonArray p = s.value(QLatin1String("click")).toArray();
        const QString b = s.value(QLatin1String("button")).toString();
        const Qt::MouseButton button = b == u"right" ? Qt::RightButton : b == u"middle" ? Qt::MiddleButton : Qt::LeftButton;
        mouse(QPointF(p.at(0).toDouble(), p.at(1).toDouble()), button, modsOf(s.value(QLatin1String("mods")).toString()));
    } else if (s.contains(QLatin1String("move"))) {
        const QJsonArray p = s.value(QLatin1String("move")).toArray();
        const QPointF at(p.at(0).toDouble(), p.at(1).toDouble());
        QWindowSystemInterface::handleMouseEvent(m_window, native(m_window, at), native(m_window, m_window->mapToGlobal(at)),
                                                 Qt::NoButton, Qt::NoButton, QEvent::MouseMove);
    } else if (s.contains(QLatin1String("key"))) {
        const QKeySequence seq(s.value(QLatin1String("key")).toString());
        if (!seq.isEmpty()) {
            const QKeyCombination c = seq[0];
            // Windows reports Shift+Tab as Backtab; send what a keyboard would.
            const int k = c.key() == Qt::Key_Tab && (c.keyboardModifiers() & Qt::ShiftModifier) ? int(Qt::Key_Backtab) : int(c.key());
            const QString text = (c.keyboardModifiers() & ~Qt::ShiftModifier) || k > 0xff ? QString() : QString(QChar(k)).toLower();
            key(k, c.keyboardModifiers(), text);
        }
    } else if (s.contains(QLatin1String("type"))) {
        for (const QChar ch : s.value(QLatin1String("type")).toString()) key(ch.toUpper().unicode(), Qt::NoModifier, QString(ch));
    } else if (s.contains(QLatin1String("drop"))) {
        // {"drop": [x, y], "files": ["C:/…"]}: drag files in and let go.
        const QJsonArray p = s.value(QLatin1String("drop")).toArray();
        const QPointF at = native(m_window, QPointF(p.at(0).toDouble(), p.at(1).toDouble()));
        QList<QUrl> urls;
        for (const QJsonValue& f : s.value(QLatin1String("files")).toArray()) urls << QUrl::fromLocalFile(f.toString());
        QMimeData mime;
        mime.setUrls(urls);
        QWindowSystemInterface::handleDrag(m_window, &mime, at.toPoint(), Qt::CopyAction, Qt::LeftButton, Qt::NoModifier);
        QWindowSystemInterface::handleDrop(m_window, &mime, at.toPoint(), Qt::CopyAction, Qt::LeftButton, Qt::NoModifier);
    } else if (s.contains(QLatin1String("eval"))) {
        // Main.qml's own context, so its imports (AppState, Store…) resolve.
        QQmlContext* ctx = qmlContext(m_window.data());
        QQmlExpression e(ctx ? ctx : m_engine->rootContext(), m_window.data(), s.value(QLatin1String("eval")).toString());
        const QVariant v = e.evaluate();
        qInfo().noquote() << "eval" << s.value(QLatin1String("eval")).toString() << "=>"
                          << (e.hasError() ? e.error().toString() : v.toString());
    } else if (s.contains(QLatin1String("shot"))) {
        m_window->grabWindow().save(s.value(QLatin1String("shot")).toString());
    } else if (s.contains(QLatin1String("activate"))) {
        m_window->setFlag(Qt::WindowDoesNotAcceptFocus, false);
        m_window->requestActivate();
        wait = 300;
    }
    QTimer::singleShot(wait, this, &DevDriver::next);
}
