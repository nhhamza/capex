interface MoneyProps {
  amount: number;
  decimals?: number;
}

export function Money({ amount, decimals = 0 }: MoneyProps) {
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return <>{formatted}</>;
}
