/* ========== positions_ui.js – 无持仓时也保证刷新栏目按钮颜色 ========== */
const selectedSet = new Set();

function getCurrentPositions() {
  return data.positions.filter(p => {
    if (p.categoryId !== currentCategoryId) return false;
    if (!dateStart && !dateEnd) return true;
    const d = new Date(p.joinDate); d.setHours(0, 0, 0, 0);
    const start = dateStart ? new Date(dateStart) : null; if (start) start.setHours(0, 0, 0, 0);
    const end = dateEnd ? new Date(dateEnd) : null; if (end) end.setHours(23, 59, 59, 999);
    if (start && d < start) return false; if (end && d > end) return false; return true;
  });
}

function buildMiniCal(y, m) {
  const wrap = document.getElementById('miniCal'); if (!wrap) return;
  wrap.innerHTML = '';
  const nav = document.createElement('div'); nav.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;grid-column:1/-1';
  const prev = document.createElement('button'); prev.textContent = '‹';
  prev.onclick = () => { if (m === 1) { calYear = y - 1; calMonth = 12; } else { calYear = y; calMonth = m - 1; } buildMiniCal(calYear, calMonth); };
  const title = document.createElement('div'); title.className = 'cal-title'; title.style.textAlign = 'center'; title.style.flex = '1'; title.textContent = `${y}年${m.toString().padStart(2,'0')}月`;
  const next = document.createElement('button'); next.textContent = '›';
  next.onclick = () => { if (m === 12) { calYear = y + 1; calMonth = 1; } else { calYear = y; calMonth = m + 1; } buildMiniCal(calYear, calMonth); };
  nav.appendChild(prev); nav.appendChild(title); nav.appendChild(next); wrap.appendChild(nav);
  WEEK_HEAD.forEach(w => { const span = document.createElement('div'); span.className = 'cal-weekday'; span.textContent = w; wrap.appendChild(span); });
  const firstDay = new Date(y, m - 1, 1).getDay(); const daysInMonth = new Date(y, m, 0).getDate();
  for (let i = 0; i < firstDay; i++) wrap.appendChild(document.createElement('div'));
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const has = data.positions.some(p => p.joinDate === dt && p.categoryId === currentCategoryId);
    const btn = document.createElement('button'); btn.textContent = d; btn.className = has ? 'has' : '';
    btn.onclick = () => { const input = document.getElementById('startDate'); if (input) { input.value = dt; dateStart = dt; dateEnd = dt; input.dispatchEvent(new Event('change')); } };
    wrap.appendChild(btn);
  }
}

