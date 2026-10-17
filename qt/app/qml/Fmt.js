.pragma library

// Wording and spacing rules shared by the pages (see qt/DESIGN.md).

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// Database timestamps are UTC "yyyy-MM-dd HH:mm:ss" (or ISO).
function parseTs(ts) {
    if (!ts) return null
    if (ts instanceof Date) return ts
    let s = String(ts)
    if (/^\d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?$/.test(s)) s = s.replace(" ", "T") + "Z"
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
}
function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function isoOf(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") }
function fromIso(iso) { const p = iso.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]) }
function daysBetween(a, b) { return Math.round((dayStart(b) - dayStart(a)) / 86400000) }

// "12m ago", "9:40", "Yesterday", "Wed", "Oct 9", "Oct 9, 2025".
function edited(ts, now) {
    const d = parseTs(ts)
    if (!d) return ""
    now = now || new Date()
    const mins = Math.floor((now - d) / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return mins + "m ago"
    const days = daysBetween(d, now)
    if (days <= 0) return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0")
    if (days === 1) return "Yesterday"
    if (days < 7) return DOW[d.getDay()]
    const md = MON[d.getMonth()] + " " + d.getDate()
    return d.getFullYear() === now.getFullYear() ? md : md + ", " + d.getFullYear()
}
// "Edited 12m ago", "Edited yesterday", "Edited Wed".
function editedPhrase(ts) {
    const e = edited(ts)
    if (!e) return ""
    if (e === "Yesterday" || e === "Just now") return "Edited " + e.toLowerCase()
    if (/^\d+:\d\d$/.test(e)) return "Edited at " + e
    return "Edited " + e
}

// A folder path short enough for one line: "C:\…\OneDrive\noted".
function shortPath(p, max) {
    p = String(p || "")
    max = max || 52
    if (p.length <= max) return p
    const sep = p.indexOf("\\") >= 0 ? "\\" : "/"
    const parts = p.split(sep)
    let tail = parts[parts.length - 1]
    for (let i = parts.length - 2; i > 0 && (parts[0] + sep + "…" + sep + parts[i] + sep + tail).length <= max; --i) tail = parts[i] + sep + tail
    return parts[0] + sep + "…" + sep + tail
}

// "Saturday, 17 October"
function longDay(iso) { const d = fromIso(iso); return WEEKDAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] }
function monthTitle(d) { return MONTHS[d.getMonth()] + " " + d.getFullYear() }

// Due dates: "Today", "Tomorrow", "Wed 21" within a week either side, "3 Nov" further out.
function dueLabel(iso, todayIso) {
    if (!iso) return ""
    const d = fromIso(iso), days = daysBetween(fromIso(todayIso), d)
    if (days === 0) return "Today"
    if (days === 1) return "Tomorrow"
    if (Math.abs(days) <= 7) return DOW[d.getDay()] + " " + d.getDate()
    return d.getDate() + " " + MON[d.getMonth()]
}
// over | today | week | later | none
function dueGroup(iso, todayIso) {
    if (!iso) return "none"
    const days = daysBetween(fromIso(todayIso), fromIso(iso))
    if (days < 0) return "over"
    if (days === 0) return "today"
    if (days <= 7) return "week"
    return "later"
}
const DUE_GROUPS = [["over", "Overdue"], ["today", "Today"], ["week", "This week"], ["later", "Later"], ["none", "Whenever"]]

// List time groups: This week, Last week, Earlier in October, September, August 2025.
function timeGroup(ts, now) {
    const d = parseTs(ts)
    if (!d) return ""
    now = now || new Date()
    const monday = dayStart(now)
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
    if (d >= monday) return "This week"
    const lastMonday = new Date(monday)
    lastMonday.setDate(lastMonday.getDate() - 7)
    if (d >= lastMonday) return "Last week"
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "Earlier in " + MONTHS[d.getMonth()]
    return d.getFullYear() === now.getFullYear() ? MONTHS[d.getMonth()] : MONTHS[d.getMonth()] + " " + d.getFullYear()
}

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }
// Rich text with every match of `q` (any case) marked in the highlight colour.
function highlight(text, q, bg, fg) {
    text = String(text || "")
    q = (q || "").trim()
    if (!q) return escapeHtml(text)
    const low = text.toLowerCase(), ql = q.toLowerCase()
    let out = "", i = 0
    for (let j = low.indexOf(ql); j >= 0; j = low.indexOf(ql, i)) {
        out += escapeHtml(text.slice(i, j)) + "<span style=\"background-color:" + bg + ";color:" + fg + "\">" + escapeHtml(text.slice(j, j + q.length)) + "</span>"
        i = j + q.length
    }
    return out + escapeHtml(text.slice(i))
}

function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")) }

// The space above a block, given the block before it (`gapFor` in the
// prototype). Types: p pl h1 h2 h3 li ol task quote code table hr.
function gapFor(prev, cur) {
    if (!prev) return 0
    if (prev === "pl" && cur === "pl") return 0
    if (cur === "h1") return 40
    if (prev === "h1") return cur === "h2" ? 24 : 14
    if (prev === "hr" || cur === "hr") return 28
    if (cur === "h2") return 40
    if (cur === "h3") return prev === "h2" ? 14 : 30
    if (prev === "h2" || prev === "h3") return 10
    if ((cur === "task" || cur === "li" || cur === "ol") && prev === cur) return 4
    const boxed = ["code", "table", "quote"]
    if (boxed.indexOf(cur) >= 0 || boxed.indexOf(prev) >= 0) return 22
    return 16
}
