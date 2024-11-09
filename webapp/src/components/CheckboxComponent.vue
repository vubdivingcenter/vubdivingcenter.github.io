<template>
    <div class="checkbox">
        <input type="checkbox" :id="id" v-model="checked" :disabled="disabled" />
        <label :for="id" :class="{ checked: checked, disabled: disabled }">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="white" d="M9 16.2l-3.5-3.5-1.4 1.4 4.9 4.9 12-12-1.4-1.4z"/>
            </svg>
        </label>
    </div>
</template>

<script lang="ts">
import { Component, Model, Prop, Vue, toNative } from 'vue-facing-decorator';

@Component({
    components: {
    }
})
class CheckboxComponent extends Vue {
    id: string = `checkbox_` + Math.random().toString(36).substring(7);
    @Prop() disabled: boolean = false;
    @Model() checked!: boolean;
}

export default toNative(CheckboxComponent)
</script>

<style scoped>
.checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
}

.checkbox input[type="checkbox"] {
    display: none;
}

.checkbox label {
    width: 40px;
    height: 40px;
    border: 2px solid #ccc;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background-color: white;
}

.checkbox label.checked {
    background-color: green;
}

.checkbox label.disabled {
    background-color: #e0e0e0;
    border-color: #b0b0b0;
    cursor: not-allowed;
}

.checkbox svg {
    width: 40px;
    height: 40px;
}
</style>