function render() {
  const list = getCurrentPositions(); sortList(list);
  const tb = document.querySelector('#stockTable tbody'); const empty = document.getElementById('emptyTip');
  if (!tb) return; tb.innerHTML = '';
  if (!list.length) {
    if (empty) empty.style.display = 'block';
    document.getElementById('stockTable').style.display = 'table';
    /* 保证没持仓时也刷新按钮颜色/日历 */
    renderCategoryTabs();
    buildMiniCal(calYear, calMonth);
    return;
  }
  if (empty) empty.style.display = 'none'; document.getElementById('stockTable').style.display = 'table';
  list.forEach(it => {
    if (searchKey && !`${it.clientName}|${it.code}|${it.name}`.toLowerCase().includes(searchKey)) return;
    const current = it.current ?? it.cost ?? 0; const dayRate = (it.dayRate ?? 0).toFixed(2); const profit = it.profit ?? 0; const profitPct = it.profitPct ?? 0; const marketValue = it.marketValue ?? 0;
    const tr = document.createElement('tr'); tr.dataset.id = it.id; if (selectedSet.has(it.id)) tr.classList.add('selected');
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${esc(it.id)}" ${selectedSet.has(it.id)?'checked':''}></td>
      <td data-label="客户姓名">${esc(it.clientName)}<br><small style="color:#999;">${esc(it.code)}</small></td>
      <td data-label="加入时间">${esc(it.joinDate)}</td>
      <td data-label="股票名称/市值"><b>${esc(it.name)}</b><br>${marketValue.toFixed(2)}</td>
      <td data-label="现价/成本">${current.toFixed(3)}<br>${it.cost.toFixed(3)}</td>
      <td data-label="当日涨幅" class="${dayRate >= 0 ? 'profit-positive' : 'profit-negative'}">${dayRate >= 0 ? '+' : ''}${dayRate}%</td>
      <td data-label="持股数">${it.quantity}</td>
      <td data-label="盈亏" class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${profit >= 0 ? '+' : ''}${profit.toFixed(2)}<br>${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%</td>
      <td>
        <button type="button" class="op-btn" onclick="handleEdit(${data.positions.findIndex(p=>p.id===it.id)})">编辑</button>
        <button type="button" class="op-btn" onclick="handlePin(${data.positions.findIndex(p=>p.id===it.id)})">${it.pinned ? '取消置顶' : '置顶'}</button>
        <button type="button" class="op-btn del" onclick="handleDelete(${data.positions.findIndex(p=>p.id===it.id)})">删除</button>
      </td>`;
    tr.addEventListener('click', e => { if (e.target.classList.contains('op-btn')||e.target.classList.contains('row-check')) return; window.open(`https://www.iwencai.com/unifiedwap/result?w=${encodeURIComponent(it.code)}&querytype=stock`, '_blank'); });
    tb.appendChild(tr);
  });
  bindBatchSelect(); syncSelectAllState(); renderCategoryTabs(); buildMiniCal(calYear, calMonth);
}

function bindBatchSelect() {
  const allCheck = document.getElementById('selectAll');
  if (allCheck) allCheck.onchange = () => { const rowChecks = document.querySelectorAll('.row-check'); rowChecks.forEach(ch => { ch.checked = allCheck.checked; toggleSelectRow(ch.dataset.id, allCheck.checked); }); render(); };
  const rowChecks = document.querySelectorAll('.row-check');
  rowChecks.forEach(ch => { ch.onchange = (e) => { e.stopPropagation(); toggleSelectRow(ch.dataset.id, ch.checked); render(); }; });
}

function syncSelectAllState(){
  const allBox=document.getElementById('selectAll'); if(!allBox)return;
  const rc=[...document.querySelectorAll('.row-check')];
  allBox.checked=rc.length&&rc.every(c=>c.checked);
}

function toggleSelectRow(id, checked) { if (checked) selectedSet.add(id); else selectedSet.delete(id); }

function invertSelection() {
  const list = getCurrentPositions();
  list.forEach(p => { if (selectedSet.has(p.id)) selectedSet.delete(p.id); else selectedSet.add(p.id); });
  render();
}

function handleDelete(globalIdx) { if (selectedSet.size) { batchDelete(); } else { delItem(globalIdx); } }

function handlePin(globalIdx) { if (selectedSet.size) { batchPin(); } else { togglePin(globalIdx); } }

function handleEdit(globalIdx) { if (selectedSet.size) { batchEdit(); } else { editItem(globalIdx); } }

function selectedIdxArr() { return [...selectedSet].map(id => data.positions.findIndex(p => p.id === id)).filter(i => i !== -1); }

function batchDelete() {
  const arr = selectedIdxArr();
  if (!arr.length) return;
  if (!confirm(`确定删除选中的 ${arr.length} 条？`)) return;
  arr.sort((a, b) => b - a).forEach(i => data.positions.splice(i, 1));
  selectedSet.clear(); save(); render();
}

function batchPin() {
  const arr = selectedIdxArr();
  if (!arr.length) return;
  const toPin = [];
  arr.sort((a, b) => b - a).forEach(i => toPin.unshift(...data.positions.splice(i, 1)));
  toPin.forEach(p => p.pinned = true);
  data.positions.unshift(...toPin);
  selectedSet.clear(); save(); render();
}

function togglePin(globalIdx) {
  const p = data.positions[globalIdx];
  if (!p) return;
  
  if (p.pinned) {
    p.pinned = false;
    save();
    render();
  } else {
    p.pinned = true;
    data.positions.splice(globalIdx, 1);
    data.positions.unshift(p);
    save();
    render();
  }
}

function batchEdit() {
  const arr = selectedIdxArr();
  if (!arr.length) return;
  const newCatId = prompt('请输入新栏目 ID（可先在外部栏目管理里复制）', currentCategoryId);
  if (!newCatId || !data.categories.find(c => c.id === newCatId)) return;
  arr.forEach(i => data.positions[i].categoryId = newCatId);
  selectedSet.clear(); save(); render();
}

function fillCategorySelect(selectedId = currentCategoryId) {
  const sel = document.getElementById('categorySelect'); if (!sel) return;
  sel.innerHTML = '';
  data.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    if (cat.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function showAddModal() {
  editingIdx = -1;
  closeModal();
  resetModal();
  document.getElementById('qty').value = '100';
  fillCategorySelect();
  document.getElementById('editModal').style.display = 'block';
}

function closeModal() { document.getElementById('editModal').style.display = 'none'; }

function resetModal() {
  ['code', 'name', 'cost', 'clientName'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('joinDate').value = fmtDate();
  delete document.getElementById('editModal').dataset.current;
  delete document.getElementById('editModal').dataset.dayRate;
  fillCategorySelect(currentCategoryId);
}

async function autoName() {
  const code = document.getElementById('code').value.trim();
  if (!code) return;
  const tcode = (code.startsWith('6') ? 'sh' : 'sz') + code;
  try {
    const buf = await (await fetch(`https://qt.gtimg.cn/q=${tcode}`, { referrer: 'https://stock.gtimg.cn/' })).arrayBuffer();
    const arr = new TextDecoder('gbk').decode(buf).split('~');
    const name = arr[1] || '';
    if (!name || name === '-') { alert('股票代码有误，请检查！'); document.getElementById('name').value = ''; return; }
    document.getElementById('name').value = name;
    document.getElementById('editModal').dataset.current = parseFloat(arr[3]) || 0;
    document.getElementById('editModal').dataset.dayRate = ((parseFloat(arr[3]) - parseFloat(arr[4])) / parseFloat(arr[4]) * 100) || 0;
  } catch (e) { console.error(e); alert('网络异常，未能识别股票代码！'); }
}

function editItem(globalIdx) {
  editingIdx = globalIdx;
  const it = data.positions[globalIdx];
  ['code','name','cost','quantity','joinDate'].forEach(k=>{ const el=document.getElementById(k==='quantity'?'qty':k); if(el) el.value=it[k]; });
  let clientInput = document.getElementById('clientName');
  if (!clientInput) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = '<label>客户姓名</label><input id="clientName" type="text">';
    document.querySelector('.form-grid').prepend(group);
    clientInput = document.getElementById('clientName');
  }
  clientInput.value = it.clientName;
  fillCategorySelect(it.categoryId);
  document.getElementById('editModal').style.display = 'block';
}

function delItem(globalIdx) { if (confirm('确定删除？')) { data.positions.splice(globalIdx, 1); save(); render(); } }

function savePosition() {
  const clientName = document.getElementById('clientName')?.value.trim() || '';
  const code = document.getElementById('code').value.trim();
  const name = document.getElementById('name').value.trim();
  const qty = Number(document.getElementById('qty').value);
  const cost = Number(document.getElementById('cost').value);
  const joinDate = document.getElementById('joinDate').value;
  const categoryId = document.getElementById('categorySelect')?.value || currentCategoryId;
  if (!clientName) { alert('客户姓名不能为空'); return; }
  if (!code) { alert('股票代码不能为空'); return; }
  if (!name) { alert('股票名称未识别，请检查代码'); return; }
  if (!qty || qty <= 0) { alert('仓位必须大于0'); return; }
  if (qty % 100 !== 0) { alert('仓位须为100的倍数'); return; }
  if (cost <= 0) { alert('成本价必须大于0'); return; }
  if (!joinDate) { alert('请选择加入时间'); return; }
  const current = Number(document.getElementById('editModal').dataset.current) || cost;
  const dayRate = Number(document.getElementById('editModal').dataset.dayRate) || 0;
  const item = {
    id: editingIdx >= 0 ? data.positions[editingIdx].id : uid(),
    clientName, code, name, quantity: qty, cost, current, dayRate,
    marketValue: current * qty,
    profit: (current - cost) * qty,
    profitPct: cost ? ((current - cost) / cost * 100) : 0,
    pinned: false, joinDate, categoryId
  };
  if (editingIdx >= 0) data.positions[editingIdx] = item;
  else data.positions.push(item);
  save(); closeModal(); render();
}

function renderCategoryTabs() {
  const container = document.querySelector('.category-tabs'); if (!container) return;
  container.innerHTML = ''; if (!data.categories.length) { data.categories.push({ id: 'default', name: '投顾' }); currentCategoryId = 'default'; save(); }
  if (!data.categories.some(cat => cat.id === currentCategoryId)) currentCategoryId = data.categories[0].id;
  data.categories.forEach(cat => {
    const btn = document.createElement('button'); btn.className = 'btn category-tab'; btn.draggable = true; btn.dataset.catId = cat.id;
    btn.style.cssText = cat.id === currentCategoryId ? 'background:#667eea;color:#fff;border-color:#667eea' : 'background:#fff;color:#333;border-color:#ddd';
    btn.textContent = cat.name;
    btn.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', cat.id); btn.style.opacity = '0.5'; });
    btn.addEventListener('dragend', () => btn.style.opacity = '1');
    btn.addEventListener('dragover', e => e.preventDefault());
    btn.addEventListener('drop', e => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = cat.id;
      if (draggedId === targetId) return;
      const fromIndex = data.categories.findIndex(c => c.id === draggedId);
      const toIndex = data.categories.findIndex(c => c.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;
      [data.categories[fromIndex], data.categories[toIndex]] = [data.categories[toIndex], data.categories[fromIndex]];
      save(); renderCategoryTabs();
    });
    btn.onclick = () => { currentCategoryId = cat.id; render(); };
    container.appendChild(btn);
  });
}

function renderCategoryModal() {
  const container = document.getElementById('categoryList'); if (!container) return;
  container.innerHTML = '';
  data.categories.forEach(cat => {
    const div = document.createElement('div'); div.style.cssText = 'display:flex;align-items:center;margin:8px 0';
    const input = document.createElement('input'); input.type = 'text'; input.value = cat.name; input.style.cssText = 'width:140px;padding:4px;margin-right:8px;border:1px solid #ccc;border-radius:4px';
    input.onchange = () => { const newName = input.value.trim(); if (newName) { cat.name = newName; save(); renderCategoryTabs(); } else input.value = cat.name; };
    const delBtn = document.createElement('button'); delBtn.className = 'op-btn del'; delBtn.textContent = '删除'; delBtn.onclick = () => deleteCategory(cat.id);
    div.appendChild(input); div.appendChild(delBtn); container.appendChild(div);
  });
}

function addCategory() {
  const name = document.getElementById('newCatName')?.value.trim();
  if (!name) return alert('请输入栏目名称');
  data.categories.push({ id: uid(), name }); save(); renderCategoryModal(); document.getElementById('newCatName').value = '';
}

function deleteCategory(id) {
  if (id === 'default' && data.categories.length === 1) return alert('至少保留一个栏目！');
  if (data.positions.some(p => p.categoryId === id))
    if (!confirm('该栏目下有持仓，删除会同时清除所有持仓！确定吗？')) return;
  data.categories = data.categories.filter(c => c.id !== id);
  data.positions = data.positions.filter(p => p.categoryId !== id);
  if (currentCategoryId === id) currentCategoryId = data.categories[0]?.id || 'default';
  save(); renderCategoryModal(); render();
}

function closeExportChoiceModal() { document.getElementById('exportChoiceModal').style.display = 'none'; }

function doExportAll() {
  const start = document.getElementById('exportStart')?.value;
  const end = document.getElementById('exportEnd')?.value;
  const catId = document.getElementById('exportCategory')?.value;
  let list = data.positions;
  if (catId) list = list.filter(p => p.categoryId === catId);
  if (start || end) list = list.filter(p => {
    const d = new Date(p.joinDate); d.setHours(0,0,0,0);
    const s = start ? new Date(start) : null; if (s) s.setHours(0,0,0,0);
    const e = end ? new Date(end) : null; if (e) e.setHours(23,59,59,999);
    if (s && d < s) return false; if (e && d > e) return false; return true;
  });
  const csv = objToCSV(list);
  downloadCSV(csv, `positions_${fmtDate()}.csv`);
  closeExportChoiceModal();
}

function downloadCSV(csv, filename) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}



/* ---------- 登录/注册：保存用户名 ---------- */
async function doLogin() {
  console.log('doLogin called');
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPwd').value;
  console.log('Email:', u, 'Password:', p ? '***' : 'empty');
  if (!u || !p) return alert('请输入邮箱和密码');
  if (!u.includes('@')) return alert('请输入有效的邮箱地址');
  try {
    console.log('Calling logIn function');
    await logIn(u, p);
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('userMgrBtn').style.display = 'inline-block';
    localStorage.setItem('lc_username', u);
    location.reload();
  } catch (e) {
    console.error('Login error:', e);
    document.getElementById('loginTip').textContent = e.message || '登录失败';
  }
}

async function doRegister() {
  console.log('doRegister called');
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPwd').value;
  console.log('Email:', u, 'Password:', p ? '***' : 'empty');
  if (!u || !p) return alert('请输入邮箱和密码');
  if (!u.includes('@')) return alert('请输入有效的邮箱地址');
  if (p.length < 6) return alert('密码至少6位');
  try {
    console.log('Calling signUp function');
    await signUp(u, p);
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('userMgrBtn').style.display = 'inline-block';
    localStorage.setItem('lc_username', u);
    location.reload();
  } catch (e) {
    console.error('Register error:', e);
    document.getElementById('loginTip').textContent = e.message || '注册失败';
  }
}

/* ---------- 用户管理弹层 ---------- */
function openUserMgrModal() {
  const user = currentUser();
  if (!user.id) return;
  const username = localStorage.getItem('lc_username') || user.id;
  document.getElementById('userName').textContent = '账户名：' + username;
  document.getElementById('userMgrModal').style.display = 'flex';
}

function closeUserMgrModal() {
  document.getElementById('userMgrModal').style.display = 'none';
}

document.getElementById('innerLogoutBtn').onclick = () => {
  closeUserMgrModal();
  logOut();
};

document.getElementById('userMgrBtn').onclick = openUserMgrModal;

document.getElementById('changePwdBtn').onclick = async () => {
  const currentPwd = document.getElementById('currentPwd').value.trim();
  const newPwd = document.getElementById('newPwd').value;
  const confirmPwd = document.getElementById('confirmPwd').value;
  
  if (!currentPwd) {
    document.getElementById('pwdTip').textContent = '请输入当前密码';
    return;
  }
  
  if (!newPwd) {
    document.getElementById('pwdTip').textContent = '请输入新密码';
    return;
  }
  
  if (newPwd.length < 6) {
    document.getElementById('pwdTip').textContent = '新密码至少6位';
    return;
  }
  
  if (newPwd !== confirmPwd) {
    document.getElementById('pwdTip').textContent = '两次输入的新密码不一致';
    return;
  }
  
  try {
    await changePassword(currentPwd, newPwd);
    alert('密码修改成功！请使用新密码重新登录。');
    closeUserMgrModal();
    document.getElementById('currentPwd').value = '';
    document.getElementById('newPwd').value = '';
    document.getElementById('confirmPwd').value = '';
    document.getElementById('pwdTip').textContent = '';
    logOut();
  } catch (e) {
    document.getElementById('pwdTip').textContent = e.message || '修改失败';
  }
};

/* ========== 页面入口 ========== */
window.onload = async () => {
  const user = currentUser();
  if (user.id) {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('userMgrBtn').style.display = 'inline-block';
  } else {
    document.getElementById('loginModal').style.display = 'flex';
  }

  data = await load();
  currentCategoryId = data.categories[0]?.id || 'default';

  const startInp = document.getElementById('startDate');
  const endInp = document.getElementById('endDate');
  if (startInp) startInp.onchange = e => { dateStart = e.target.value; render(); };
  if (endInp) endInp.onchange = e => { dateEnd = e.target.value; render(); };

  document.getElementById('addBtn').onclick = showAddModal;
  document.getElementById('searchInput').oninput = e => { searchKey = e.target.value.trim().toLowerCase(); render(); };

  /* 管理栏目按钮直接绑定，不再判断 role */
  const manageBtn = document.getElementById('manageCatBtn');
  if (manageBtn) {
    manageBtn.onclick = () => {
      renderCategoryModal();
      document.getElementById('categoryModal').style.display = 'block';
    };
  }

  bindSortEvent();
  render();
  startAutoRefresh();

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.textContent = '导入 /导出';
  exportBtn.onclick = () => {
    document.getElementById('exportStart').value = dateStart;
    document.getElementById('exportEnd').value = dateEnd;
    const catSel = document.getElementById('exportCategory');
    catSel.innerHTML = '<option value="">全部栏目</option>';
    data.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === currentCategoryId) opt.selected = true;
      catSel.appendChild(opt);
    });
    document.getElementById('exportChoiceModal').style.display = 'block';
  };

  const exportModal = document.querySelector('#exportChoiceModal .modal-content');
  const importArea = document.createElement('div');
  importArea.style.marginBottom = '15px';
  importArea.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <input type="file" id="importInModal" accept=".csv" style="flex:1;font-size:13px;">
      <button type="button" class="btn btn-primary" onclick="handleImportInModal()">开始导入</button>
    </div>
    <div style="font-size:12px;color:#666;margin-top:4px;">提示：导入时会按上方选择的"日期区间"+"栏目"做过滤，无筛选则全部导入。</div>`;
  exportModal.insertBefore(importArea, exportModal.querySelector('.modal-buttons'));

  window.handleImportInModal = function () {
    const file = document.getElementById('importInModal').files[0];
    if (!file) return alert('请先选择 CSV 文件');
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const rawList = csvToObj(evt.target.result);
        if (!rawList.length) return alert('未解析到任何记录');
        const startStr = document.getElementById('exportStart').value;
        const endStr   = document.getElementById('exportEnd').value;
        const catSel   = document.getElementById('exportCategory');
        const filterId = catSel.value;
        const filterName = filterId ? (data.categories.find(c => c.id === filterId)?.name ?? '') : '';
        const startDate = startStr ? new Date(startStr) : null;
        const endDate   = endStr   ? new Date(endStr)   : null;
        if (startDate) startDate.setHours(0,0,0,0);
        if (endDate)   endDate.setHours(23,59,59,999);

        /* ---- 改动1：不再提前push空栏目，只记录待建 ---- */
        const needCreate = new Set();
        const csvCatNames = [...new Set(rawList.map(r => (r.categoryName || '投顾').trim()))];
        csvCatNames.forEach(name => {
          if (!data.categories.some(c => c.name === name)) needCreate.add(name);
        });

        const name2id = Object.fromEntries(data.categories.map(c => [c.name, c.id]));
        const exists = new Set(data.positions.map(p => `${String(p.code).trim().toLowerCase()}-${String(p.clientName).trim().toLowerCase()}`));
        let added = 0;
        rawList.forEach(r => {
          const rowCatName = (r.categoryName || '投顾').trim();
          const rowDate = new Date(r.joinDate);
          if (filterId && name2id[rowCatName] !== filterId) return;
          if (startDate && rowDate < startDate) return;
          if (endDate   && rowDate > endDate)   return;
          const key = `${String(r.code).trim().toLowerCase()}-${String(r.clientName).trim().toLowerCase()}`;
          if (exists.has(key)) return;
          exists.add(key);

          /* ---- 改动2：真正要写入时才建栏目 ---- */
          if (needCreate.has(rowCatName)){
              const newId = uid();
              data.categories.push({ id: newId, name: rowCatName });
              name2id[rowCatName] = newId;
              needCreate.delete(rowCatName);
          }
          r.categoryId = name2id[rowCatName];
          delete r.categoryName;
          data.positions.push(r);
          added++;
        });
        save(); render();
        alert(`导入完成！新增 ${added} 条，跳过 ${rawList.length - added} 条重复记录。`);
        closeExportChoiceModal();
      } catch (err) {
        alert('解析失败，请检查 CSV 格式！\n' + err);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const invertBtn = document.createElement('button');
  invertBtn.textContent = '反选';
  invertBtn.className = 'btn';
  invertBtn.style.marginLeft = '8px';
  invertBtn.onclick = invertSelection;
  document.querySelector('.toolbar').appendChild(invertBtn);

  const codeInput = document.getElementById('code');
  if (codeInput) codeInput.addEventListener('blur', autoName);
};

function togglePwd(icon) {
  const input = icon.previousElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = '🙈';
  } else {
    input.type = 'password';
    icon.textContent = '👁';
  }
}



