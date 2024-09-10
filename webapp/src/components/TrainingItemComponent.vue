<template>
    <ion-card>
        <ion-grid>
            <ion-row>
                <ion-col class="date" size="2">
                    <span class="weekday">{{ weekday }}</span>
                    <span class="day">{{ day }}</span>
                    <span class="month">{{ month }}</span>
                </ion-col>
                <ion-col> 
                    <ion-card-content>
                        <ion-grid>
                            <ion-row>
                                <ion-col size="2">
                                    <b>Lesgever</b>
                                </ion-col>
                                <ion-col>
                                    Bram Pellens
                                </ion-col>
                            </ion-row>
                            <ion-row>
                                <ion-col size="2">
                                    <b>Onderwerp</b>
                                </ion-col>
                                <ion-col>
                                    Bachelor training
                                </ion-col>
                            </ion-row>
                        </ion-grid>
                    </ion-card-content>
                </ion-col>
            </ion-row>
        </ion-grid>
    </ion-card>
</template>

<script lang="ts">
import { Component, Prop, Vue, toNative } from 'vue-facing-decorator';
import { 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol
} from '@ionic/vue';
import { Training } from '../models/Training';

@Component({
    components: {
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardSubtitle,
        IonCardContent,
        IonGrid,
        IonRow,
        IonCol
    }
})
class TrainingItemComponent extends Vue {
    @Prop() training?: Training;

    get weekday(): string {
        return this.training?.date.toLocaleDateString('nl-BE', { weekday: 'long' }) || '';
    }

    get day(): string {
        return this.training?.date.toLocaleDateString('nl-BE', { day: 'numeric' }) || '';
    }

    get month(): string {
        return this.training?.date.toLocaleDateString('nl-BE', { month: 'long' }) || '';
    }
}

export default toNative(TrainingItemComponent)
</script>

<style scoped>
ion-card ion-grid {
    padding: 0;
}

ion-card .date {
    background-color: #0059ff;
    color: white;
    font-size: 1.5em;
    text-align: center;
    padding: 10px;
    justify-content: center;
    align-items: center;
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
</style>