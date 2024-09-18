<template>
    <ion-page>
      <ion-content class="ion-padding">
        <ion-item>
          <ion-label position="floating">E-mail</ion-label>
          <ion-input v-model="email" type="email"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label position="floating">Wachtwoord</ion-label>
          <ion-input v-model="password" type="password"></ion-input>
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
  class ProfilePage extends Vue {
   
  }
  
  export default toNative(ProfilePage)
  </script>