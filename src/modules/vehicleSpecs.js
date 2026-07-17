/** Builds a display-ready spec list from a raw vehicle object (worker's formatCatalogueVehicle/formatVehicle shape). */
export function buildVehicleSpecs(raw) {
  if (!raw) return undefined;
  return [
    { label: 'Range (real-world)', value: raw.range },
    { label: 'Range (rated)', value: raw.range_rated },
    { label: 'Battery', value: raw.battery_kwh ? `${raw.battery_kwh} kWh` : '—' },
    { label: 'Fast charging', value: raw.fast_charge ? 'Yes' : 'No' },
    { label: 'Seating', value: raw.seating ?? '—' },
    { label: 'Boot space', value: raw.boot_litres ? `${raw.boot_litres} L` : '—' },
  ].filter((s) => s.value !== undefined);
}
