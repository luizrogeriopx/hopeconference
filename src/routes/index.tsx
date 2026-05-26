import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import hero from "@/assets/hope-speakers.png";
import stainedGlass from "@/assets/stained-glass-bg.jpg";
import { LocalCard } from "@/components/LocalCard";
import { supabase } from "@/integrations/supabase/client";



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

import ronnyMarcos from "@/assets/speaker-ronny-marcos.jpg";
import romeuIvo from "@/assets/speaker-romeu-ivo.png";
import jocymarFonseca from "@/assets/speaker-jocymar-fonseca.png";
import hamiltonCesar from "@/assets/speaker-hamilton-cesar.png";
import wellingtonRocha from "@/assets/speaker-wellington-rocha.png";
import jehanPorto from "@/assets/speaker-jehan-porto.png";

const speakers: { name: string; photo?: string; position?: string; zoom?: number }[] = [
  { name: "Pr. Ronny Marcos", photo: ronnyMarcos, position: "50% 25%", zoom: 1.4 },
  { name: "Pr. Romeu Ivo", photo: wellingtonRocha, position: "50% 30%", zoom: 1.4 },
  { name: "Pr. Jocymar Fonseca", photo: hamiltonCesar, position: "50% 30%", zoom: 1.5 },
  { name: "Pr. Hamilton Cesar", photo: jehanPorto, position: "center top", zoom: 1 },
  { name: "Pr. Wellington Rocha", photo: jocymarFonseca, position: "50% 52%", zoom: 1.8 },
  { name: "Pr. Jehan Porto", photo: romeuIvo, position: "50% 30%", zoom: 1.5 },
];

function Index() {
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
        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-2 md:gap-10 md:py-24">
          <div className="order-2 flex flex-col items-center justify-center text-center md:order-1 md:items-start md:text-left">
            <h1 className="font-display font-medium leading-[1.05] text-primary">
              <span className="block text-6xl sm:text-7xl md:text-9xl tracking-[0.05em]">HOPE</span>
              <span className="block text-xl sm:text-2xl md:text-[2.6rem] tracking-[0.2em] text-primary mt-2">
                CONFERENCE
              </span>
              <span className="block text-lg sm:text-xl md:text-2xl tracking-[0.4em] text-muted-foreground mt-3">
                2 0 2 6
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base sm:text-lg leading-relaxed text-muted-foreground">
              Três dias de palavra, adoração e comunhão. Uma conferência para
              renovar a esperança e fortalecer a fé.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <Link
                to="/painel"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90"
              >
                INSCRIÇÕES — R$50,00
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-6 md:justify-start">
              <div>
                <dt className="text-xs tracking-widest text-muted-foreground">DATA</dt>
                <dd className="mt-1 font-display text-lg sm:text-xl text-primary">3 a 5 de Julho</dd>
              </div>
              <div>
                <dt className="text-xs tracking-widest text-muted-foreground">LOCAL</dt>
                <dd className="mt-1 text-lg sm:text-xl leading-tight text-primary">
                  <span style={{ fontFamily: '"Nexa Book", sans-serif' }}>IGREJA</span>{" "}
                  <span style={{ fontFamily: '"Nexa Heavy", sans-serif' }}>ESPERANÇA</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="order-1 relative flex items-start justify-center md:order-2 md:items-center -mt-4 md:mt-1">
            <img
              src={hero}
              alt="Hope Conference 2026 — preletores"
              className="relative w-full max-w-lg md:max-w-3xl md:scale-125"
            />
          </div>
        </div>
      </section>

      {/* SPEAKERS */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="font-display text-4xl text-primary md:text-5xl">
              Vozes que inspiram esperança
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {speakers.map(({ name, photo, position, zoom }) => (
              <li
                key={name}
                className="group rounded-lg border border-border bg-card p-6 transition hover:border-gold hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  {photo ? (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gold/60 bg-black">
                      <img
                        src={photo}
                        alt={name}
                        className="h-full w-full object-cover"
                        style={{ objectPosition: position ?? "center top", transform: `scale(${zoom ?? 1})`, transformOrigin: position ?? "center top" }}
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-full border border-gold/60 bg-gradient-to-br from-primary/10 to-gold/20" />
                  )}
                  <div>
                    <p className="font-display text-xl text-primary">{name}</p>
                    <p className="text-xs tracking-widest text-muted-foreground">PALAVRA</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>


      {/* REGISTRATION CTA */}
      <section id="inscricao" className="py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2 md:items-center">
          <div className="text-center md:text-left">
            <span className="text-xs tracking-[0.35em] text-gold">INSCRIÇÃO</span>
            <h2 className="mt-3 font-display text-4xl text-primary md:text-5xl">
              Garanta sua vaga
            </h2>
            <p className="mt-4 text-muted-foreground">
              Vagas limitadas. Investimento único de{" "}
              <span className="font-semibold text-primary">R$ 50,00</span> para
              os três dias de conferência.
            </p>
            <ul className="mt-8 mx-auto max-w-sm space-y-3 text-sm md:mx-1 md:max-w-none">
              {[
                "Acesso a todas as ministrações",
                "Material exclusivo do evento",
                "Credencial oficial Hope Conference",
                "Coffee break nos intervalos",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 justify-center md:justify-start">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
                  <span className="text-foreground/80 text-left">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center md:justify-start">
              <Link
                to="/painel"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90"
              >
                INSCRIÇÕES — R$50,00
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md md:mx-0">
            <LocalCard />
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-primary py-10 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="font-display text-2xl uppercase">Hope Conference 2026</p>
          <p className="mt-1 text-sm tracking-[0.3em]">
            <span style={{ fontFamily: '"Nexa Book", sans-serif' }}>IGREJA</span>{" "}
            <span style={{ fontFamily: '"Nexa Heavy", sans-serif' }}>ESPERANÇA</span>
          </p>
          <p className="mt-0.5 text-xs tracking-[1em] text-primary-foreground/70">O ANO DA PROMESSA</p>
        </div>
      </footer>
    </main>
  );
}

