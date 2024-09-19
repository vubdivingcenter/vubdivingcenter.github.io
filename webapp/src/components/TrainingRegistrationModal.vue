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

<script>
import { defineComponent, ref } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonItem, IonLabel, IonCheckbox } from '@ionic/vue';

export default defineComponent({
    name: 'TrainingRegistrationModal',
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
    },
    props: {
        isOpen: {
            type: Boolean,
            required: true
        }
    },
    setup() {
        const dontWarnAgain = ref(false);

        const closeModal = () => {
            // Emit an event to close the modal
            this.$emit('update:isOpen', false);
        };

        const confirmRegistration = () => {
            // Handle the registration confirmation logic here
            if (dontWarnAgain.value) {
                // Save the preference to not warn again
            }
            closeModal();
        };

        return {
            dontWarnAgain,
            closeModal,
            confirmRegistration
        };
    }
});
</script>

<style scoped>
.modal-content {
    padding: 16px;
}
</style>