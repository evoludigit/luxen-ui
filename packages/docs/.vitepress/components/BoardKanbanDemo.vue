<script setup>
import { ref } from 'vue';
import { move } from 'luxen-ui/board/state';

const columns = [
  { value: 'to-do', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

const titles = {
  'task-1': 'Write the release notes',
  'task-2': 'Review the pricing page',
  'task-3': 'Update the logo',
  'task-4': 'Fix the invoice footer',
  'task-5': 'Plan the next sprint',
};

const tasks = ref({
  'to-do': ['task-1', 'task-2', 'task-3'],
  doing: ['task-4'],
  done: ['task-5'],
});
</script>

<template>
  <div class="vp-raw component-wrapper bg-surface-sunken">
    <l-board
      class="kanban"
      label="Sprint"
      @move-request="(e) => (tasks = move(tasks, e))"
    >
      <l-board-list
        v-for="column in columns"
        :key="column.value"
        :value="column.value"
        :label="column.label"
      >
        <div
          slot="header"
          class="flex w-full items-center justify-between gap-2"
        >
          <strong class="text-sm">{{ column.label }}</strong>
          <l-badge pill>{{ tasks[column.value].length }}</l-badge>
        </div>
        <!-- `display: contents` keeps the chips in the list's own layout. The
             leave ends at once: Vue would otherwise keep the item that left in
             its old list for a frame, next to its copy in the new one. -->
        <TransitionGroup
          name="kanban"
          tag="div"
          class="contents"
          @leave="(el, done) => done()"
        >
          <l-board-item
            v-for="task in tasks[column.value]"
            :key="task"
            :value="task"
          >
            {{ titles[task] }}
          </l-board-item>
        </TransitionGroup>
      </l-board-list>
    </l-board>
  </div>
</template>

<style scoped>
/* One task per line, top to bottom. */
.kanban l-board-list::part(items) {
  flex-direction: column;
  align-items: flex-start;
}

/* An item that lands fades in. */
.kanban-enter-active {
  transition: opacity 200ms ease;
}

.kanban-enter-from {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .kanban-enter-active {
    transition: none;
  }
}
</style>
