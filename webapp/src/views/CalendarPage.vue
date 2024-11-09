<template>
  <div id="container">
    <TrainingItemComponent 
      :key="event"
      :training="event" 
      v-for="event in events">
    </TrainingItemComponent>
  </div>
</template>

<script lang="ts">
import { Component, Vue, toNative } from 'vue-facing-decorator';
import { 
    IonPage,
    IonContent,
} from '@ionic/vue';
import TrainingItemComponent from '../components/TrainingItemComponent.vue';
import { Training } from '../models/Training';
import { useCalendarStore } from '../stores/calendar.store';
import { useUserStore } from '../stores/user.store';

@Component({
    components: {
      IonPage,
      IonContent,
      TrainingItemComponent
    }
})
class CalendarPage extends Vue {
  calendarStore = useCalendarStore();
  userStore = useUserStore();
  events: Training[] = [];

  mounted() {
    // if (this.userStore.user) {
      this.calendarStore.fetchEvents().then((events) => {
        this.events = events;
      }).catch((error) => {
        console.error(error);
      });
    // } else {
    //   // Redirect to login page
    //   this.$router.push({ name: 'login' });
    // }
  }
}

export default toNative(CalendarPage)
</script>

<style scoped>

</style>
