// Hand-rolled lakh/crore grouping so output doesn't depend on the device's Intl data
export function formatRupees(paise: number): string {
  const rupees = Math.floor(paise / 100).toString();
  const fraction = paise % 100;
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `₹${grouped}${fraction ? `.${fraction.toString().padStart(2, '0')}` : ''}`;
}
