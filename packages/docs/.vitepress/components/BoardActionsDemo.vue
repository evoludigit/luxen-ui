<script setup>
import { ref } from 'vue';
import { move } from 'luxen-ui/board/state';

const lists = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'archive', label: 'Archive' },
];

const subjects = {
  'msg-1': 'Quarterly report',
  'msg-2': 'Team lunch',
  'msg-3': 'Server upgrade',
};

const mail = ref({
  inbox: ['msg-1', 'msg-2', 'msg-3'],
  archive: [],
});

// Each list's entry in the board's state is a plain array: drop the value.
function onSelect(list, message, event) {
  if (event.item.value !== 'delete') return;
  mail.value = { ...mail.value, [list]: mail.value[list].filter((m) => m !== message) };
}
</script>

<template>
  <div class="vp-raw component-wrapper bg-surface-sunken">
    <l-board
      label="Mail"
      @move-request="(e) => (mail = move(mail, e))"
    >
      <l-board-list
        v-for="list in lists"
        :key="list.value"
        :value="list.value"
        :label="list.label"
      >
        <l-board-item
          v-for="message in mail[list.value]"
          :key="message"
          :value="message"
          @select="onSelect(list.value, message, $event)"
        >
          {{ subjects[message] }}
          <l-dropdown-item
            slot="actions"
            value="delete"
            >Delete</l-dropdown-item
          >
        </l-board-item>
      </l-board-list>
    </l-board>
  </div>
</template>
