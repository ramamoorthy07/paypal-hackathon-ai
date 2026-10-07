export function DemoBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
      <p className="mx-auto max-w-6xl text-sm leading-5">
        <strong>Sandbox demo.</strong> PayPal is not contacted until you click Confirm. Use a
        sandbox Personal account to pay. Render free tier can take about a minute to wake — if
        this is the first hit, wait and refresh.
      </p>
    </div>
  );
}
