<script setup>
import { computed, ref } from 'vue';

const products = [
  { id: 'sku-1042', sku: 'SKU-1042', name: 'Desk lamp' },
  { id: 'sku-2087', sku: 'SKU-2087', name: 'Office chair' },
  { id: 'sku-3110', sku: 'SKU-3110', name: 'Standing desk' },
];
// What the server says matches the current query, beyond this page.
const TOTAL = 1284;

const table = ref(null);
const selected = ref([]);
const allVisible = ref(false);
const allMatching = ref(false);

function onSelectionChange(event) {
  selected.value = event.selectedKeys;
  allVisible.value = event.allVisibleSelected;
  allMatching.value = event.allMatching;
}

function selectAllMatching() {
  table.value.allMatching = true;
  allMatching.value = true;
}

function clear() {
  table.value.clearSelection();
  selected.value = [];
  allVisible.value = false;
  allMatching.value = false;
}

const count = computed(() => (allMatching.value ? TOTAL : selected.value.length));
const format = new Intl.NumberFormat('en');
</script>

<template>
  <div
    class="vp-raw component-wrapper bg-surface-sunken"
    style="padding-block: 24px; padding-inline: 12px"
  >
    <div
      class="mb-3 flex min-h-8 flex-wrap items-center gap-3 text-sm"
      role="status"
    >
      <template v-if="count">
        <span>{{ format.format(count) }} selected</span>
        <button
          v-if="allVisible && !allMatching"
          type="button"
          class="l-button"
          data-size="sm"
          @click="selectAllMatching"
        >
          Select all {{ format.format(TOTAL) }} products
        </button>
        <button
          type="button"
          class="l-button"
          data-size="sm"
        >
          Archive
        </button>
        <button
          type="button"
          class="l-button"
          data-size="sm"
          @click="clear"
        >
          Clear selection
        </button>
      </template>
    </div>

    <l-data-table
      ref="table"
      selectable
      @selection-change="onSelectionChange"
    >
      <table class="l-table">
        <caption>
          Products
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              data-select
            ></th>
            <th scope="col">SKU</th>
            <th scope="col">Name</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in products"
            :key="product.id"
          >
            <td data-select>
              <input
                type="checkbox"
                class="l-checkbox"
                name="product"
                :value="product.id"
                :aria-label="`Select ${product.sku}`"
              />
            </td>
            <th scope="row">{{ product.sku }}</th>
            <td>{{ product.name }}</td>
          </tr>
        </tbody>
      </table>
    </l-data-table>
  </div>
</template>
