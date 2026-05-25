export function LocalCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-left">
      <p className="text-xs tracking-widest text-muted-foreground">LOCAL</p>
      <p className="mt-1 text-xl text-primary">
        <span style={{ fontFamily: '"Nexa Book", sans-serif' }}>IGREJA</span>{" "}
        <span style={{ fontFamily: '"Nexa Heavy", sans-serif' }}>ESPERANÇA</span>
      </p>
      {!compact && (
        <p className="mt-1 text-sm text-muted-foreground">
          Av. Bartolomeu Bueno Qd. 15 Lt. 26
          <br />
          Jd. Mont Serrat — Aparecida de Goiânia / GO
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="https://www.google.com/maps/dir/?api=1&destination=-16.7603239,-49.2704948"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          GOOGLE MAPS
        </a>
        <a
          href="https://waze.com/ul?ll=-16.7603239,-49.2704948&navigate=yes"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          WAZE
        </a>
        <a
          href="https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=-16.7603239&dropoff[longitude]=-49.2704948"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          UBER
        </a>
      </div>
    </div>
  );
}
