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

import adoracaoEsperanca from "@/assets/band-adoracao-esperanca.png";
import hopeMusic from "@/assets/band-hope-music.png";
import suzanaNazareno from "@/assets/singer-suzana-nazareno.png";
import yesWorship from "@/assets/band-yes-worship.jpg";

const speakers: { name: string; photo?: string; position?: string; zoom?: number }[] = [
  { name: "Pr. Romeu Ivo", photo: wellingtonRocha, position: "50% 30%", zoom: 1.4 },
  { name: "Pr. Ronny Marcos", photo: ronnyMarcos, position: "50% 25%", zoom: 1.4 },
  { name: "Pr. Jocymar Fonseca", photo: hamiltonCesar, position: "50% 30%", zoom: 1.5 },
  { name: "Pr. Hamilton Cesar", photo: jehanPorto, position: "center top", zoom: 1 },
  { name: "Pr. Wellington Rocha", photo: jocymarFonseca, position: "50% 52%", zoom: 1.8 },
  { name: "Pr. Jehan Porto", photo: romeuIvo, position: "50% 30%", zoom: 1.5 },
];

const bands: { name: string; photo: string; position?: string }[] = [
  { name: "Adoração Esperança", photo: adoracaoEsperanca, position: "50% 30%" },
  { name: "Hope Music", photo: hopeMusic, position: "50% 50%" },
  { name: "Suzana Nazareno", photo: suzanaNazareno, position: "50% 30%" },
  { name: "Yes Worship", photo: yesWorship, position: "50% 30%" },
];

