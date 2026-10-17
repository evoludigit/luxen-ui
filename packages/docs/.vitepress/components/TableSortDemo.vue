<script setup>
import { computed, ref } from 'vue';

const products = [
  { sku: 'SKU-1042', name: 'Desk lamp', stock: 4210 },
  { sku: 'SKU-2087', name: 'Office chair', stock: 12004 },
  { sku: 'SKU-3110', name: 'Standing desk', stock: 865 },
  { sku: 'SKU-4021', name: 'Monitor arm', stock: 2390 },
];

const columns = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name' },
  { key: 'stock', label: 'In stock', number: true },
];

// <l-data-table> reports the next sort as TanStack Table's SortingState; the
// page keeps it and sorts its rows.
const sorting = ref([{ id: 'stock', desc: true }]);

const rows = computed(() => {
  const [sorted] = sorting.value;
  if (!sorted) return products;
  const { id, desc } = sorted;
  const sign = desc ? -1 : 1;
  return products.toSorted((a, b) =>
    typeof a[id] === 'number' ? sign * (a[id] - b[id]) : sign * a[id].localeCompare(b[id]),
  );
});

const ariaSort = (key) => {
  const [sorted] = sorting.value;
  if (sorted?.id !== key) return null;
  return sorted.desc ? 'descending' : 'ascending';
};

const format = new Intl.NumberFormat('en');
</script>

<template>
  <div
    class="vp-raw component-wrapper bg-surface-sunken"
    style="padding-block: 24px; padding-inline: 12px"
  >
    <l-data-table @sort-change="sorting = $event.sorting">
      <table class="l-table">
        <caption>
          Products
        </caption>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              :data-key="column.key"
              :data-type="column.number ? 'number' : null"
              :aria-sort="ariaSort(column.key)"
            >
              <button type="button">{{ column.label }}</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in rows"
            :key="product.sku"
          >
            <th scope="row">{{ product.sku }}</th>
            <td>{{ product.name }}</td>
            <td data-type="number">{{ format.format(product.stock) }}</td>
          </tr>
        </tbody>
      </table>
    </l-data-table>
  </div>
</template>
