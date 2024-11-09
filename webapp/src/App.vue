<template>
  <ion-app>
    <RouterView/>
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp } from '@ionic/vue';
import { RouterView } from 'vue-router';
</script>

<style>
ion-app, ion-page, ion-router-outlet:host {
  position: initial !important;
  display: initial !important;
}

body {
  overflow: auto !important;
}
</style>