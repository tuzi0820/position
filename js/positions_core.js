/* ========== 纯前端 + Supabase 用户系统 + 用户数据隔离│ 注册/登录/会话保持 │ 本地+云端双存储 │ 实时行情(5s) │ CSV导入/导出 │ 批量删/置顶/改栏目│ 栏目拖拽排序 │ 反选+全选 │ 置顶永远最前 │ 9字段排序 │ 关键词+日期区间筛选│ 小眼睛密码可见 │ 错误中文映射 │ 二次确认 │ 移动端适配 │ 零依赖纯原生========== */
const STORAGE_KEY = 'stockPosReal_v2';
const BACKUP_KEY = 'stockBackup_lastTime';
const BACKUP_INTERVAL = 60 * 60 * 1000;
let data = { categories: [{ id: 'default', name: '投顾' }], positions: [] };
let currentCategoryId = 'default';
let editingIdx = -1;
let timer = null;
let searchKey = '';
let sortKey = '', sortDir = '';
let dateStart = '', dateEnd = '';
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;
const WEEK_HEAD = ['日','一','二','三','四','五','六'];

/* ---------- Supabase 配置 ---------- */
const SUPABASE_URL = 'https://vvscwvybhhukqdshfbmc.supabase.co';
const SUPABASE_API_KEY = 'sb_publishable_xooiJEP9ZckCZsN79R2bog_wkifSYDS';

/* ---------- 用户系统 ---------- */
function currentUser() { 
  return { 
    id: localStorage.getItem('sb_userid'), 
    session: localStorage.getItem('sb_session') 
  }; 
}

async function signUp(username, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: username, password, email_confirm: true })
  });
  
  const text = await res.text();
  console.log('Signup response:', text);
  
  if (!res.ok) {
    const errorMsg = parseSupabaseError(text);
    throw new Error(errorMsg);
  }
  
  const u = JSON.parse(text);
  
  if (u.session && u.session.access_token) {
    localStorage.setItem('sb_session', u.session.access_token);
    localStorage.setItem('sb_userid', u.user.id);
    await backgroundSyncCloud();
    return u;
  } else if (u.user && !u.session) {
    throw new Error('注册成功！请查收邮箱并点击验证链接完成注册。');
  } else {
    throw new Error('注册失败：未知错误');
  }
}

function parseSupabaseError(errorText) {
  try {
    const error = JSON.parse(errorText);
    if (error.error_code === 'over_email_send_rate_limit') {
      return '邮件发送过于频繁，请等待15-30分钟后再试，或联系管理员。';
    }
    if (error.error_code === 'invalid_credentials') {
      return '邮箱或密码错误，请检查后重试。';
    }
    if (error.error_code === 'user_not_found') {
      return '该邮箱尚未注册，请先注册。';
    }
    if (error.error_code === 'email_not_confirmed') {
      return '邮箱尚未验证，请查收邮件并完成验证。';
    }
    if (error.code === 429) {
      return '请求过于频繁，请稍后重试。';
    }
    if (error.code === 400) {
      return '输入格式错误，请检查邮箱格式是否正确。';
    }
    if (error.msg) {
      return error.msg;
    }
    if (error.error) {
      return error.error;
    }
    return errorText;
  } catch {
    return errorText;
  }
}

async function logIn(username, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: username, password })
  });
  
  const text = await res.text();
  console.log('Login response:', text);
  
  if (!res.ok) {
    const errorMsg = parseSupabaseError(text);
    throw new Error(errorMsg);
  }
  
  const u = JSON.parse(text);
  
  if (!u.access_token || !u.user || !u.user.id) {
    throw new Error('登录成功但未返回会话信息，请检查 Supabase 认证配置');
  }
  
  localStorage.setItem('sb_session', u.access_token);
  localStorage.setItem('sb_userid', u.user.id);
  await backgroundSyncCloud();
  return u;
}

async function logOut() {
  const user = currentUser();
  if (user.id) await saveUserData(data);
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Authorization': `Bearer ${user.session}`
    }
  });
  localStorage.removeItem('sb_session');
  localStorage.removeItem('sb_userid');
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BACKUP_KEY);
  location.reload();
}

async function changePassword(currentPassword, newPassword) {
  const user = currentUser();
  if (!user.id || !user.session) {
    throw new Error('请先登录');
  }
  
  // 先验证当前密码是否正确
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: localStorage.getItem('lc_username'), password: currentPassword })
  });
  
  if (!verifyRes.ok) {
    const text = await verifyRes.text();
    const errorMsg = parseSupabaseError(text);
    throw new Error('当前密码错误：' + errorMsg);
  }
  
  // 更新密码
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Authorization': `Bearer ${user.session}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });
  
  const text = await res.text();
  console.log('Change password response:', text);
  
  if (!res.ok) {
    const errorMsg = parseSupabaseError(text);
    throw new Error(errorMsg);
  }
  
  return JSON.parse(text);
}

