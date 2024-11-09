<template>
    <ion-modal :is-open="isOpen" @didDismiss="closeModal">
        <ion-header>
            <ion-toolbar>
                <ion-title>Training Registratie</ion-title>
                <ion-buttons slot="end">
                    <ion-button @click="closeModal">Annuleren</ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>
        <ion-content>
            <div class="modal-content">
                <p>Bij het registreren voor deze training geef je aan dat je bereid bent om les te geven.</p>
                <ion-item>
                    <ion-label>Niet meer waarschuwen</ion-label>
                    <ion-checkbox v-model="dontWarnAgain"></ion-checkbox>
                </ion-item>
                <ion-button expand="full" @click="confirmRegistration">OK</ion-button>
            </div>
        </ion-content>
    </ion-modal>
</template>

<script lang="ts">
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonItem, IonLabel, IonCheckbox } from '@ionic/vue';
import { Component, Prop, toNative, Vue } from 'vue-facing-decorator';

@Component({
    components: {
        IonModal,
        IonHeader,
        IonToolbar,
        IonTitle,
        IonButtons,
        IonButton,
        IonContent,
        IonItem,
        IonLabel,
        IonCheckbox
    }
})
export class TrainingRegistrationModal extends Vue {
    isOpen!: boolean;

    openModal() {
        // Emit an event to open the modal
        this.isOpen = true;
        this.$emit('update:isOpen', true);
    }
    
    closeModal() {
        // Emit an event to close the modal
        this.isOpen = false;
        this.$emit('update:isOpen', false);
    }

    confirmRegistration() {
        this.closeModal();
    }
}

export default toNative(TrainingRegistrationModal);
</script>

<style scoped>
.modal-content {
    padding: 16px;
}
</style>