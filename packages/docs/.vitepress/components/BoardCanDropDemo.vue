<script setup>
import { ref } from 'vue';
import { move } from 'luxen-ui/board/state';

const MAX = 3;

const lists = [
  { value: 'bench', label: 'Bench' },
  { value: 'team-a', label: `Team A (${MAX} max)` },
  { value: 'team-b', label: `Team B (${MAX} max)` },
];

const names = {
  ada: 'Ada',
  grace: 'Grace',
  alan: 'Alan',
  edsger: 'Edsger',
  barbara: 'Barbara',
  donald: 'Donald',
};

const teams = ref({
  bench: ['edsger', 'barbara', 'donald'],
  'team-a': ['ada', 'grace', 'alan'],
  'team-b': [],
});

// Asked on every drag over a list and each time a menu opens, so it reads the
// state as it is then. Made once per list: a new function on every render
// would make every item check its menu again. The bench takes anyone back.
const canDrop = Object.fromEntries(
  lists.map(({ value }) => [value, () => value === 'bench' || teams.value[value].length < MAX]),
);
</script>

<template>
  <div class="vp-raw component-wrapper bg-surface-sunken">
    <l-board
      label="Teams"
      @move-request="(e) => (teams = move(teams, e))"
    >
      <!-- `.prop`: a function is set as a property, even before the element is defined. -->
      <l-board-list
        v-for="list in lists"
        :key="list.value"
        :value="list.value"
        :label="list.label"
        :canDrop.prop="canDrop[list.value]"
      >
        <l-board-item
          v-for="person in teams[list.value]"
          :key="person"
          :value="person"
        >
          {{ names[person] }}
        </l-board-item>
        <span slot="empty">Drop a player here</span>
      </l-board-list>
    </l-board>
  </div>
</template>
