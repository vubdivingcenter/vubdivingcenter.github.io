import { defineStore } from 'pinia';

export const useCalendarStore = defineStore('calendar', {
    state: () => ({
        events: [],
    }),

    getters: {
    },

    actions: {
        fetchCalendar() {

        }
    },
});
