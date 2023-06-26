const ics = require('node-ical');
const axios = require("axios");
const fs = require('fs');

async function fetchEvents(el) {
    return new Promise((resolve, reject) => {
        console.log(`Building calendar with time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        axios.get(process.env.CALENDAR).then(response => {
            const data = response.data;
            if (!fs.existsSync('_site')) {
                fs.mkdirSync('_site');
            }
            fs.writeFileSync('_site/calendar.ics', data, 'utf-8');
            return ics.parseICS(data);
        }).then(response => {
            // fs.writeFileSync('_site/calendar_raw.json', JSON.stringify(response, null, 2), 'utf-8');
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
                        start_date: formatDate(event.rrule.options.dtstart),
                        end_date: event.rrule.options.until ? formatDate(event.rrule.options.until) : new Date(9999, 1, 1),
                        text: event.summary,
                        details: `${event.description ? event.description + "\n" : ""}${event.location ?? ""}`,
                        rec_type: `week_1___`,
                        event_length: (event.end.getTime() - event.start.getTime()) / 1000,
                        event_pid: 0
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
                                rec_type: `none`,
                                event_length: exdate.getTime() / 1000,
                                event_pid
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
                                event_length: recurrence.start.getTime() / 1000,
                                event_pid
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
                        event_length: (event.end.getTime() - event.start.getTime()) / 1000,
                        event_pid: 0
                    }];
                }
            }).reduce((a, b) => a.concat(b));
            fs.writeFileSync('_site/calendar.json', JSON.stringify(data), 'utf-8');
            resolve();
        }).catch(reject);
    });
}

function formatDate(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
}

module.exports = fetchEvents;
