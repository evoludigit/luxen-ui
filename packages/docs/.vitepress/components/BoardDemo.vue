<script setup>
import { ref } from 'vue';
import { move } from 'luxen-ui/board/state';

const lists = [
  { value: 'unpriced', label: 'Unpriced' },
  { value: 'standard', label: 'Standard', price: '€4.90' },
  { value: 'premium', label: 'Premium', price: '€9.90' },
];

const names = {
  'sku-1042': 'Desk lamp',
  'sku-2210': 'Office chair',
  'sku-2875': 'Cable tray',
  'sku-3305': 'Notebook',
  'sku-4120': 'Monitor arm',
};

// The page's own state, in the board's shape: item values by list value.
const tiers = ref({
  unpriced: ['sku-1042', 'sku-2210', 'sku-2875'],
  standard: ['sku-3305'],
  premium: ['sku-4120'],
});

// A footer pick is a move too, written as a plain object.
function add(to, event) {
  const value = event.target.value;
  tiers.value = move(tiers.value, {
    value,
    from: { value: 'unpriced' },
    to: { value: to },
    index: tiers.value[to].length,
  });
  event.target.value = '';
}
</script>

<template>
  <div class="vp-raw component-wrapper bg-surface-sunken">
    <!-- The board only asks: move() applies the request to the page's data,
         and Vue renders the item in its new list. -->
    <l-board
      label="Price tiers"
      @move-request="(e) => (tiers = move(tiers, e))"
    >
      <l-board-list
        v-for="list in lists"
        :key="list.value"
        :value="list.value"
        :label="list.label"
      >
        <div
          v-if="list.price"
          slot="header"
          class="flex w-full items-baseline justify-between gap-2"
        >
          <strong class="text-sm">{{ list.label }}</strong>
          <span class="text-xs text-(--l-color-text-secondary)">{{ list.price }} per unit</span>
        </div>
        <l-board-item
          v-for="sku in tiers[list.value]"
          :key="sku"
          :value="sku"
        >
          {{ names[sku] }}
        </l-board-item>
        <select
          v-if="list.price"
          slot="footer"
          class="l-select w-full"
          :aria-label="`Add a product to ${list.label}`"
          @change="add(list.value, $event)"
        >
          <option value="">Add a product…</option>
          <option
            v-for="sku in tiers.unpriced"
            :key="sku"
            :value="sku"
          >
            {{ names[sku] }}
          </option>
        </select>
      </l-board-list>
    </l-board>
  </div>
</template>
