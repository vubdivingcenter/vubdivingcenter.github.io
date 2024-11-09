<template>
  <ion-page>
    <ion-content class="ion-padding">
      <ion-item>
        <ion-input 
          label="E-mail" 
          label-placement="stacked" 
          v-model="email" type="email"></ion-input>
      </ion-item>
      <ion-item>
        <ion-input label="Wachtwoord" label-placement="stacked" v-model="password" type="password"></ion-input>
      </ion-item>
      <ion-grid>
        <ion-row>
          <ion-col col-6>
            <ion-button fill="outline" shape="round" expand="full" @click="passwordLost">Wachtwoord vergeten?</ion-button>
          </ion-col>
          <ion-col col-6>
            <ion-button shape="round" expand="full" @click="login">Aanmelden</ion-button>
          </ion-col>
        </ion-row>
      </ion-grid>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { Component, Vue, toNative } from 'vue-facing-decorator';
import { 
    IonPage,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
} from '@ionic/vue';
import { useUserStore } from '../stores/user.store';

@Component({
    components: {
      IonPage,
      IonContent,
      IonItem,
      IonLabel,
      IonInput,
      IonButton,
      IonGrid,
      IonRow,
      IonCol,
    }
})
class LoginPage extends Vue {
  userStore = useUserStore();

  email: string = '';
  password: string = '';

  async login() {
    try {
      await this.userStore.login(this.email, this.password);
    } catch (error) {
      console.error(error);
    }
  }

  async passwordLost() {
    try {
      console.log('password reset email sent');
    } catch (error) {
      console.error(error);
    }
  }
}

export default toNative(LoginPage)
</script>