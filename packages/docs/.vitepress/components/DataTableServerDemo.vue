<script setup>
import { onMounted, ref } from 'vue';

// Stands in for an API that sorts on the server.
const catalogue = [
  { sku: 'SKU-1042', name: 'Desk lamp', stock: 4210 },
  { sku: 'SKU-2087', name: 'Office chair', stock: 12004 },
  { sku: 'SKU-3110', name: 'Standing desk', stock: 865 },
  { sku: 'SKU-4021', name: 'Monitor arm', stock: 2390 },
  { sku: 'SKU-5136', name: 'Bookshelf', stock: 640 },
];

// Takes TanStack Table's SortingState, as an API mapping it to ORDER BY would.
async function fetchProducts(sorting) {
  await new Promise((r) => setTimeout(r, 700));
  const [sorted] = sorting;
  if (!sorted) return catalogue;
  const { id, desc } = sorted;
  const sign = desc ? -1 : 1;
  return catalogue.toSorted((a, b) =>
    typeof a[id] === 'number' ? sign * (a[id] - b[id]) : sign * a[id].localeCompare(b[id]),
  );
}

const rows = ref([]);
const sorting = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  rows.value = await fetchProducts(sorting.value);
  loading.value = false;
}

function onSortChange(event) {
  sorting.value = event.sorting;
  void load();
}

onMounted(load);

const ariaSort = (key) => {
  const [sorted] = sorting.value;
  if (sorted?.id !== key) return null;
  return sorted.desc ? 'descending' : 'ascending';
};

const format = new Intl.NumberFormat('en');
const columns = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name' },
  { key: 'stock', label: 'In stock', number: true },
];
</script>

<template>
  <div
    class="vp-raw component-wrapper bg-surface-sunken"
    style="padding-block: 24px; padding-inline: 12px"
  >
    <l-data-table @sort-change="onSortChange">
      <table
        class="l-table"
        :aria-busy="loading"
      >
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
          <template v-if="loading && !rows.length">
            <tr
              v-for="n in 3"
              :key="n"
            >
              <td
                v-for="column in columns"
                :key="column.key"
              >
                <l-skeleton shape="text"></l-skeleton>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="product in rows"
              :key="product.sku"
            >
              <th scope="row">{{ product.sku }}</th>
              <td>{{ product.name }}</td>
              <td data-type="number">{{ format.format(product.stock) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </l-data-table>
  </div>
</template>
