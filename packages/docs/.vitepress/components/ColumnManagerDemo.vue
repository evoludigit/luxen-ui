<script setup>
import { computed, ref } from 'vue';

const declared = [
  { key: 'sku', label: 'SKU', fixed: true },
  { key: 'name', label: 'Name' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'supplier', label: 'Supplier', hidden: true },
  { key: 'stock', label: 'In stock', number: true },
];
const products = [
  { sku: 'SKU-1042', name: 'Desk lamp', warehouse: 'North', supplier: 'Northwind', stock: 4210 },
  { sku: 'SKU-2087', name: 'Office chair', warehouse: 'South', supplier: 'Contoso', stock: 12004 },
  { sku: 'SKU-3110', name: 'Standing desk', warehouse: 'East', supplier: 'Fabrikam', stock: 865 },
];

// The table reports the order; the page renders its columns in it. Hiding is
// applied by the table itself, so hidden columns are still rendered.
const order = ref(declared.map((c) => c.key));
const columns = computed(() => order.value.map((key) => declared.find((c) => c.key === key)));

const format = new Intl.NumberFormat('en');
</script>

<template>
  <div
    class="vp-raw component-wrapper bg-surface-sunken"
    style="padding-block: 24px; padding-inline: 12px"
  >
    <div class="flex flex-wrap items-start gap-6">
      <l-column-manager for="column-manager-demo"></l-column-manager>
      <l-data-table
        id="column-manager-demo"
        class="min-w-0 flex-1"
        @column-change="order = $event.columns.map((c) => c.key)"
      >
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
                :data-fixed="column.fixed ? '' : null"
                :data-hidden="column.hidden ? '' : null"
                :data-type="column.number ? 'number' : null"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="product in products"
              :key="product.sku"
            >
              <component
                :is="column.key === 'sku' ? 'th' : 'td'"
                v-for="column in columns"
                :key="column.key"
                :scope="column.key === 'sku' ? 'row' : null"
                :data-type="column.number ? 'number' : null"
              >
                {{ column.number ? format.format(product[column.key]) : product[column.key] }}
              </component>
            </tr>
          </tbody>
        </table>
      </l-data-table>
    </div>
  </div>
</template>
