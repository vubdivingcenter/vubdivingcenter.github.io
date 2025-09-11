import ics from 'node-ical';
import axios from 'axios';
import fs from 'fs';

export async function fetchEvents(el) {
    return new Promise((resolve, reject) => {
        if (!process.env.CALENDAR) {
            console.warn("No calendar URL provided.");
            return resolve();
        }
        console.log(`Building calendar with time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        axios.get(process.env.CALENDAR).then(response => {
            const data = response.data;
            if (!fs.existsSync('_site')) {
                fs.mkdirSync('_site');
            }
            fs.writeFileSync('_site/calendar.ics', data, 'utf-8');
            return ics.parseICS(data);
        }).then(response => {
            console.log(`Found ${Object.values(response).length} events.`);
            const events = Object.values(response).filter(entry => entry.type === 'VEVENT');
            let id = 1;
            const data = events.map((event, idx) => {
                id += 1;
                if (event.rrule) {
                    // Legacy calendar fix:
                    if (!event.rrule.options.until && event.rrule.options.count) {
                        event.rrule.options.until = new Date(event.rrule.options.dtstart.getTime() + (12096e5 * event.rrule.options.count));
                    }
                    const event_pid = id;
                    const output = [{
                        id,
                        start_date: formatDate(event.rrule.options.dtstart, "UTC"),
                        end_date: event.rrule.options.until ? formatDate(event.rrule.options.until, "UTC") : new Date(9999, 1, 1),
                        text: event.summary,
                        details: `${event.description ? event.description + "\n" : ""}${event.location ?? ""}`,
                        rrule: event.rrule.toString(),
                        duration: (event.end.getTime() - event.start.getTime()) / 1000,
                    }];
                    if (event.exdate) {
                        output.push(...Object.values(event.exdate).map(exdate => {
                            id += 1;
                            return {
                                id,
                                start_date: formatDate(exdate),
                                end_date: formatDate(new Date(exdate.getTime() + (event.end.getTime() - event.start.getTime()))),
                                text: event.summary,
                                details: `${event.description ? event.description + "\n" : ""}${event.location ?? ""}`,
                                deleted: true,
                                recurring_event_id: event_pid,
                                original_start: formatDate(exdate),
                            };
                        }));
                    }
                    if (event.recurrences) {
                        output.push(...Object.values(event.recurrences).map(recurrence => {
                            id += 1;
                            return {
                                id,
                                start_date: formatDate(recurrence.start),
                                end_date: formatDate(recurrence.end),
                                text: recurrence.summary,
                                details: `${recurrence.description ? recurrence.description + "\n" : ""}${recurrence.location ?? ""}`,
                                duration: (recurrence.end.getTime() - recurrence.start.getTime()) / 1000,
                                recurring_event_id: event_pid,
                                original_start: formatDate(recurrence.start),
                            };
                        }));
                    }
                    return output;
                } else {
                    return [{
                        id,
                        start_date: formatDate(event.start),
                        end_date: formatDate(event.end),
                        text: event.summary,
                        details: `${event.description ? event.description + "\n" : ""}${event.location ?? ""}`,
                        duration: (event.end.getTime() - event.start.getTime()) / 1000,
                    }];
                }
            }).reduce((a, b) => a.concat(b));
            fs.writeFileSync('_site/calendar.json', JSON.stringify(data, null, 2), 'utf-8');
            resolve();
        }).catch(reject);
    });
}

function formatDate(date, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    const options = {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat('nl-BE', options);
    const parts = formatter.formatToParts(date);
    const dateTime = parts.reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});
    return `${dateTime.year}-${dateTime.month}-${dateTime.day} ${dateTime.hour}:${dateTime.minute}:${dateTime.second}`;
}