/* ---------- 数据读写 ---------- */
async function loadUserData() {
  const user = currentUser();
  if (!user.id) return null;
  console.log('Loading user data for:', user.id);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data?owner=eq.${user.id}&limit=1`, {
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Authorization': `Bearer ${user.session}`,
      'Content-Type': 'application/json'
    }
  });
  
  const text = await res.text();
  console.log('Load user data response:', text);
  
  if (!res.ok) {
    console.error('Failed to load user data:', text);
    return null;
  }
  
  const results = JSON.parse(text);
  if (results.length > 0) {
    return JSON.parse(results[0].data);
  }
  return null;
}

async function saveUserData(payload) {
  const user = currentUser();
  if (!user.id) return;
  
  console.log('Saving user data for:', user.id);
  
  const existing = await loadUserData();
  if (existing) {
    console.log('Updating existing data');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data?owner=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${user.session}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: JSON.stringify(payload) })
    });
    
    const text = await res.text();
    console.log('Update response:', text);
    
    if (!res.ok) throw new Error(text);
  } else {
    console.log('Creating new user data');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${user.session}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ owner: user.id, data: JSON.stringify(payload) })
    });
    
    const text = await res.text();
    console.log('Create response:', text);
    
    if (!res.ok) throw new Error(text);
  }
}

async function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) try {
    return JSON.parse(raw);
  } catch {}
  return { categories: [{ id: 'default', name: '投顾' }], positions: [] };
}

/* ✅ 云端有数据就强制覆盖本地 */
async function backgroundSyncCloud() {
  const user = currentUser();
  if (!user.id) return;
  const cloud = await loadUserData();
  if (cloud) {
    data = cloud;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render();
  } else {
    if (data.positions.length) saveUserData(data).catch(console.warn);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  checkBackup();
}

function checkBackup() {
  const now = Date.now();
  const last = parseInt(localStorage.getItem(BACKUP_KEY) || '0', 10);
  if (now - last >= BACKUP_INTERVAL) {
    hourlyCloudSave();
    localStorage.setItem(BACKUP_KEY, String(now));
  }
}

async function hourlyCloudSave() {
  const user = currentUser();
  if (!user.id) return;
  try {
    await saveUserData(data);
  } catch (e) {
    console.warn(e);
  }
}

async function uploadNow() {
  const user = currentUser();
  if (!user.id) {
    alert('请先登录');
    return;
  }
  try {
    await saveUserData(data);
    localStorage.setItem(BACKUP_KEY, Date.now());
    alert('已备份到云端');
  } catch (e) {
    alert('备份失败：' + e.message);
  }
}

/* ---------- 工具 ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fmtDate() {
  return new Date().toISOString().split('T')[0];
}

function objToCSV(list) {
  const head = 'clientName,code,name,quantity,cost,current,dayRate,marketValue,profit,profitPct,pinned,joinDate,categoryName';
  const rows = list.map(r => {
    const catName = data.categories.find(c => c.id === r.categoryId)?.name || '投顾';
    return [
      r.clientName,
      r.code,
      r.name,
      r.quantity,
      r.cost,
      r.current,
      r.dayRate,
      r.marketValue,
      r.profit,
      r.profitPct,
      r.pinned ? 1 : 0,
      r.joinDate,
      catName
    ].map(v => (v + '').includes(',') ? `"${v}"` : v).join(',');
  });
  return [head, ...rows].join('\n');
}

function csvToObj(str) {
  return str.trim().split('\n').slice(1).map(l => {
    const val = l.split(',').map(v => v.replace(/^"|"$/g, ''));
    return {
      clientName: val[0],
      code: val[1],
      name: val[2],
      quantity: Number(val[3]) || 0,
      cost: Number(val[4]) || 0,
      current: Number(val[5]) || 0,
      dayRate: Number(val[6]) || 0,
      marketValue: Number(val[7]) || 0,
      profit: Number(val[8]) || 0,
      profitPct: Number(val[9]) || 0,
      pinned: (val[10] || '0') === '1',
      joinDate: val[11] || fmtDate(),
      categoryName: val[12] || '投顾',
      id: uid()
    };
  });
}

function sortList(list) {
  if (!sortKey) {
    list.sort((a, b) => (b.pinned || 0) - (a.pinned || 0));
    return;
  }
  const asc = sortDir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (['current','dayRate','quantity','profit','profitPct','marketValue','cost'].includes(sortKey)) {
      va = parseFloat(va) || 0;
      vb = parseFloat(vb) || 0;
    }
    if (va > vb) return asc;
    if (va < vb) return -asc;
    return 0;
  });
}

function bindSortEvent() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey !== key) {
        sortKey = key;
        sortDir = 'asc';
      } else {
        sortDir = sortDir === 'asc' ? 'desc' : (sortDir === 'desc' ? '' : 'asc');
        if (!sortDir) sortKey = '';
      }
      document.querySelectorAll('th.sortable').forEach(el => el.classList.remove('asc', 'desc'));
      if (sortDir) th.classList.add(sortDir);
      render();
    });
  });
}

async function refreshPrice() {
  if (!data.positions.length) return;
  for (const it of data.positions) {
    const tcode = (it.code.startsWith('6') ? 'sh' : 'sz') + it.code;
    try {
      const buf = await (await fetch(`https://qt.gtimg.cn/q=${tcode}`, { referrer: 'https://stock.gtimg.cn/' })).arrayBuffer();
      const arr = new TextDecoder('gbk').decode(buf).split('~');
      it.current = parseFloat(arr[3]) || it.current || it.cost || 0;
      it.dayRate = ((parseFloat(arr[3]) - parseFloat(arr[4])) / parseFloat(arr[4]) * 100) || 0;
    } catch (e) {
      console.error(e);
    }
    it.marketValue = it.current * it.quantity;
    it.profit = (it.current - it.cost) * it.quantity;
    it.profitPct = it.cost ? ((it.current - it.cost) / it.cost * 100) : 0;
  }
  save();
  render();
}

function startAutoRefresh() {
  if (timer) clearInterval(timer);
  refreshPrice();
  timer = setInterval(refreshPrice, 5000);
}

