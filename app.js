// ============================================================
// FANTASY BRASILEIRÃO — Front-end (versão de visualização geral)
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbw49ZmcNopQPyOvNoWzyeJIf3qeCk7N6bkqYb1HgLptMdsVXklI6qRfZjogPNIuCtAv/exec'; // ← troque aqui
const EMAIL = 'sandro@fantasy.com'; // ← adicione esta linha

const state = { franquias: [], jogadores: [], elencos: [], classificacao: [], rodadas: [] };
const POS_LABEL = { GOL: 'GOL', LAT: 'LAT', ZAG: 'ZAG', MEI: 'MEI', ATA: 'ATA' };

// ---------- API ----------
async function api(action, params = {}) {
  const body = new URLSearchParams({ action, email: EMAIL, ...params });
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

// ===== ESCALAÇÃO =====
let escElenco = []; // jogadores da franquia logada

async function carregarEscalacao() {
  const franquia = state.franquias.find(f => f.email === EMAIL);
  if (!franquia) { alert('Franquia não encontrada.'); return; }
  const elenco = await api('getElenco', { franquia_id: franquia.id });
  escElenco = elenco.jogadores || [];
  montarSlots();
  montarCapitaoVeto();
}

function montarSlots() {
  const formacao = document.getElementById('esc-formacao').value;
  const posicoes = { '442': ['GOL','LAT','LAT','ZAG','ZAG','MEI','MEI','MEI','MEI','ATA','ATA'],
                     '433': ['GOL','LAT','LAT','ZAG','ZAG','MEI','MEI','MEI','ATA','ATA','ATA'],
                     '451': ['GOL','LAT','LAT','ZAG','ZAG','MEI','MEI','MEI','MEI','MEI','ATA'],
                     '532': ['GOL','LAT','LAT','LAT','ZAG','ZAG','MEI','MEI','MEI','ATA','ATA'],
                     '541': ['GOL','LAT','LAT','LAT','LAT','ZAG','ZAG','MEI','MEI','MEI','ATA'],
                     '343': ['GOL','LAT','LAT','ZAG','ZAG','ZAG','MEI','MEI','MEI','MEI','ATA'],
                     '352': ['GOL','LAT','LAT','ZAG','ZAG','ZAG','MEI','MEI','MEI','MEI','ATA'] };
  const slots = posicoes[formacao] || posicoes['442'];
  const cont = document.getElementById('esc-titulares');
  cont.innerHTML = '';
  slots.forEach((pos, i) => {
    const div = document.createElement('div');
    div.className = 'esc-slot';
    div.innerHTML = `<div class="slot-pos">${pos} ${i+1}</div>
      <select data-pos="${pos}">
        <option value="">—</option>
        ${escElenco.filter(j => j.posicao === pos).map(j => `<option value="${j.id}">${j.nome}</option>`).join('')}
      </select>`;
    cont.appendChild(div);
  });
  // reservas
  const rcont = document.getElementById('esc-reservas');
  rcont.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const div = document.createElement('div');
    div.className = 'esc-slot';
    div.innerHTML = `<div class="slot-pos">RESERVA ${i+1}</div>
      <select>
        <option value="">—</option>
        ${escElenco.map(j => `<option value="${j.id}">${j.nome} (${j.posicao})</option>`).join('')}
      </select>`;
    rcont.appendChild(div);
  }
}

function montarCapitaoVeto() {
  const cap = document.getElementById('esc-capitao');
  cap.innerHTML = '<option value="">Selecione o capitão</option>' +
    escElenco.map(j => `<option value="${j.id}">${j.nome}</option>`).join('');
  const veto = document.getElementById('esc-veto');
  veto.innerHTML = '<option value="">Selecione o jogador a vetar</option>' +
    escElenco.map(j => `<option value="${j.id}">${j.nome}</option>`).join('');
}

document.getElementById('esc-formacao').addEventListener('change', montarSlots);
document.getElementById('esc-limpar').addEventListener('click', () => { montarSlots(); });

document.getElementById('esc-salvar').addEventListener('click', async () => {
  const franquia = getFranquiaLogada();
  const titulares = [...document.querySelectorAll('#esc-titulares select')].map(s => s.value).filter(Boolean);
  const reservas = [...document.querySelectorAll('#esc-reservas select')].map(s => s.value).filter(Boolean);
  const capitao = document.getElementById('esc-capitao').value;
  const rodada = document.getElementById('esc-rodada').textContent;
  const r = await api({ action: 'salvarEscalacao', franquia_id: franquia.id, rodada, titulares, reservas, capitao_id: capitao, formacao: document.getElementById('esc-formacao').value });
  document.getElementById('esc-msg').textContent = r.ok ? 'Escalação salva!' : (r.error || 'Erro ao salvar.');
});

document.getElementById('esc-veto-salvar').addEventListener('click', async () => {
  const franquia = state.franquias.find(f => f.email === EMAIL);
  const veto = document.getElementById('esc-veto').value;
  const rodada = document.getElementById('esc-rodada').textContent;
  const r = await api({ action: 'registrarVeto', mandante_id: franquia.id, rodada, jogador_vetado_id: veto });
  document.getElementById('esc-msg').textContent = r.ok ? 'Veto registrado!' : (r.error || 'Erro ao registrar veto.');
});
