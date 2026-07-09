import { useMemo, useState } from "react";
import { regionaisCongregacoes } from "@/lib/regionais";

export type InscricaoRel = {
  id: string;
  nome_participante: string;
  email: string | null;
  telefone?: string | null;
  status: "pendente" | "pago" | "cancelado" | "validado";
  valor: number;
  criado_em: string;
  regional: string;
  congregacao: string;
  lab_id: string | null;
  labs?: { nome: string; local?: string } | null;
  ministerio_id?: string | null;
  ministerios?: { nome: string } | null;
  pagamentos?: { metodo: string }[] | null;
};

type Lab = { id: string; nome: string; local?: string; eh_geral?: boolean };
type Ministerio = { id: string; nome: string };

const REGIONAIS = ["SEDE", ...Array.from({ length: 20 }, (_, i) => String(i + 2))];
const labelRegional = (r: string) => (r === "SEDE" ? "Regional 01 (SEDE)" : `Regional ${r}`);

function formaPagamentoDe(i: InscricaoRel): string {
  const p = i.pagamentos?.[0]?.metodo;
  if (!p) return Number(i.valor) === 0 ? "isento" : "—";
  return p;
}

function categoriaFormaPagamento(metodo: string): "PIX" | "Cartão" | "Dinheiro" | "Isento" | "Outro" {
  const m = metodo.toLowerCase();
  if (m === "pix") return "PIX";
  if (m === "dinheiro") return "Dinheiro";
  if (m === "isento") return "Isento";
  if (["visa", "master", "mastercard", "elo", "amex", "hipercard", "cartao", "cartão", "mercado_pago", "mercadopago", "credito", "crédito", "debito", "débito"].includes(m)) return "Cartão";
  return "Outro";
}

