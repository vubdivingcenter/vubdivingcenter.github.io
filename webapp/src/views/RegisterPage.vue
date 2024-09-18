<template>
    <ion-page>
        <ion-content class="ion-padding">
            <template v-if="invite">
                <div class="message">
                    <p><b>{{ invite.name }}</b> heeft je uitgenodigd om te registreren op de VDC website.</p>
                    <p class="info">Deze uitnodiging is alleen bestemt voor leden van de duikclub.</p>
                </div>
                <span v-if="error" class="error">{{ error }}</span>
                <ion-item>
                    <ion-label position="floating">E-mail</ion-label>
                    <ion-input v-model="email" type="email"></ion-input>
                </ion-item>
                <ion-item>
                    <ion-label position="floating">Voornaam</ion-label>
                    <ion-input v-model="firstName" type="text"></ion-input>
                </ion-item>
                <ion-item>
                    <ion-label position="floating">Achternaam</ion-label>
                    <ion-input v-model="lastName" type="text"></ion-input>
                </ion-item>
                <ion-item>
                    <ion-label position="floating">Wachtwoord</ion-label>
                    <ion-input v-model="password" type="password"></ion-input>
                </ion-item>
                <ion-item>
                    <ion-label position="floating">Wachtwoord (herhalen)</ion-label>
                    <ion-input v-model="password2" type="password"></ion-input>
                </ion-item>
                <ion-button expand="full" @click="register">Registreren</ion-button>

                <a target="_blank" href="https://www.vubdivingcenter.be/privacy-policy/">Privacybeleid</a>
            </template>
            <template v-else>
                <p>Deze uitnodiging is niet geldig of reeds gebruikt.</p>
            </template>
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
} from '@ionic/vue';
import { useUserStore } from '@/stores/user.store';
import { Invite } from '@/models/Invite';

@Component({
    components: {
        IonPage,
        IonContent,
        IonItem,
        IonLabel,
        IonInput,
        IonButton,
    }
})
class RegisterPage extends Vue {
    userStore = useUserStore();
    // Invite key
    key: string = '';
    invite: Invite;
    
    // User details
    email: string = '';
    firstName: string = '';
    lastName: string = '';
    password: string = '';
    password2: string = '';

    error: string = undefined;
    
    mounted() {
        // Get the invite key from the named param
        this.key = this.$route.params.key;
        // Fetch the invite details
        this.userStore.findInviteByKey(this.key).then((invite) => {
            this.invite = invite;
        }).catch((error) => {
            console.error(error);
        });
    }

    async register() {
        // Clear error
        this.error = undefined;
        try {
            // Validate that everything is filled in
            if (!this.email || !this.firstName || !this.lastName || !this.password || !this.password2) {
                this.setErrorMessage('Gelieve alle velden in te vullen');
                return;
            }
            // Validate that passwords match
            if (this.password !== this.password2) {
                this.setErrorMessage('Wachtwoorden komen niet overeen');
                return;
            }

            this.userStore.register(this.key, this.email, this.password, this.firstName, this.lastName).then((user) => {
                console.log('User registered', user);
                // Redirect the user to the login page
                this.$router.push('/login');
            }).catch((error) => {
                const errorMessage = error.message;
                const errorCode = error.code;
                switch (errorCode) {
                    case "auth/weak-password":
                        this.setErrorMessage("Het wachtwoord is te zwak en moet minstens 6 karakters lang zijn.");
                        break;
                    case "auth/email-already-in-use":
                        this.setErrorMessage(
                            "Dit e-mail adres is reeds in gebruik. Klik op wachtwoord vergeten om een nieuw wachtwoord aan te vragen."
                        );
                        break;
                    case "auth/invalid-email":
                        this.setErrorMessage("Dit e-mail adres is niet geldig.");
                        break;
                    case "auth/operation-not-allowed":
                        this.setErrorMessage("E-mail/wachtwoord accounts zijn tijdelijk onbeschikbaar.");
                        break;
                    default:
                        this.setErrorMessage(errorMessage);
                        break;
                }
            });
        } catch (error) {
            console.error(error);
        }
    }

    setErrorMessage(message: string) {
        this.error = message;
    }
}

export default toNative(RegisterPage)
</script>

<style scoped>
    .message {
        margin-bottom: 20px;
        font-size: 16px;
        text-align: center;
    }

    .info {
        font-size: 12px;
        text-align: center;
    }

    .error {
        color: white;
        background-color: rgb(155, 9, 9);
        padding: 10px;
        border-radius: 10px;
        width: 100%;
        font-size: 12px;
        text-align: center;
    }
</style>