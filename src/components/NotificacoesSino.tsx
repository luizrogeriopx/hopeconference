import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X, ExternalLink } from "lucide-react";

type Notif = {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  criado_em: string;
};

export function NotificacoesSino({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const naoLidas = notifs.filter((n) => !n.lida).length;

  async function carregar() {
    const { data } = await supabase
      .from("notificacoes")
      .select("id, titulo, mensagem, link, lida, criado_em")
      .eq("user_id", userId)
      .order("criado_em", { ascending: false })
      .limit(50);
    setNotifs((data ?? []) as Notif[]);
  }

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` },
        () => carregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function marcarLida(id: string) {
    await supabase.from("notificacoes").update({ lida: true, lida_em: new Date().toISOString() }).eq("id", id);
  }

  async function marcarTodasLidas() {
    const ids = notifs.filter((n) => !n.lida).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notificacoes").update({ lida: true, lida_em: new Date().toISOString() }).in("id", ids);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative rounded-md border border-border px-3 py-2 text-primary hover:bg-muted"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-sm font-semibold text-primary">Notificações</span>
              <div className="flex items-center gap-2">
                {naoLidas > 0 && (
                  <button onClick={marcarTodasLidas} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary">
                    Marcar todas
                  </button>
                )}
                <button onClick={() => setAberto(false)} aria-label="Fechar">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação.</div>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.lida && marcarLida(n.id)}
                    className={`cursor-pointer border-b border-border px-4 py-3 text-sm transition hover:bg-muted/50 ${
                      !n.lida ? "bg-gold/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lida && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gold" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-primary">{n.titulo}</div>
                        <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{n.mensagem}</div>
                        {n.link && (
                          <a
                            href={n.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:underline"
                          >
                            Abrir link <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {new Date(n.criado_em).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
