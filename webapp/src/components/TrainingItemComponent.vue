<template>
    <ion-card>
        <ion-grid>
            <ion-row>
                <ion-col 
                    :class="{ 
                        date: true,
                        unavailable: training?.trainer
                    }"
                    size="1"
                >
                    <span class="weekday">{{ weekday }}</span>
                    <span class="day">{{ day }}</span>
                    <span class="month">{{ month }}</span>
                </ion-col>
                <ion-col> 
                    <ion-card-content>
                        <ion-grid>
                            <ion-row>
                                <ion-col size="11">
                                    <ion-grid>
                                        <ion-row>
                                            <ion-col size="3">
                                                <h2><b>Lesgever</b></h2>
                                            </ion-col>
                                            <ion-col>
                                                <h2>
                                                    {{ training?.trainer?.firstName }} {{ training?.trainer?.lastName }}
                                                </h2>
                                            </ion-col>
                                        </ion-row>
                                    </ion-grid>
                                </ion-col>
                                <ion-col size="1">
                                    <checkbox-component
                                        class="checkbox"
                                        v-model="checked"
                                        :disabled="training?.trainer"
                                    ></checkbox-component>
                                </ion-col>
                            </ion-row>
                        </ion-grid>
                    </ion-card-content>
                </ion-col>
            </ion-row>
        </ion-grid>
        <training-registration-modal
            ref="modal"
            :training="training"
        ></training-registration-modal>
    </ion-card>
</template>

<script lang="ts">
import { Component, Prop, Vue, toNative, Watch, Ref } from 'vue-facing-decorator';
import { 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
} from '@ionic/vue';
import { Training } from '../models/Training';
import CheckboxComponent from './CheckboxComponent.vue';
import TrainingRegistrationModal from './TrainingRegistrationModal.vue';

@Component({
    components: {
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardSubtitle,
        IonCardContent,
        IonGrid,
        IonRow,
        IonCol,
        CheckboxComponent,
        TrainingRegistrationModal
    }
})
class TrainingItemComponent extends Vue {
    @Prop() training?: Training;
    checked: boolean = false;
    @Ref("modal")
    trainingRegistrationModal: any;

    get weekday(): string {
        return this.training?.startTime.toLocaleDateString('nl-BE', { weekday: 'short' }) || '';
    }

    get day(): string {
        return this.training?.startTime.toLocaleDateString('nl-BE', { day: 'numeric' }) || '';
    }

    get month(): string {
        return this.training?.startTime.toLocaleDateString('nl-BE', { month: 'short' }) || '';
    }

    @Watch('checked')
    watch() {
        this.trainingRegistrationModal.openModal();
        console.log('checked', this.checked);
    }
}

export default toNative(TrainingItemComponent)
</script>

<style scoped>
ion-card ion-grid {
    padding: 0;
}

ion-card .date.unavailable {
    background-color: #0b971b;
}

ion-card-content {
    padding: 5px;
}

ion-card .date {
    background-color: #b90909;
    color: white;
    font-size: 1.5em;
    text-align: center;
    padding: 10px;
    justify-content: center;
    align-items: center;
    min-width: 60px;
}
.date .weekday {
    display: block;
    font-size: 0.8em;
}
.date .day {
    display: block;
    font-size: 1.5em;
}
.date .month {
    display: block;
    font-size: 0.8em;
}

ion-col .checkbox {
    margin-top: auto;
    margin-bottom: auto;
}
</style>