function Index() {
  const [inscricoesAbertas, setInscricoesAbertas] = useState(true);
  const [mostrarSegundaHomepage, setMostrarSegundaHomepage] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("inscricoes_abertas, mostrar_segunda_homepage")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInscricoesAbertas(data.inscricoes_abertas);
          setMostrarSegundaHomepage(!!data.mostrar_segunda_homepage);
        }
      });
    const ch = supabase
      .channel("app_settings")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_settings" },
        (payload) => {
          const row = payload.new as { inscricoes_abertas?: boolean; mostrar_segunda_homepage?: boolean };
          if (typeof row.inscricoes_abertas === "boolean") {
            setInscricoesAbertas(row.inscricoes_abertas);
          }
          if (typeof row.mostrar_segunda_homepage === "boolean") {
            setMostrarSegundaHomepage(row.mostrar_segunda_homepage);
          }
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (mostrarSegundaHomepage) {
      document.title = "HOPE CONFERENCE 2027 — Aguarde!!";
    } else {
      document.title = "Hope Conference 2026 — Inscrições | Igreja Esperança";
    }
  }, [mostrarSegundaHomepage]);

  if (mostrarSegundaHomepage) {
    return (
      <main className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col items-center justify-center px-4">
        {/* CSS Animations */}
        <style>{`
          @keyframes spin-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes spin-reverse {
            0% { transform: rotate(360deg); }
            100% { transform: rotate(0deg); }
          }
          @keyframes glow-pulse {
            0%, 100% { opacity: 0.15; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(1.08); }
          }
        `}</style>

        {/* Ambient stained glass background with low opacity */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] select-none pointer-events-none"
          style={{
            backgroundImage: `url(${stainedGlass})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        
        {/* Soft gold ambient glow overlay */}
        <div 
          aria-hidden
          className="absolute w-[500px] h-[500px] rounded-full bg-gold/15 blur-[120px] pointer-events-none select-none"
          style={{ animation: "glow-pulse 6s ease-in-out infinite" }}
        />

        <div className="relative z-10 text-center flex flex-col items-center max-w-lg select-none">
          {/* Animated Header */}
          <div className="space-y-1 animate-in fade-in slide-in-from-top-6 duration-1000">
            <h1 className="font-display font-medium leading-[1.05] tracking-[0.08em] text-white">
              <span className="block text-6xl sm:text-7xl md:text-8xl font-black drop-shadow-[0_2px_10px_rgba(255,255,255,0.05)]">HOPE</span>
              <span className="block text-2xl sm:text-3xl md:text-[2.2rem] tracking-[0.25em] text-gold font-bold mt-1">
                CONFERENCE
              </span>
              <span className="block text-xl sm:text-2xl md:text-3xl tracking-[0.45em] text-white/50 font-light mt-3">
                2 0 2 7
              </span>
            </h1>
          </div>

          {/* Premium Loader Circle */}
          <div className="relative w-28 h-28 mt-14 flex items-center justify-center animate-in fade-in zoom-in-75 duration-1000 delay-200">
            {/* Outer dotted gold ring */}
            <div 
              className="absolute inset-0 rounded-full border-2 border-dashed border-gold/30"
              style={{ animation: "spin-slow 25s linear infinite" }}
            />
            {/* Middle glowing gold ring */}
            <div 
              className="absolute w-22 h-22 rounded-full border-t-2 border-b-2 border-gold shadow-[0_0_15px_rgba(181,146,71,0.2)]"
              style={{ animation: "spin-slow 2.5s linear infinite" }}
            />
            {/* Inner reverse-spinning white/gold ring */}
            <div 
              className="absolute w-16 h-16 rounded-full border-l border-r border-white/40"
              style={{ animation: "spin-reverse 1.8s linear infinite" }}
            />
            {/* Glowing core dot */}
            <div className="w-4 h-4 rounded-full bg-gold shadow-[0_0_15px_rgba(181,146,71,0.8)] animate-pulse" />
          </div>

          {/* Status Subtitle */}
          <div className="mt-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
            <p className="text-gold tracking-[0.3em] font-medium text-xs sm:text-sm uppercase animate-pulse">
              Aguarde!!
            </p>
            <p className="mt-4 text-xs text-muted-foreground/60 max-w-xs mx-auto leading-relaxed">
              Estamos preparando algo extraordinário. <br /> Nos vemos em breve!
            </p>
          </div>
        </div>
      </main>
    );
  }

  const ctaClasses =
    "inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90";
  const ctaDisabled = inscricoesAbertas ? "" : " cursor-not-allowed pointer-events-none";


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
              {inscricoesAbertas ? (
                <Link to="/painel" className={ctaClasses + ctaDisabled}>INSCRIÇÕES — R$50,00</Link>
              ) : (
                <button type="button" disabled className={ctaClasses + ctaDisabled}>INSCRIÇÕES — R$50,00</button>
              )}
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
              PRELETORES
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

      {/* LOUVOR */}
      <section className="border-b border-border py-20 bg-card/10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="font-display text-4xl text-primary md:text-5xl">
              LOUVOR
            </h2>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {bands.map(({ name, photo, position }) => (
              <li
                key={name}
                className="group overflow-hidden rounded-lg border border-border bg-card p-4 transition hover:border-gold hover:shadow-md"
              >
                <div className="overflow-hidden rounded-md border border-border/50 aspect-[4/3] bg-black">
                  <img
                    src={photo}
                    alt={name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ objectPosition: position ?? "center center" }}
                  />
                </div>
                <div className="mt-4 text-center">
                  <p className="font-display text-xl text-primary">{name}</p>
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
                "Acesso aos 3 dias de Conferência",
                "Acesso a LAB escolhida",
                "Material exclusivo do evento",
                "Pulseira Hope Conference",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 justify-center md:justify-start">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
                  <span className="text-foreground/80 text-left">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center md:justify-start">
              {inscricoesAbertas ? (
                <Link to="/painel" className={ctaClasses + ctaDisabled}>INSCRIÇÕES — R$50,00</Link>
              ) : (
                <button type="button" disabled className={ctaClasses + ctaDisabled}>INSCRIÇÕES — R$50,00</button>
              )}
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

