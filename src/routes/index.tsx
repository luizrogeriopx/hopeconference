import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import hero from "@/assets/hope-hero.png";
import stainedGlass from "@/assets/stained-glass-bg.jpg";


export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Hope Conference 2026 — Inscrições | Igreja Esperança" },
      {
        name: "description",
        content:
          "Hope Conference 2026 acontece de 3 a 5 de julho na Igreja Esperança, Aparecida de Goiânia. Inscrições por R$50,00.",
      },
      { property: "og:title", content: "Hope Conference 2026 — Inscrições" },
      {
        property: "og:description",
        content: "3 a 5 de julho de 2026 · Igreja Esperança · Inscrições R$50,00",
      },
    ],
  }),
});

const speakers = [
  "Pr. Ronny Marcos",
  "Pr. Romeu Ivo",
  "Pr. Jocymar Fonseca",
  "Pr. Hamilton Cesar",
  "Pr. Wellington Rocha",
  "Pr. Jehan Porto",
];

function Index() {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "" });
  const [sent, setSent] = useState(false);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* HERO with poster */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `url(${stainedGlass})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background"
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center">
            <h1 className="font-display font-medium leading-[1.05] text-primary">
              <span className="block text-7xl md:text-8xl tracking-tight">HOPE</span>
              <span className="block text-3xl md:text-4xl tracking-[0.2em] text-primary mt-2">
                CONFERENCE
              </span>
              <span className="block text-2xl tracking-[0.4em] text-muted-foreground mt-3">
                2 0 2 6
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Três dias de palavra, adoração e comunhão. Uma conferência para
              renovar a esperança e fortalecer a fé.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#inscricao"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90"
              >
                INSCREVA-SE — R$ 50,00
              </a>
              <a
                href="#programacao"
                className="inline-flex items-center justify-center rounded-md border border-primary/30 px-6 py-3 text-sm font-medium tracking-wider text-primary transition hover:bg-primary/5"
              >
                VER PROGRAMAÇÃO
              </a>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-6">
              <div>
                <dt className="text-xs tracking-widest text-muted-foreground">DATA</dt>
                <dd className="mt-1 font-display text-xl text-primary">3–5 de Julho</dd>
              </div>
              <div>
                <dt className="text-xs tracking-widest text-muted-foreground">LOCAL</dt>
                <dd className="mt-1 font-display text-xl text-primary">Igreja Esperança</dd>
              </div>
            </dl>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-gold/30 to-primary/20 blur-2xl" />
            <img
              src={hero}
              alt="Hope Conference 2026 — preletores"
              className="relative w-full rounded-xl border border-border shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* SPEAKERS */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <span className="text-xs tracking-[0.35em] text-gold">PRELETORES</span>
            <h2 className="mt-3 font-display text-4xl text-primary md:text-5xl">
              Vozes que inspiram esperança
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {speakers.map((name) => (
              <li
                key={name}
                className="group rounded-lg border border-border bg-card p-6 transition hover:border-gold hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full border border-gold/60 bg-gradient-to-br from-primary/10 to-gold/20" />
                  <div>
                    <p className="text-xs tracking-widest text-muted-foreground">PRELETOR</p>
                    <p className="font-display text-xl text-primary">{name}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PROGRAM */}
      <section id="programacao" className="border-b border-border bg-secondary/40 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <span className="text-xs tracking-[0.35em] text-gold">PROGRAMAÇÃO</span>
            <h2 className="mt-3 font-display text-4xl text-primary md:text-5xl">
              Três dias inesquecíveis
            </h2>
          </div>
          <div className="space-y-6">
            {[
              { day: "Sexta · 03/07", title: "Noite de Abertura", time: "19h30 — 22h00" },
              { day: "Sábado · 04/07", title: "Manhã, Tarde e Noite de Ministrações", time: "09h00 — 22h00" },
              { day: "Domingo · 05/07", title: "Celebração de Encerramento", time: "09h00 — 12h00" },
            ].map((s) => (
              <div
                key={s.day}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-xs tracking-widest text-gold">{s.day.toUpperCase()}</p>
                  <p className="mt-1 font-display text-2xl text-primary">{s.title}</p>
                </div>
                <p className="text-sm text-muted-foreground">{s.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REGISTRATION */}
      <section id="inscricao" className="py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2">
          <div>
            <span className="text-xs tracking-[0.35em] text-gold">INSCRIÇÃO</span>
            <h2 className="mt-3 font-display text-4xl text-primary md:text-5xl">
              Garanta sua vaga
            </h2>
            <p className="mt-4 text-muted-foreground">
              Vagas limitadas. Investimento único de{" "}
              <span className="font-semibold text-primary">R$ 50,00</span> para
              os três dias de conferência, incluindo material do participante.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Acesso a todas as ministrações",
                "Material exclusivo do evento",
                "Credencial oficial Hope Conference",
                "Coffee break nos intervalos",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold" />
                  <span className="text-foreground/80">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-lg border border-border bg-card p-6">
              <p className="text-xs tracking-widest text-muted-foreground">LOCAL</p>
              <p className="mt-1 font-display text-xl text-primary">Igreja Esperança</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Av. Bartolomeu Bueno Qd. 15 Lt. 26
                <br />
                Jd. Mont Serrat — Aparecida de Goiânia / GO
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="rounded-xl border border-border bg-card p-8 shadow-lg"
          >
            <h3 className="font-display text-2xl text-primary">Faça sua inscrição</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha os dados abaixo e finalize o pagamento.
            </p>
            <div className="mt-6 space-y-4">
              <Field
                label="Nome completo"
                value={form.nome}
                onChange={(v) => setForm({ ...form, nome: v })}
              />
              <Field
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <Field
                label="Telefone / WhatsApp"
                value={form.telefone}
                onChange={(v) => setForm({ ...form, telefone: v })}
              />
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
              <div>
                <p className="text-xs tracking-widest text-muted-foreground">TOTAL</p>
                <p className="font-display text-3xl text-primary">R$ 50,00</p>
              </div>
              <button
                type="submit"
                className="rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90"
              >
                CONFIRMAR INSCRIÇÃO
              </button>
            </div>
            {sent && (
              <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-primary">
                Recebemos sua inscrição! Em breve enviaremos os detalhes de pagamento por e-mail.
              </p>
            )}
          </form>
        </div>
      </section>

      <footer className="border-t border-border bg-primary py-10 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="font-display text-2xl">Hope Conference 2026</p>
          <p className="mt-1 text-xs tracking-[0.3em] text-primary-foreground/70">
            IGREJA ESPERANÇA · APARECIDA DE GOIÂNIA — GO
          </p>
        </div>
      </footer>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs tracking-widest text-muted-foreground">
        {label.toUpperCase()}
      </span>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
      />
    </label>
  );
}
