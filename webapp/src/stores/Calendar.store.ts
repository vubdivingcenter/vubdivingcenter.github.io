import { defineStore } from 'pinia';
import { firebaseApp } from '../firebase';
import { collection, getFirestore } from 'firebase/firestore';
import { useCollection } from 'vuefire';

const db = getFirestore(firebaseApp);
const calendarRef = collection(db, 'calendar');

export const useCalendarStore = defineStore('calendar', {
    state: () => ({
        events: [],
    }),
    getters: {
    },
    actions: {
        fetchCalendar() {
            this.events = [];
            const calendar = useCollection(calendarRef);
            console.log(calendar);
        }
    },
});
