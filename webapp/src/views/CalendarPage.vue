<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <TrainingItemComponent 
          :key="event"
          :training="event" 
          v-for="event in events">
        </TrainingItemComponent>
      </div>
    </ion-content>
  </ion-page>
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

@Component({
    components: {
      IonPage,
      IonContent,
      TrainingItemComponent
    }
})
class CalendarPage extends Vue {
  calendarStore = useCalendarStore();
  events: Training[] = [];

  mounted() {
    this.calendarStore.fetchEvents().then((events) => {
      this.events = events;
    }).catch((error) => {
      console.error(error);
    });
  }
}

export default toNative(CalendarPage)
</script>

<style scoped>

</style>
