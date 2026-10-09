<script setup lang="ts">
import { ref } from 'vue';
import { useEditorStore } from '@/stores/editor';

const editor = useEditorStore();
const showName = ref(false);
const name = ref('');

async function save() {
  await editor.save();
}
async function discard() {
  await editor.discard();
}
async function saveAs() {
  await editor.saveAs(name.value.trim() || 'My layout');
}
</script>

<template>
  <div class="dialog-backdrop" @pointerdown.self="editor.cancelExit()">
    <div class="dialog" role="dialog" aria-label="Leave the editor">
      <h2>Leave the editor?</h2>
      <p v-if="editor.dirty">You have unsaved changes.</p>
      <p v-else>No changes to save.</p>

      <template v-if="!showName">
        <div class="dialog__actions">
          <button class="btn btn--primary" type="button" :disabled="!editor.dirty" @click="save">
            Save
          </button>
          <button class="btn" type="button" @click="discard">Discard</button>
          <button class="btn" type="button" @click="showName = true">Save as…</button>
          <button class="btn btn--ghost" type="button" @click="editor.cancelExit()">Cancel</button>
        </div>
      </template>
      <template v-else>
        <label>Layout name</label>
        <input v-model="name" type="text" placeholder="Cozy evening" />
        <div class="dialog__actions">
          <button class="btn btn--primary" type="button" @click="saveAs">Save layout</button>
          <button class="btn btn--ghost" type="button" @click="showName = false">Back</button>
        </div>
      </template>
    </div>
  </div>
</template>
