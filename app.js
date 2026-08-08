// ============================================================
// FANTASY BRASILEIRÃO — Front-end (versão de visualização geral)
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbw49ZmcNopQPyOvNoWzyeJIf3qeCk7N6bkqYb1HgLptMdsVXklI6qRfZjogPNIuCtAv/exec'; // ← troque aqui

const state = { franquias: [], jogadores: [], elencos: [], classificacao: [], rodadas: [] };
const POS_LABEL = { GOL: 'GOL', LAT: 'LAT', ZAG: 'ZAG', MEI: 'MEI', ATA: 'ATA' };

// ---------- API ----------
async function api(action, params = {}) {
  const body = new URLSearchParams({ action, ...params });
  const res = await fetch(API_URL, { method: 'POST', body });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Erro na API');
  return json.data;
}

// ---------- Carregamento ----------
async function carregarTudo() {
  try {
    const [franquias, jogadores, elencos, classificacao] = await Promise.all([
      api('getFranquias'), api('getJogadores'), api('getElencos'), api('getClassificacao')
    ]);
    state.franquias = franquias;
    state.jogadores = jogadores;
    state.elencos = elencos;
    state.classificacao = classificacao;
    renderTudo();
    toast('Dados atualizados.');
  } catch (e) {
    toast('Falha ao carregar: ' + e.message, true);
  }
}

// ---------- Helpers ----------
function franquiaNome(id) {
  const f = state.franquias.find(f => String(f.id) === String(id));
  return f ? f.nome : '—';
}
function jogadorNome(id) {
  const j = state.jogadores.find(j => String(j.id) === String(id));
  return j ? j.nome : '—';
}
function posBadge(pos, status) {
  const st = status === 'DM' ? 'dm' : status === 'emprestado' ? 'emp' : pos.toLowerCase();
  const label = status === 'DM' ? 'DM' : status === 'emprestado' ? 'EMP' : POS_LABEL[pos] || pos;
  return `<span class="badge ${st}">${label}</span>`;
}

// ---------- Render ----------
function renderTudo() {
  renderClassificacao();
  renderFranquias();
  renderElencoSelects();
  renderMercadoSelects();
  renderElenco();
}

function renderClassificacao() {
  const el = document.getElementById('classificacao');
  if (!state.classificacao.length) { el.innerHTML = '<div class="placeholder">Sem dados ainda.</div>'; return; }
  const rows = state.classificacao
    .sort((a, b) => (b.pontos - a.pontos) || (b.vitorias - a.vitorias) || (b.pontos_marcados - a.pontos_marcados))
    .map((c, i) => `
      <tr class="${i === 0 ? 'top1' : ''}">
        <td class="pos">${i + 1}º</td>
        <td>${franquiaNome(c.franquia_id)}</td>
        <td>${c.pontos}</td>
        <td>${c.vitorias}</td>
        <td>${c.pontos_marcados}</td>
      </tr>`).join('');
  el.innerHTML = `<table><thead><tr><th>#</th><th>Franquia</th><th>Pontos</th><th>Vitórias</th><th>Pts marcados</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderFranquias() {
  const el = document.getElementById('franquias');
  el.innerHTML = state.franquias.map(f => `
    <div class="card">
      <div class="cor" style="background:${f.cor || '#22d3ee'}"></div>
      <h3>${f.nome}</h3>
      <p><strong>Manager:</strong> ${f.manager || '—'}</p>
      <p><strong>Estádio:</strong> ${f.estadio || '—'}</p>
      <p class="estadio"><strong>Draft:</strong> ${f.posicao_draft || '—'}º</p>
    </div>`).join('');
}

function renderElencoSelects() {
  const sel = document.getElementById('selElencoFranquia');
  sel.innerHTML = state.franquias.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  sel.onchange = renderElenco;
}

function renderElenco() {
  const fid = document.getElementById('selElencoFranquia').value;
  const el = document.getElementById('elenco');
  const meus = state.elencos.filter(e => String(e.franquia_id) === String(fid));
  if (!meus.length) { el.innerHTML = '<div class="placeholder">Elenco vazio.</div>'; return; }
  const rows = meus.map(e => {
    const j = state.jogadores.find(j => String(j.id) === String(e.jogador_id));
    if (!j) return '';
    return `<tr>
      <td>${j.nome}</td>
      <td>${posBadge(j.posicao, j.status)}</td>
      <td>${j.time_real}</td>
      <td>${e.posicao_elenco}</td>
      <td>${j.status === 'DM' ? '<span class="badge dm">DM</span>' : j.status === 'emprestado' ? '<span class="badge emp">Empréstimo</span>' : 'Ativo'}</td>
    </tr>`;
  }).join('');
  el.innerHTML = `<table><thead><tr><th>Jogador</th><th>Pos</th><th>Time</th><th>Elenco</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderMercadoSelects() {
  const f1 = document.getElementById('mercadoFranquia');
  const f2 = document.getElementById('trocaFranquiaA');
  const f3 = document.getElementById('trocaFranquiaB');
  const opts = state.franquias.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  [f1, f2, f3].forEach(s => s.innerHTML = opts);

  const jSel = document.getElementById('mercadoJogador');
  jSel.innerHTML = state.jogadores
    .filter(j => !j.dono_id)
    .map(j => `<option value="${j.id}">${j.nome} (${j.posicao} — ${j.time_real})</option>`).join('');
}

// ---------- Ações ----------
async function contratar() {
  const fid = document.getElementById('mercadoFranquia').value;
  const jid = document.getElementById('mercadoJogador').value;
  const msg = document.getElementById('msgContratar');
  if (!jid) { msg.className = 'msg err'; msg.textContent = 'Selecione um jogador.'; return; }
  try {
    const r = await api('contratar', { franquia_id: fid, jogador_id: jid });
    msg.className = 'msg ok'; msg.textContent = r.msg || 'OK.';
    carregarTudo();
  } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
}

async function trocar() {
  const a = document.getElementById('trocaFranquiaA').value;
  const b = document.getElementById('trocaFranquiaB').value;
  const ja = document.getElementById('trocaJogadoresA').value.split(',').map(s => s.trim()).filter(Boolean);
  const jb = document.getElementById('trocaJogadoresB').value.split(',').map(s => s.trim()).filter(Boolean);
  const msg = document.getElementById('msgTroca');
  try {
    const r = await api('trocar', { franquia_a: a, franquia_b: b, jogadores_a: ja.join(','), jogadores_b: jb.join(',') });
    msg.className = 'msg ok'; msg.textContent = r.msg || 'OK.';
    carregarTudo();
  } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
}

// ---------- Navegação ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
  };
});

document.getElementById('btnRefresh').onclick = carregarTudo;
document.getElementById('btnContratar').onclick = contratar;
document.getElementById('btnTrocar').onclick = trocar;

function toast(msg, err = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  setTimeout(() => t.className = 'toast', 3000);
}

carregarTudo();
