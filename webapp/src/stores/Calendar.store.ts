import { defineStore } from 'pinia';
import { firebaseApp } from '../firebase';
import { collection, getFirestore } from 'firebase/firestore';
import { useCollection } from 'vuefire';
import { Training } from 'models/Training';
import { scheduler } from 'dhtmlx-scheduler';
const db = getFirestore(firebaseApp);
const calendarRef = collection(db, 'calendar');

// const CALENDAR_JSON = "https://www.vubdivingcenter.be/calendar.json";
const CALENDAR_JSON = "http://localhost:8081/calendar.json";

export const useCalendarStore = defineStore('calendar', {
    state: () => ({
        events: [] as Training[],
    }),
    getters: {
    },
    actions: {
        fetchEvents(): Promise<Training[]> {
            return new Promise((resolve) => {
                // Add dummy calendar div to body
                const dummyCalendarDiv = document.createElement('div');
                dummyCalendarDiv.id = 'dummy-calendar';
                // Set invisible
                dummyCalendarDiv.style.display = 'none';
                document.body.appendChild(dummyCalendarDiv);

                scheduler.plugins({
                    recurring: true, 
                    serialize: true, 
                });
                scheduler.init(dummyCalendarDiv.id , new Date());
                scheduler.load(CALENDAR_JSON);

                scheduler.attachEvent("onLoadEnd", () => {
                    const currentDate = new Date();
                    const data = scheduler.getEvents(currentDate, new Date(currentDate.getFullYear() + 1, 0, 0));
                    data.filter((event: any) => {
                        return event.text.includes('Vrijdagtraining');
                    }).map((event: any) => {
                        event.start_date = new Date(event.start_date);
                        event.end_date = new Date(event.end_date);
                        return event;
                    }).filter((event: any) => event.end_date > currentDate)
                    .sort((a, b) => a.start_date > b.start_date ? 1 : -1)
                    .forEach(event => {
                        const start = event.start_date;
                        const end = event.end_date;
                        const title = event.text, details = event.details;

                        let trainerName = undefined;
                        // Trainer name is sometimes in the title
                        // ex. "Vrijdagtraining - Eva"
                        // ex. "Vrijdagtraining (Bram)"
                        if (title.includes('-')) {
                            trainerName = title.split('-')[1].trim();
                        } else if (title.includes('(')) {
                            trainerName = title.split('(')[1].split(')')[0].trim();
                        }

                        this.events.push({
                            startTime: start,
                            endTime: end,
                            subject: details,
                            trainer: trainerName ? { 
                                firstName: trainerName,
                                lastName: "(VIA KALENDER)",
                                email: "",
                            } : undefined,
                        });
                    });
                    resolve(this.events);
                });
            });
        }
    },
});
