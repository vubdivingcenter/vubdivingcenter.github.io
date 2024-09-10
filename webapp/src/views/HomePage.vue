<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <TrainingItemComponent :training="training"></TrainingItemComponent>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { Component, Prop, Vue, toNative } from 'vue-facing-decorator';
import { 
    IonPage,
    IonContent,
} from '@ionic/vue';
import TrainingItemComponent from '../components/TrainingItemComponent.vue';
import { Training } from '../models/Training';

@Component({
    components: {
      IonPage,
      IonContent,
      TrainingItemComponent
    }
})
class HomePage extends Vue {
  training: Training = {
      date: new Date(),
      trainer: {
          email: '',
          firstName: 'Bram',
          lastName: 'Pellens'
      },
      subject: 'Bachelor training'
  };
}

export default toNative(HomePage)
</script>

<style scoped>

</style>
