
# Plano — Sistema de Painéis Hope Conference

## Visão geral
Vou ativar o **Lovable Cloud** (autenticação + banco de dados + storage) e construir 4 painéis com controle de acesso por papel (role). Toda a paleta atual (cream/navy/gold, Nexa/Cormorant) será preservada.

## 1. Backend (Lovable Cloud)

**Tabelas:**
- `profiles` — id (= auth.users.id), email, nome, criado_em
- `user_roles` — id, user_id, role (`super_admin` | `admin` | `gate` | `inscrito`) — tabela separada para evitar escalada de privilégio, com função `has_role()` SECURITY DEFINER
- `inscricoes` — id, comprador_user_id, nome_participante, email, telefone, valor, status (`pendente` | `pago` | `cancelado` | `validado`), qr_token (uuid único), validado_em, validado_por, criado_em
- `pagamentos` — id, inscricao_id, status, metodo, valor, criado_em (registro simples para relatório; integração de pagamento real fica para um próximo passo — agora apenas marcamos como "pago" no fluxo)

**RLS:**
- Inscrito vê só as próprias inscrições
- Admin/Super Admin veem tudo
- Gate (controle de acesso) pode apenas ler `qr_token` e marcar como `validado` (sem reverter)
- Apenas Super Admin pode reverter `validado → pago` e gerenciar usuários dos outros painéis

## 2. Auth & roteamento
- Página `/auth` (login + cadastro de inscrito) — email/senha + Google
- Layout `_authenticated` com guarda em `beforeLoad`
- Sub-layouts por role: `_authenticated/super`, `/admin`, `/gate`, `/painel`
- Botão **PAINEL DO INSCRITO** na home (única referência pública). Links dos outros painéis aparecem só no Super Admin com botão "copiar".

## 3. Painéis

### `/painel` — Inscrito (comprador)
- Lista de inscrições do usuário (uma compra pode ter vários participantes — formulário multi-nome)
- Cada inscrição mostra QR Code (gerado client-side com `qrcode`) com botão **Baixar PNG**
- Card de LOCAL com botões Google Maps / Waze / Uber (reaproveitado da home)
- Fluxo "Nova inscrição" com quantidade + nomes

### `/gate` — Controle de Acesso
- Botão "Abrir câmera" → leitor de QR (`html5-qrcode`)
- Ao ler: chama server fn que valida token, marca como `validado`, retorna nome do participante
- Mostra ✅ Autorizado ou ❌ Já validado / Inválido
- Não vê vendas nem cancelamentos

### `/admin` — Admin
- Relatório de vendas e cancelamentos (totais, gráfico simples, tabela)
- Lista de inscritos com filtro/busca
- Cadastro de usuários do **Painel de Controle de Acesso** (cria auth user + atribui role `gate`)

### `/super` — Super Admin (seu painel)
- Tudo do Admin +
- Cadastro de usuários para qualquer painel (admin, gate)
- Relatório de ingressos validados na entrada
- Abrir câmera para validar entrada
- **Reverter** QR validado → volta a funcionar
- Bloco "Links dos painéis" com botões **Copiar** para `/admin`, `/gate`, `/painel`

## 4. Detalhes técnicos
- QR Code: lib `qrcode` (geração) e `html5-qrcode` (leitura por câmera)
- Validação: `createServerFn` com `requireSupabaseAuth` + checagem de role `gate` ou `super_admin`
- Reverter validação: server fn restrita a `super_admin`
- Download QR: canvas → `toDataURL` → link `download`
- Design: mesmas cores/fontes da home; cards com `bg-card`, borda dourada sutil, sombras suaves; tabelas responsivas (cards no mobile)

## 5. Entrega faseada
Como é grande, sugiro **fazer em 2 passos** dentro deste mesmo loop:

**Passo A (este loop):**
1. Ativar Cloud
2. Migration (tabelas + RLS + função has_role + trigger de profile)
3. Página `/auth` + guarda `_authenticated` + redirecionamento por role
4. Painel do Inscrito completo (inscrição, QR, download, card de local)
5. Botão "Painel do Inscrito" na home

**Passo B (próxima mensagem):**
6. Painel Gate (câmera + validação)
7. Painel Admin (relatórios + cadastro gate)
8. Painel Super Admin (tudo + reverter + copiar links)

## Perguntas antes de começar
1. **Pagamento agora ou depois?** Posso deixar o status "pago" automático ao se inscrever (mock) e integrar Stripe/PIX depois — ok?
2. **Seu usuário Super Admin:** qual e-mail devo promover automaticamente a `super_admin` na primeira execução? (Você cria a conta normalmente em `/auth` e a migration garante esse e-mail como super.)
3. **Valor da inscrição:** mantenho R$50,00 fixo?

Confirma o plano (e responde as 3 perguntas) que eu já parto para o Passo A.