function baseHtml(titulo: string, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#111}
  h1{font-size:20px;margin:0 0 4px 0}
  h2{font-size:15px;margin:22px 0 6px 0;border-bottom:1px solid #ddd;padding-bottom:4px}
  h3{font-size:13px;margin:14px 0 4px 0;color:#444}
  .meta{color:#666;font-size:12px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f5f5f5}
  .tot{background:#fafafa;font-weight:600}
  .right{text-align:right}
  .noprint{margin-bottom:12px}
  @media print{.noprint{display:none}}
  .badge{display:inline-block;padding:2px 6px;border-radius:4px;background:#eee;font-size:11px;margin-right:6px}
</style></head><body>
<div class="noprint"><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>
<h1>${titulo}</h1>
<div class="meta">Hope Conference — Gerado em ${new Date().toLocaleString("pt-BR")}</div>
${corpo}
</body></html>`;
}

function abrirRelatorio(titulo: string, corpo: string) {
  const html = baseHtml(titulo, corpo);
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para visualizar o relatório."); return; }
  w.document.write(html);
  w.document.close();
}

function esc(s: string | null | undefined): string {
  return (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]!));
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tabelaInscricoes(list: InscricaoRel[]): string {
  const rows = list.map((i) => `
    <tr>
      <td>${esc(i.nome_participante)}</td>
      <td>${esc(i.email ?? "")}</td>
      <td>${esc(i.telefone ?? "")}</td>
      <td>${esc(i.labs?.nome ?? "—")}</td>
      <td>${esc(i.status)}</td>
      <td>${esc(formaPagamentoDe(i))}</td>
      <td class="right">${formatBRL(Number(i.valor) || 0)}</td>
    </tr>`).join("");
  const total = list.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  return `<table>
    <thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Categoria</th><th>Status</th><th>Forma Pgto.</th><th class="right">Valor</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#888">Sem inscrições</td></tr>`}</tbody>
    <tfoot><tr class="tot"><td colspan="6" class="right">Total (${list.length})</td><td class="right">${formatBRL(total)}</td></tr></tfoot>
  </table>`;
}

function apenasConfirmadas(list: InscricaoRel[]) {
  return list.filter((i) => i.status === "pago" || i.status === "validado");
}

export function Relatorios({
  inscricoes,
  labs,
  ministerios,
}: {
  inscricoes: InscricaoRel[];
  labs: Lab[];
  ministerios: Ministerio[];
}) {
  const [regionalSel, setRegionalSel] = useState<string>("2");
  const [labSel, setLabSel] = useState<string>("");

  const confirmadas = useMemo(() => apenasConfirmadas(inscricoes), [inscricoes]);

  function relatorioRegional(regional: string) {
    const lista = confirmadas.filter((i) => i.regional === regional);
    const congregs = Array.from(new Set(lista.map((i) => i.congregacao || "—"))).sort();
    const secoes = congregs.map((cong) => {
      const sub = lista.filter((i) => (i.congregacao || "—") === cong);
      return `<h3>${esc(cong)} <span class="badge">${sub.length}</span></h3>${tabelaInscricoes(sub)}`;
    }).join("");
    const titulo = `Relatório — ${labelRegional(regional)}`;
    const cabec = `<div class="meta"><b>${lista.length}</b> inscrição(ões) confirmada(s) em <b>${congregs.length}</b> congregação(ões).</div>`;
    abrirRelatorio(titulo, cabec + (secoes || "<p>Sem dados.</p>"));
  }

  function relatorioTodasRegionais() {
    const secoes = REGIONAIS.map((r) => {
      const lista = confirmadas.filter((i) => i.regional === r);
      if (lista.length === 0) return "";
      const congregs = Array.from(new Set(lista.map((i) => i.congregacao || "—"))).sort();
      const sub = congregs.map((cong) => {
        const s = lista.filter((i) => (i.congregacao || "—") === cong);
        return `<h3>${esc(cong)} <span class="badge">${s.length}</span></h3>${tabelaInscricoes(s)}`;
      }).join("");
      const label = labelRegional(r);
      return `<h2>${label} — ${lista.length} inscrição(ões)</h2>${sub}`;
    }).join("");
    abrirRelatorio("Relatório — Todas as Regionais", secoes || "<p>Sem dados.</p>");
  }

  function relatorioSedePorMinisterio() {
    const lista = confirmadas.filter((i) => i.regional === "SEDE");
    const grupos = new Map<string, InscricaoRel[]>();
    lista.forEach((i) => {
      const nome = i.ministerios?.nome ?? "Sem ministério";
      const arr = grupos.get(nome) ?? [];
      arr.push(i);
      grupos.set(nome, arr);
    });
    const secoes = Array.from(grupos.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([nome, sub]) => `<h2>${esc(nome)} <span class="badge">${sub.length}</span></h2>${tabelaInscricoes(sub)}`)
      .join("");
    const cabec = `<div class="meta"><b>${lista.length}</b> inscrição(ões) da Sede.</div>`;
    abrirRelatorio("Relatório — Sede por Ministério", cabec + (secoes || "<p>Sem dados.</p>"));
  }

  function relatorioFormaPagamento() {
    const grupos = new Map<string, InscricaoRel[]>();
    confirmadas.forEach((i) => {
      const cat = categoriaFormaPagamento(formaPagamentoDe(i));
      const arr = grupos.get(cat) ?? [];
      arr.push(i);
      grupos.set(cat, arr);
    });
    const ordem = ["PIX", "Cartão", "Dinheiro", "Isento", "Outro"];
    const resumo = `<table><thead><tr><th>Forma</th><th class="right">Qtd.</th><th class="right">Total</th></tr></thead><tbody>${
      ordem.map((cat) => {
        const sub = grupos.get(cat) ?? [];
        const tot = sub.reduce((s, i) => s + (Number(i.valor) || 0), 0);
        return `<tr><td>${cat}</td><td class="right">${sub.length}</td><td class="right">${formatBRL(tot)}</td></tr>`;
      }).join("")
    }</tbody></table>`;
    const secoes = ordem.map((cat) => {
      const sub = grupos.get(cat) ?? [];
      if (sub.length === 0) return "";
      return `<h2>${cat} <span class="badge">${sub.length}</span></h2>${tabelaInscricoes(sub)}`;
    }).join("");
    abrirRelatorio("Relatório — Forma de Pagamento", resumo + secoes);
  }

  function relatorioLabs(labId?: string) {
    const alvo = labId ? labs.filter((l) => l.id === labId) : labs;
    const secoes = alvo.map((lab) => {
      const sub = confirmadas.filter((i) => i.lab_id === lab.id);
      return `<h2>${esc(lab.nome)}${lab.local ? ` <span class="badge">${esc(lab.local)}</span>` : ""} <span class="badge">${sub.length}</span></h2>${tabelaInscricoes(sub)}`;
    }).join("");
    const titulo = labId ? `Relatório — LAB ${alvo[0]?.nome ?? ""}` : "Relatório — Todos os LABs";
    abrirRelatorio(titulo, secoes || "<p>Sem dados.</p>");
  }

  const btn = "rounded-md border border-gold bg-gold/10 px-3 py-2 text-[11px] tracking-widest uppercase text-primary hover:bg-gold/20 transition";
  const select = "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold";

  return (
    <section id="relatorios" className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
      <div>
        <h2 className="font-display text-xl text-primary">Relatórios</h2>
        <p className="text-xs text-muted-foreground mt-1">Gere relatórios imprimíveis (PDF) das inscrições confirmadas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Por Regional</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select value={regionalSel} onChange={(e) => setRegionalSel(e.target.value)} className={select}>
              {REGIONAIS.map((r) => (
                <option key={r} value={r}>{labelRegional(r)}</option>
              ))}
            </select>
            <button type="button" className={btn} onClick={() => relatorioRegional(regionalSel)}>Gerar regional</button>
            <button type="button" className={btn} onClick={relatorioTodasRegionais}>Todas as regionais</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Cada regional é detalhada por congregação.</p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Sede por Ministério</h3>
          <button type="button" className={btn} onClick={relatorioSedePorMinisterio}>Gerar relatório</button>
          <p className="text-[11px] text-muted-foreground">Agrupa {ministerios.length} ministério(s) da sede.</p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Por Forma de Pagamento</h3>
          <button type="button" className={btn} onClick={relatorioFormaPagamento}>Gerar relatório</button>
          <p className="text-[11px] text-muted-foreground">Separa PIX, Cartão, Dinheiro e Isento.</p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Por LABs</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select value={labSel} onChange={(e) => setLabSel(e.target.value)} className={select}>
              <option value="">— Selecionar LAB —</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
            <button type="button" className={btn} disabled={!labSel} onClick={() => relatorioLabs(labSel)}>Gerar LAB</button>
            <button type="button" className={btn} onClick={() => relatorioLabs()}>Todos os LABs</button>
          </div>
        </div>
      </div>
      {/* silencia warning de import não utilizado */}
      <span className="hidden">{Object.keys(regionaisCongregacoes).length}</span>
    </section>
  );
}
