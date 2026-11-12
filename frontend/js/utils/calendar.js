// Reminder for my calendar (.ics file: Google Agenda, Outlook, Apple Calendar...), downloaded by the browser of the app
const pad = (n) => String(n).padStart(2, '0')
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
const clean = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n')

// next working day at 10:00 (local time), 15 minutes
export function downloadReminder({ title, details = '', when = null }) {
    const start = when ? new Date(when) : new Date()
    if (!when) { start.setDate(start.getDate() + 1); while ([0, 6].includes(start.getDay())) start.setDate(start.getDate() + 1); start.setHours(10, 0, 0, 0) }
    const end = new Date(start.getTime() + 15 * 60e3)
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DC Prospect//FR', 'BEGIN:VEVENT', `UID:${Date.now()}@dc-prospect`, `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${clean(title)}`, `DESCRIPTION:${clean(details)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${clean(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    a.download = `${title.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 60) || 'rappel'}.ics`
    document.body.appendChild(a); a.click(); a.remove()
}
