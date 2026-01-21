// admin.js - Serverga ulangan versiya

// SERVER MANZILI (Agar mahalliy bo'lsa)
const API_URL = '/api'; 
let socket;
try {
    socket = io();
} catch (e) { console.log("Socket.io topilmadi. admin.html ga ulang!"); }

// SAHIFA YUKLANGANDA
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    injectDispatcherMenuItem(); // [YANGI] Menyuga dispetcher bo'limini qo'shish
    injectManagerMenuItem(); // [YANGI] Menyuga menejer bo'limini qo'shish
    injectCalculationGroupMenuItem(); // [YANGI] Menyuga hisob-kitob guruhlari
    injectPartnerMenuItem(); // [YANGI] Menyuga hamkorlar bo'limini qo'shish
    injectSmsLogsMenuItem(); // [YANGI] SMS Tarixi menyusi
});

// LOGIN TEKSHIRISH
let currentUser = null;
function checkAuth() {
    const userStr = localStorage.getItem('admin_user');
    if(userStr) {
        currentUser = JSON.parse(userStr);
        document.getElementById('admin-login-screen').style.display = 'none';
        applyPermissions();
        
        if (currentUser.role === 'partner') {
            openPage('partner_dashboard'); // Hamkor uchun kabinet
        } else {
            openPage('orders');
        }
    } else {
        document.getElementById('admin-login-screen').style.display = 'flex';
    }
}

async function adminLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    
    if(data.success) {
        localStorage.setItem('admin_user', JSON.stringify(data.admin));
        location.reload();
    } else {
        alert(data.error);
    }
}

function adminLogout() {
    localStorage.removeItem('admin_user');
    location.reload();
}

async function applyPermissions() {
    if(!currentUser) return;
    const role = currentUser.role;
    
    // Agar Owner bo'lsa hammasi ochiq
    if(role === 'owner') return;

    // Rollarni serverdan olamiz
    const res = await fetch(`${API_URL}/admin/roles`);
    const roles = await res.json();
    const myRole = roles.find(r => r.slug === role);
    
    // Agar rol topilmasa yoki ruxsatlar bo'lmasa, hammasini yopamiz (xavfsizlik)
    const allowed = myRole ? myRole.permissions : [];

    document.querySelectorAll('.menu-item').forEach(el => {
        const onClick = el.getAttribute('onclick');
        if(onClick && onClick.includes('openPage')) {
            const page = onClick.match(/'([^']+)'/)[1];
            // Ruxsatlar ro'yxatida bo'lmasa yashiramiz
            if(!allowed.includes(page) && page !== 'changePassword') {
                el.style.display = 'none';
            }
        }
    });

    // [YANGI] Hamkor uchun menyuga "Kabinet" qo'shish
    if (role === 'partner') {
        const menu = document.querySelector('.menu');
        const btn = document.createElement('div');
        btn.className = 'menu-item';
        btn.innerHTML = '<i class="fas fa-home"></i> Kabinet';
        btn.onclick = () => openPage('partner_dashboard');
        menu.insertBefore(btn, menu.firstChild); // Eng tepaga qo'shish
    }
}

// [YANGI] Menyuni ochib-yopish (Accordion)
function toggleSubmenu(id) {
    const submenu = document.getElementById(id);
    const parent = submenu.previousElementSibling;

    // Boshqa ochiq menyularni yopish (ixtiyoriy, joy tejash uchun)
    document.querySelectorAll('.submenu').forEach(el => {
        if (el.id !== id) { el.classList.remove('open'); if(el.previousElementSibling) el.previousElementSibling.classList.remove('open'); }
    });

    submenu.classList.toggle('open');
    parent.classList.toggle('open');
}

// SAHIFA ALMASHTIRISH (YAGONA FUNKSIYA)
function openPage(pageId) {
    // 1. Hamma bo'limlarni yashiramiz
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    
    if (pageId === 'marketing') loadMarketing();

    // 2. Tanlangan bo'limni ochamiz
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
    
    // 3. Menyudagi tugmani "aktiv" qilamiz
    // (Qidiruv logikasini sal soddalashtiramiz, xatolik chiqmasligi uchun)
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        if(item.getAttribute('onclick') && item.getAttribute('onclick').includes(`openPage('${pageId}')`)) {
            item.classList.add('active');
            
            // Agar bu item submenu ichida bo'lsa, o'sha submenuni ochamiz
            const parentSub = item.closest('.submenu');
            if(parentSub) {
                parentSub.classList.add('open');
                if(parentSub.previousElementSibling) parentSub.previousElementSibling.classList.add('open');
            }
        }
    });

    // 4. Kerakli ma'lumotlarni yuklaymiz
    if (pageId === 'orders') loadOrders();
    if (pageId === 'drivers') loadDrivers();
    if (pageId === 'addresses') loadAddresses();
    if (pageId === 'clients') loadClients();
    if (pageId === 'regions') loadRegions();      // Yangi qo'shilgan
    if (pageId === 'services') loadServices();    // Yangi qo'shilgan
    if (pageId === 'settings') loadTariffs();
    if (pageId === 'tags') loadTags();
    if (pageId === 'reports') loadReports();
    if (pageId === 'staff') loadStaff();
    if (pageId === 'roles') loadRoles(); // [YANGI]
    if (pageId === 'finance') loadFinance(); // [YANGI]
    if (pageId === 'logs') loadLogs(); // [YANGI]
    if (pageId === 'sms_logs') loadSmsLogs(); // [YANGI]
    if (pageId === 'backups') loadBackups(); // [YANGI]
    if (pageId === 'promocodes') loadPromocodes(); // [YANGI]
    if (pageId === 'partner_dashboard') loadPartnerDashboard(); // [YANGI]
    
    // [YANGI BO'LIMLAR]
    if (pageId === 'shifts') loadShifts();
    if (pageId === 'calls') loadCalls();
    if (pageId === 'support') loadSupport();
    if (pageId === 'drivers_archive') loadDriversArchive();
    if (pageId === 'dispatchers') loadStaffByRole('dispatcher');
    if (pageId === 'managers') loadStaffByRole('manager');
    if (pageId === 'info') loadInfo();
    if (pageId === 'calculation_groups') loadCalculationGroups(); // [YANGI]
    if (pageId === 'partners') loadPartners(); // [YANGI]

    // [YANGI] Platforma bo'limlari (Placeholder)
    if (['sys_users', 'sys_apps', 'sys_teams', 'sys_ai', 'sys_api', 'sys_limits', 'sys_billing', 'sys_invoices', 'sys_activity'].includes(pageId)) {
        ensurePageSection(pageId, pageId.replace('sys_', '').toUpperCase(), ['Nomi', 'Status', 'Sana', 'Amal']);
        const tbody = document.getElementById(pageId + '-table');
        if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888; padding:20px;">Tez orada ishga tushadi...</td></tr>';
    }
}

// ==============================
// 1. BUYURTMALAR (ORDERS)
// ==============================

let loadedOrders = [];
async function loadOrders() {
    try {
        const res = await fetch(`${API_URL}/orders`);
        const orders = await res.json();
        loadedOrders = orders;
        
        const tbody = document.getElementById('orders-table');
        tbody.innerHTML = '';
        
        orders.forEach(order => {
            let badge = order.status === 'yangi' ? 'bg-new' : '';
            tbody.innerHTML += `
                <tr>
                    <td>${order.vaqt || '-'}</td>
                    <td><b>${order.telefon || '-'}</b><br><small>${order.ism || 'Ism yo\'q'}</small></td>
                    <td>${order.qayerdan || '-'} ➝ ${order.qayerga || '-'}</td>
                    <td>${order.izoh || ''}</td>
                    <td><span class="badge ${badge}">${order.status}</span></td>
                    <td>
                        <button class="btn btn-primary" onclick="viewOrder(${order.id})">👁</button>
                    </td>
                </tr>`;
        });
    } catch (err) {
        console.error("Xatolik:", err);
    }
}

function viewOrder(id) {
    const order = loadedOrders.find(o => o.id === id);
    if(!order) return;

    document.getElementById('view-o-name').innerText = order.ism || 'Mijoz';
    document.getElementById('view-o-phone').innerText = order.telefon || '-';
    document.getElementById('view-o-from').innerText = order.qayerdan || '-';
    document.getElementById('view-o-to').innerText = order.qayerga || '-';
    document.getElementById('view-o-comment').innerText = order.izoh || 'Izoh yo\'q';
    document.getElementById('view-o-time').innerText = order.vaqt || '-';
    document.getElementById('view-o-status').innerText = order.status || '-';
    
    // Oraliq manzillarni chiqarish
    const stopsContainer = document.getElementById('view-o-stops');
    stopsContainer.innerHTML = '';
    if(order.stops && order.stops.length > 0) {
        order.stops.forEach((stop, index) => {
            stopsContainer.innerHTML += `<div style="margin-top:5px; padding-left: 15px; border-left: 2px solid #ccc; color:#555; font-size: 13px;">${index + 1}. ${stop.address}</div>`;
        });
    }

    document.getElementById('viewOrderModal').style.display = 'flex';
}

function closeViewOrderModal() {
    document.getElementById('viewOrderModal').style.display = 'none';
}

async function createOrder() {
    const data = {
        phone: document.getElementById('m-phone').value,
        name: document.getElementById('m-name').value,
        from: document.getElementById('m-from').value,
        to: document.getElementById('m-to').value,
        comment: document.getElementById('m-comment').value
    };

    if(!data.phone || !data.from) {
        alert("Telefon va Manzil majburiy!");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            alert("Buyurtma yaratildi!");
            closeModal();
            loadOrders(); // Jadvalni yangilash
        }
    } catch (err) {
        alert("Serverda xatolik!");
    }
}

// MODAL OCHISH/YOPISH
function openModal() { document.getElementById('newOrderModal').style.display = 'flex'; }
function closeModal() { document.getElementById('newOrderModal').style.display = 'none'; }


// ==============================
// 2. HAYDOVCHILAR (DRIVERS)
// ==============================

async function loadDrivers() {
    let res = await fetch(`${API_URL}/drivers`);
    let drivers = await res.json();
    
    const tbody = document.getElementById('drivers-table');
    tbody.innerHTML = '';

    // Agar Hamkor bo'lsa, faqat o'zining haydovchilarini ko'radi
    if (currentUser.role === 'partner') {
        drivers = drivers.filter(d => d.partner_id === currentUser.id);
    }
    
    drivers.forEach(d => {
        tbody.innerHTML += `
            <tr>
                <td>${d.lastname} ${d.firstname}</td>
                <td>${d.telefon}</td>
                <td>${d.marka} (${d.raqam})</td>
                <td>${d.status}</td>
                <td><button class="btn btn-primary">✏️</button></td>
            </tr>`;
    });
}

async function openNewDriverModal() {
    document.getElementById('newDriverModal').style.display = 'flex';
    
    document.getElementById('d-edit-id').value = '';
    document.getElementById('d-firstname').value = '';
    document.getElementById('d-lastname').value = '';
    document.getElementById('d-phone').value = '+998';
    document.getElementById('d-brand').value = 'Chevrolet Cobalt';
    document.getElementById('d-model').value = '';
    document.getElementById('d-plate').value = '';
    document.getElementById('d-color').value = 'Oq';

    // Hamkorlar ro'yxatini yuklash (Admin uchun)
    const pRes = await fetch(`${API_URL}/admin/staff`);
    const staff = await pRes.json();
    const partners = staff.filter(s => s.role === 'partner');
    
    const sel = document.getElementById('d-partner');
    sel.innerHTML = '<option value="">Kompaniya (O\'zi)</option>' + 
        partners.map(p => `<option value="${p._id}">${p.full_name} (${p.commission_percent}%)</option>`).join('');
    
    // [YANGI] Hisob-kitob guruhlarini yuklash
    const cRes = await fetch(`${API_URL}/calculation-groups`);
    const groups = await cRes.json();
    const cSel = document.getElementById('d-calc-group');
    if(cSel) {
        cSel.innerHTML = '<option value="">Tanlang...</option>' + 
            groups.map(g => `<option value="${g._id}">${g.name}</option>`).join('');
    }

    switchTab(0);
}
function closeDriverModal() { document.getElementById('newDriverModal').style.display = 'none'; }

function switchTab(index) {
    // [TUZATISH] Faqat haydovchi modali ichidagi tablarni o'zgartirish
    document.querySelectorAll('#newDriverModal .tab-btn').forEach((btn, i) => btn.classList.toggle('active', i === index));
    document.querySelectorAll('#newDriverModal .tab-content').forEach((div, i) => div.classList.toggle('active', i === index));
}

function switchTariffTab(index) {
    document.querySelectorAll('#tariffModal .tab-btn').forEach((btn, i) => btn.classList.toggle('active', i === index));
    document.querySelectorAll('#tariffModal .tab-content').forEach((div, i) => div.classList.toggle('active', i === index));
}

async function saveDriver() {
    const id = document.getElementById('d-edit-id').value;
    const data = {
        _id: id || null,
        firstname: document.getElementById('d-firstname').value,
        lastname: document.getElementById('d-lastname').value,
        telefon: document.getElementById('d-phone').value,
        marka: document.getElementById('d-brand').value,
        model: document.getElementById('d-model').value,
        raqam: document.getElementById('d-plate').value,
        rang: document.getElementById('d-color').value,
        status: "active",
        partner_id: currentUser.role === 'partner' ? currentUser.id : (document.getElementById('d-partner').value || null),
        calculation_group_id: document.getElementById('d-calc-group').value || null // [YANGI]
    };

    await fetch(`${API_URL}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    alert("Haydovchi saqlandi!");
    closeDriverModal();
    loadDrivers();
}

// [YANGI] Haydovchini tahrirlash
async function editDriver(id) {
    const d = loadedDrivers.find(x => x._id === id);
    if(!d) return;
    
    await openNewDriverModal();
    
    document.getElementById('d-edit-id').value = d._id;
    document.getElementById('d-firstname').value = d.firstname || '';
    document.getElementById('d-lastname').value = d.lastname || '';
    document.getElementById('d-phone').value = d.telefon || '';
    document.getElementById('d-brand').value = d.marka || 'Chevrolet Cobalt';
    document.getElementById('d-model').value = d.model || '';
    document.getElementById('d-plate').value = d.raqam || '';
    document.getElementById('d-color').value = d.rang || 'Oq';
    document.getElementById('d-partner').value = d.partner_id || '';
    if(document.getElementById('d-calc-group')) document.getElementById('d-calc-group').value = d.calculation_group_id || '';
}


// ==============================
// 3. MANZILLAR (ADDRESSES)
// ==============================

let map;
async function loadAddresses() {
    const res = await fetch(`${API_URL}/addresses`);
    const addresses = await res.json();

    const tbody = document.getElementById('addresses-table');
    tbody.innerHTML = '';
    addresses.forEach(a => {
        tbody.innerHTML += `
            <tr>
                <td><b>${a.nomi}</b></td>
                <td>${a.manzil}</td>
                <td>${a.lat}, ${a.lng}</td>
                <td><button class="btn btn-danger" onclick="deleteAddress(${a.id})">O'chirish</button></td>
            </tr>`;
    });
}

function openNewAddressModal() {
    document.getElementById('newAddressModal').style.display = 'flex';
    setTimeout(() => { if(!map) initMap(); else map.invalidateSize(); }, 200);
}
function closeAddressModal() { document.getElementById('newAddressModal').style.display = 'none'; }

function initMap() {
    map = L.map('map').setView([38.8410, 65.7900], 13); // Qarshi koordinatalari
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    map.on('click', e => {
        L.marker(e.latlng).addTo(map);
        document.getElementById('addr-lat').value = e.latlng.lat;
        document.getElementById('addr-lng').value = e.latlng.lng;
        document.getElementById('addr-full').value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    });
}

async function saveAddress() {
    const data = {
        nomi: document.getElementById('addr-name').value,
        manzil: document.getElementById('addr-full').value,
        lat: document.getElementById('addr-lat').value,
        lng: document.getElementById('addr-lng').value
    };

    await fetch(`${API_URL}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    alert("Manzil saqlandi!");
    closeAddressModal();
    loadAddresses();
}

async function deleteAddress(id) {
    if(confirm("Rostdan o'chirmoqchimisiz?")) {
        await fetch(`${API_URL}/addresses/${id}`, { method: 'DELETE' });
        loadAddresses();
    }
}
// ==============================
// 4. MIJOZLARNI YUKLASH
// ==============================

async function loadClients() {
    try {
        // Serverdan mijozlarni so'raymiz
        const res = await fetch(`${API_URL}/admin/users`);
        const users = await res.json();
        
        const tbody = document.getElementById('clients-table');
        tbody.innerHTML = ''; // Jadvalni tozalash
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Hozircha mijozlar yo\'q</td></tr>';
            return;
        }

        // Har bir mijozni jadvalga chizamiz
        users.forEach(u => {
            tbody.innerHTML += `
                <tr>
                    <td>#${String(u.id).slice(-4)}</td>
                    <td><b style="color: #2563eb; font-size: 16px;">${u.phone}</b></td>
                    <td>${u.date}</td>
                </tr>`;
        });
    } catch (err) {
        console.error("Mijozlarni yuklashda xato:", err);
    }
}

// ==============================
// 5. TARIFLARNI BOSHQARISH
// ==============================

async function loadTariffs() {
    try {
        const res = await fetch(`${API_URL}/tariffs`);
        const tariffs = await res.json();
        
        const tbody = document.getElementById('tariffs-table');
        tbody.innerHTML = '';

        tariffs.forEach(t => {
            tbody.innerHTML += `
                <tr>
                    <td><b>${t.nomi}</b><br><small>${t.shahar}</small></td>
                    <td>${t.min_narx} so'm</td>
                    <td>${t.km_narxi} so'm</td>
                    <td>${t.tekin_km} km</td>
                    <td>${t.kutish_narxi} so'm</td>
                    <td><button class="btn btn-danger" onclick="deleteTariff(${t.id})">🗑</button></td>
                </tr>`;
        });
    } catch (err) { console.error(err); }
}

async function saveTariff() {
    const data = {
        nomi: document.getElementById('t-nomi').value,
        shahar: document.getElementById('t-shahar').value,
        min_narx: Number(document.getElementById('t-min-narx').value),
        km_narxi: Number(document.getElementById('t-km-narxi').value),
        tekin_km: Number(document.getElementById('t-tekin-km').value),
        posadka: Number(document.getElementById('t-posadka').value),
        kutish_narxi: Number(document.getElementById('t-kutish-narxi').value),
        tekin_kutish: Number(document.getElementById('t-tekin-kutish').value)
    };

    await fetch(`${API_URL}/tariffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    alert("Tarif saqlandi!");
    closeTariffModal();
    loadTariffs();
}

async function deleteTariff(id) {
    if(confirm("O'chirilsinmi?")) {
        await fetch(`${API_URL}/tariffs/${id}`, { method: 'DELETE' });
        loadTariffs();
    }
}

function openTariffModal() { document.getElementById('tariffModal').style.display = 'flex'; }
function closeTariffModal() { document.getElementById('tariffModal').style.display = 'none'; }

// ==============================
// 6. HUDUDLAR (REGIONS)
// ==============================
let regionMap, regionMarker;

async function loadRegions() {
    const res = await fetch(`${API_URL}/regions`);
    const data = await res.json();
    const tbody = document.getElementById('regions-table');
    tbody.innerHTML = '';
    data.forEach(r => {
        tbody.innerHTML += `<tr><td><b>${r.nomi}</b></td><td>${r.lat}, ${r.lng}</td><td>${r.radius} km</td><td><button class="btn btn-danger" onclick="deleteItem('regions', ${r.id})">🗑</button></td></tr>`;
    });
}

function openRegionModal() {
    document.getElementById('regionModal').style.display = 'flex';
    setTimeout(() => {
        if(!regionMap) {
            regionMap = L.map('region-map').setView([38.8410, 65.7900], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(regionMap);
            regionMap.on('click', e => {
                if(regionMarker) regionMap.removeLayer(regionMarker);
                regionMarker = L.marker(e.latlng).addTo(regionMap);
                document.getElementById('reg-lat').value = e.latlng.lat;
                document.getElementById('reg-lng').value = e.latlng.lng;
            });
        }
    }, 200);
}
function closeRegionModal() { document.getElementById('regionModal').style.display = 'none'; }

async function saveRegion() {
    const data = {
        nomi: document.getElementById('reg-name').value,
        radius: document.getElementById('reg-radius').value,
        lat: document.getElementById('reg-lat').value,
        lng: document.getElementById('reg-lng').value
    };
    if(!data.lat) return alert("Xaritadan joy belgilang!");
    
    await fetch(`${API_URL}/regions`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    closeRegionModal(); loadRegions();
}

// ==============================
// 7. XIZMATLAR (SERVICES)
// ==============================
async function loadServices() {
    const [sRes, tRes] = await Promise.all([
        fetch(`${API_URL}/services`),
        fetch(`${API_URL}/tags`)
    ]);
    const services = await sRes.json();
    const tags = await tRes.json();

    const tbody = document.getElementById('services-table');
    tbody.innerHTML = '';
    services.forEach(s => {
        const tagName = tags.find(t => t.id === s.tag_id)?.nomi || '-';
        tbody.innerHTML += `<tr><td>${s.nomi}</td><td><span class="badge">${tagName}</span></td><td>${s.icon}</td><td><button class="btn btn-danger" onclick="deleteItem('services', ${s.id})">🗑</button></td></tr>`;
    });
}
async function openServiceModal() { 
    document.getElementById('serviceModal').style.display = 'flex'; 
    const res = await fetch(`${API_URL}/tags`);
    const tags = await res.json();
    const sel = document.getElementById('srv-tag');
    sel.innerHTML = '<option value="">Tanlang...</option>' + tags.map(t => `<option value="${t.id}">${t.nomi}</option>`).join('');
}
function closeServiceModal() { document.getElementById('serviceModal').style.display = 'none'; }

async function saveService() {
    const data = {
        nomi: document.getElementById('srv-name').value,
        tag_id: Number(document.getElementById('srv-tag').value),
        icon: document.getElementById('srv-icon').value
    };
    await fetch(`${API_URL}/services`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    closeServiceModal(); loadServices();
}

// ==============================
// 8. TARIFLAR (YANGILANGAN)
// ==============================
let loadedTariffs = [];
async function loadTariffs() {
    // 1. Hudud va Xizmatlarni yuklab olamiz (ID larni Nomiga aylantirish uchun)
    const [tRes, rRes, sRes] = await Promise.all([
        fetch(`${API_URL}/tariffs`),
        fetch(`${API_URL}/regions`),
        fetch(`${API_URL}/services`)
    ]);
    const tariffs = await tRes.json();
    loadedTariffs = tariffs;
    const regions = await rRes.json();
    const services = await sRes.json();

    const tbody = document.getElementById('tariffs-table');
    tbody.innerHTML = '';

    tariffs.forEach(t => {
        // ID orqali nomini topamiz
        const regName = regions.find(r => r.id === t.region_id)?.nomi || "Noma'lum";
        const srvName = services.find(s => s.id === t.service_id)?.nomi || "Noma'lum";

        tbody.innerHTML += `
            <tr>
                <td><b>${t.nomi || srvName}</b><br><small>${regName}</small></td>
                <td>${t.min_narx}</td>
                <td>${t.km_narxi}</td>
                <td>${t.tekin_km}</td>
                <td>${t.kutish_narxi}</td>
                <td>
                    <button class="btn btn-primary" onclick="editTariff(${t.id})">✏️</button>
                    <button class="btn btn-danger" onclick="deleteItem('tariffs', ${t.id})">🗑</button>
                </td>
            </tr>`;
    });
}

// Tarif modal ochilganda Selectlarni to'ldirish
async function openTariffModal() {
    document.getElementById('tariffModal').style.display = 'flex';
    document.getElementById('t-edit-id').value = ''; // ID ni tozalash (yangi tarif uchun)
    // Formani tozalash logikasi kerak bo'lsa shu yerga qo'shiladi (inputlarni bo'shatish)
    
    const rRes = await fetch(`${API_URL}/regions`);
    const regions = await rRes.json();
    const regSelect = document.getElementById('t-region-select');
    regSelect.innerHTML = regions.map(r => `<option value="${r.id}">${r.nomi}</option>`).join('');

    const sRes = await fetch(`${API_URL}/services`);
    const services = await sRes.json();
    const srvSelect = document.getElementById('t-service-select');
    srvSelect.innerHTML = services.map(s => `<option value="${s.id}">${s.nomi}</option>`).join('');
}

async function editTariff(id) {
    const tariff = loadedTariffs.find(t => t.id === id);
    if(!tariff) return;

    await openTariffModal(); // Selectlarni yuklash uchun

    document.getElementById('t-edit-id').value = tariff.id;
    document.getElementById('t-region-select').value = tariff.region_id;
    document.getElementById('t-service-select').value = tariff.service_id;
    document.getElementById('t-nomi').value = tariff.nomi;
    document.getElementById('t-min-narx').value = tariff.min_narx;
    document.getElementById('t-km-narxi').value = tariff.km_narxi;
    document.getElementById('t-tekin-km').value = tariff.tekin_km;
    document.getElementById('t-first-km-narxi').value = tariff.first_km_narxi;
    document.getElementById('t-vaqt-narxi').value = tariff.vaqt_narxi;
    document.getElementById('t-tekin-vaqt').value = tariff.tekin_vaqt;
    document.getElementById('t-vaqt-birligi').value = tariff.vaqt_birligi;
    document.getElementById('t-posadka').value = tariff.posadka;
    document.getElementById('t-kutish-narxi').value = tariff.kutish_narxi;
    document.getElementById('t-tekin-kutish').value = tariff.tekin_kutish;
    document.getElementById('t-stop-narxi').value = tariff.stop_narxi;
    document.getElementById('t-tekin-stop').value = tariff.tekin_stop;
    document.getElementById('t-point-narxi').value = tariff.point_narxi;
    document.getElementById('t-stop-speed').value = tariff.stop_speed;
    document.getElementById('t-traffic-wait').value = tariff.traffic_wait;
    document.getElementById('t-round-to').value = tariff.round_to;
    document.getElementById('t-round-method').value = tariff.round_method;
    document.getElementById('t-hidden').checked = tariff.is_hidden;
    document.getElementById('t-auto-stop').checked = tariff.auto_stop;
    document.getElementById('t-round-live').checked = tariff.round_live;
    document.getElementById('t-show-min').checked = tariff.show_min;
    document.getElementById('t-group').value = tariff.group_id || '';
}

async function saveTariff() {
    const id = document.getElementById('t-edit-id').value;
    const data = {
        region_id: Number(document.getElementById('t-region-select').value),
        service_id: Number(document.getElementById('t-service-select').value),
        nomi: document.getElementById('t-nomi').value,
        min_narx: Number(document.getElementById('t-min-narx').value),
        km_narxi: Number(document.getElementById('t-km-narxi').value),
        tekin_km: Number(document.getElementById('t-tekin-km').value),
        first_km_narxi: Number(document.getElementById('t-first-km-narxi').value),
        vaqt_narxi: Number(document.getElementById('t-vaqt-narxi').value),
        tekin_vaqt: Number(document.getElementById('t-tekin-vaqt').value),
        vaqt_birligi: Number(document.getElementById('t-vaqt-birligi').value),
        posadka: Number(document.getElementById('t-posadka').value),
        kutish_narxi: Number(document.getElementById('t-kutish-narxi').value),
        tekin_kutish: Number(document.getElementById('t-tekin-kutish').value),
        stop_narxi: Number(document.getElementById('t-stop-narxi').value),
        tekin_stop: Number(document.getElementById('t-tekin-stop').value),
        point_narxi: Number(document.getElementById('t-point-narxi').value),
        stop_speed: Number(document.getElementById('t-stop-speed').value),
        traffic_wait: Number(document.getElementById('t-traffic-wait').value),
        round_to: Number(document.getElementById('t-round-to').value),
        round_method: document.getElementById('t-round-method').value,
        is_hidden: document.getElementById('t-hidden').checked,
        auto_stop: document.getElementById('t-auto-stop').checked,
        round_live: document.getElementById('t-round-live').checked,
        show_min: document.getElementById('t-show-min').checked,
        group_id: document.getElementById('t-group').value
    };

    if (id) {
        await fetch(`${API_URL}/tariffs/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    } else {
        await fetch(`${API_URL}/tariffs`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    }
    closeTariffModal(); loadTariffs();
}

async function deleteItem(type, id) {
    if(confirm("O'chirilsinmi?")) {
        await fetch(`${API_URL}/${type}/${id}`, { method: 'DELETE' });
        if(type === 'regions') loadRegions();
        if(type === 'services') loadServices();
        if(type === 'tariffs') loadTariffs();
    }
}

// ==============================
// TAGS (TEGLAR)
// ==============================
async function loadTags() {
    const res = await fetch(`${API_URL}/tags`);
    const data = await res.json();
    const tbody = document.getElementById('tags-table');
    tbody.innerHTML = '';
    data.forEach(t => {
        tbody.innerHTML += `<tr><td>${t.nomi}</td><td><button class="btn btn-danger" onclick="deleteItem('tags', ${t.id})">🗑</button></td></tr>`;
    });
}
function openTagModal() { document.getElementById('tagModal').style.display = 'flex'; }
function closeTagModal() { document.getElementById('tagModal').style.display = 'none'; }
async function saveTag() {
    const data = { nomi: document.getElementById('tag-name').value };
    await fetch(`${API_URL}/tags`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    closeTagModal(); loadTags();
}

// ==============================
// 9. MARKETING (SURGE & HEATMAP) - TUZATILGAN
// ==============================
let marketingMap; // Global o'zgaruvchi
let isHeatMode = false;

async function loadMarketing() {
    // 1. Xaritani BOSHIDA yuklaymiz (API kutib o'tirmasdan)
    if (!marketingMap) {
        marketingMap = L.map('marketing-map').setView([38.8410, 65.7900], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(marketingMap);
        
        // Xaritaga bosganda zona qo'shish
        marketingMap.on('click', async (e) => {
            if (isHeatMode) {
                if (confirm("Bu yerga 'Issiq Zona' qo'shilsinmi?")) {
                    try {
                        await fetch(`${API_URL}/settings/heatzone`, {
                            method: 'POST',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng, radius: 500 })
                        });
                        isHeatMode = false;
                        document.getElementById('marketing-map').style.cursor = 'grab';
                        loadMarketing(); // Yangilash
                    } catch (err) { alert("Saqlashda xatolik!"); }
                }
            }
        });
    }

    // ⚠️ MUHIM: Xarita to'g'ri chizilishi uchun ozgina kutib "refresh" beramiz
    setTimeout(() => {
        marketingMap.invalidateSize();
    }, 300);

    // 2. Keyin ma'lumotlarni serverdan yuklaymiz
    try {
        const res = await fetch(`${API_URL}/settings`);
        if (!res.ok) return console.log("Server hali tayyor emas yoki API yo'q");
        
        const data = await res.json();

        // Surge holati
        if(document.getElementById('auto-surge-enable')) {
            document.getElementById('auto-surge-enable').checked = data.auto_surge;
            document.getElementById('surge-threshold').value = data.surge_threshold || 5;
            document.getElementById('surge-target').value = data.surge_target || 1.5;
            
            document.getElementById('auto-heatmap-enable').checked = data.auto_heatmap; // [YANGI]
            updateSurgeStatusDisplay(data.surge_active, data.surge_multiplier);
        }

        // Zonalar jadvali
        renderZonesTable(data.heat_zones);

        // Xaritadagi eski doiralarni tozalash
        marketingMap.eachLayer(layer => {
            if (layer instanceof L.Circle) marketingMap.removeLayer(layer);
        });

        // Yangi zonalarni chizish
        drawAdminHeatmap(data.heat_zones);
    } catch (err) {
        console.error("Marketing ma'lumotlarini yuklashda xatolik:", err);
    }
}

function drawAdminHeatmap(zones) {
    if (!marketingMap) return;
    // Eskilarni o'chirish
    marketingMap.eachLayer(layer => { if (layer instanceof L.Circle) marketingMap.removeLayer(layer); });
    
    if (zones) {
        zones.forEach(z => {
            L.circle([z.lat, z.lng], {
                color: 'red', fillColor: '#f03', fillOpacity: 0.5, radius: z.radius || 500
            }).addTo(marketingMap);
        });
    }
}

// Surge Update
async function saveAutoSurgeSettings() {
    const auto = document.getElementById('auto-surge-enable').checked;
    const thresh = Number(document.getElementById('surge-threshold').value);
    const target = Number(document.getElementById('surge-target').value);
    const autoHeat = document.getElementById('auto-heatmap-enable').checked; // [YANGI]

    await fetch(`${API_URL}/settings/surge`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ auto_surge: auto, threshold: thresh, target: target, auto_heatmap: autoHeat })
    });
}

function updateSurgeStatusDisplay(active, mult) {
    const el = document.getElementById('current-surge-status');
    if(el) {
        if(active) {
            el.innerHTML = `<span style="color:red">🔥 AKTIV (x${mult})</span>`;
        } else {
            el.innerHTML = `<span style="color:green">🟢 Normal (x1.0)</span>`;
        }
    }
}

// Heatmap Mode
function enableHeatmapMode() {
    isHeatMode = true;
    alert("Xaritadan kerakli joyni bosing!");
    document.getElementById('marketing-map').style.cursor = 'crosshair';
}

function renderZonesTable(zones) {
    const tbody = document.getElementById('zones-table');
    tbody.innerHTML = '';
    if(!zones) return;
    
    zones.forEach(z => {
        tbody.innerHTML += `
            <tr>
                <td>${z.id}</td>
                <td>${z.lat.toFixed(4)}, ${z.lng.toFixed(4)}</td>
                <td><button class="btn btn-danger" onclick="deleteZone(${z.id})">🗑 O'chirish</button></td>
            </tr>
        `;
    });
}

async function deleteZone(id) {
    if(confirm("O'chirilsinmi?")) {
        await fetch(`${API_URL}/settings/heatzone/${id}`, { method: 'DELETE' });
        loadMarketing();
    }
}

let loadedDrivers = []; // [YANGI] Qidiruv uchun global o'zgaruvchi
async function loadDrivers() {
    // Xarita tugmasini qo'shish (agar yo'q bo'lsa)
    if (!document.getElementById('btn-live-map')) {
        const header = document.querySelector('#drivers .header');
        if (header) {
            const btn = document.createElement('button');
            btn.id = 'btn-live-map';
            btn.className = 'btn btn-primary';
            btn.style.marginLeft = '15px';
            btn.innerHTML = '🌍 Jonli Xarita';
            btn.onclick = openLiveMap;
            header.appendChild(btn);

            // [YANGI] Xabar yuborish tugmasi
            const btnMsg = document.createElement('button');
            btnMsg.className = 'btn';
            btnMsg.style.marginLeft = '10px';
            btnMsg.style.backgroundColor = '#f59e0b';
            btnMsg.style.color = 'white';
            btnMsg.innerHTML = '📢 Xabar';
            btnMsg.onclick = openBroadcastModal;
            header.appendChild(btnMsg);

            // [YANGI] Qidiruv inputi
            const searchInput = document.createElement('input');
            searchInput.id = 'driver-search-input';
            searchInput.type = 'text';
            searchInput.placeholder = '🔍 Qidiruv...';
            searchInput.style.padding = '8px 12px';
            searchInput.style.marginLeft = '15px';
            searchInput.style.borderRadius = '6px';
            searchInput.style.border = '1px solid #ddd';
            searchInput.style.outline = 'none';
            searchInput.onkeyup = searchDrivers;
            header.appendChild(searchInput);
        }
    }

    const res = await fetch(`${API_URL}/drivers`);
    loadedDrivers = await res.json();
    
    // Agar Hamkor bo'lsa, faqat o'zining haydovchilarini ko'radi
    if (currentUser && currentUser.role === 'partner') {
        loadedDrivers = loadedDrivers.filter(d => d.partner_id === currentUser.id);
    }

    renderDrivers(loadedDrivers);
}

function renderDrivers(list) {
    const tbody = document.getElementById('drivers-table');
    tbody.innerHTML = '';
    
    if(list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Haydovchilar topilmadi</td></tr>';
        return;
    }

    list.forEach(d => {
        // Status rangi
        let stColor = d.status === 'online' ? '#22c55e' : (d.status === 'busy' ? '#f59e0b' : (d.status === 'blocked' ? '#ef4444' : '#64748b'));
        let stText = d.status === 'online' ? '🟢 Online' : (d.status === 'busy' ? '🟡 Band' : (d.status === 'blocked' ? '🚫 Bloklangan' : '⚫ Offline'));

        const blockBtn = d.status === 'blocked' 
            ? `<button class="btn btn-success" onclick="changeDriverStatus('${d._id}', 'offline')" title="Blokdan chiqarish" style="margin-left:5px">🔓</button>`
            : `<button class="btn btn-danger" onclick="changeDriverStatus('${d._id}', 'blocked')" title="Bloklash" style="margin-left:5px">🚫</button>`;

        tbody.innerHTML += `
            <tr>
                <td><b>${d.lastname || ''} ${d.firstname || ''}</b></td>
                <td>${d.telefon}</td>
                <td>${d.marka} <span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px">${d.raqam}</span></td>
                <td><span style="color:${stColor}; font-weight:600">${stText}</span></td>
                <td><b>${(d.balans || 0).toLocaleString()} so'm</b></td> <td>
                    <button class="btn btn-outline" onclick="openBalanceModal('${d._id}', '${d.firstname}', 'driver')" title="Balans">💰</button>
                    <button class="btn btn-primary" onclick="editDriver('${d._id}')">✏️</button>
                    <button class="btn btn-info" onclick="openHistoryModal('${d.telefon}', '${d.firstname}')" title="Tarix" style="background:#17a2b8; color:white; margin-left:5px;">🕒</button>
                    ${blockBtn}
                </td>
            </tr>`;
    });
}

function searchDrivers() {
    const q = document.getElementById('driver-search-input').value.toLowerCase();
    const filtered = loadedDrivers.filter(d => 
        (d.firstname && d.firstname.toLowerCase().includes(q)) ||
        (d.lastname && d.lastname.toLowerCase().includes(q)) ||
        (d.telefon && d.telefon.includes(q)) ||
        (d.marka && d.marka.toLowerCase().includes(q)) ||
        (d.raqam && d.raqam.toLowerCase().includes(q))
    );
    renderDrivers(filtered);
}

async function changeDriverStatus(id, status) {
    const action = status === 'blocked' ? "bloklansinmi" : "blokdan chiqarilsinmi";
    if(confirm(`Haydovchi ${action}?`)) {
        await fetch(`${API_URL}/admin/driver/status`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id, status })
        });
        loadDrivers();
    }
}

// 2. YANGI FUNKSIYALAR (Fayl oxiriga qo'shing):
function openBalanceModal(id, name, type) {
    document.getElementById('balanceModal').style.display = 'flex';
    document.getElementById('bal-driver-id').value = id;
    document.getElementById('bal-type').value = type; // 'driver' or 'partner'
    document.getElementById('bal-name').innerText = name;
    document.getElementById('bal-amount').value = '';
    document.getElementById('bal-comment').value = '';
    document.getElementById('bal-action').value = 'add';
}
function closeBalanceModal() { document.getElementById('balanceModal').style.display = 'none'; }

async function submitBalance() {
    const id = document.getElementById('bal-driver-id').value;
    const type = document.getElementById('bal-type').value;
    let amount = document.getElementById('bal-amount').value;
    const action = document.getElementById('bal-action').value;
    const comment = document.getElementById('bal-comment').value;
    
    if(!amount) return alert("Summani kiriting!");
    if(action === 'deduct') amount = -Math.abs(amount); // Manfiy qilish

    const url = type === 'driver' ? `${API_URL}/admin/driver/balance` : `${API_URL}/admin/partner/balance`;
    const body = type === 'driver' ? { driverId: id, amount, comment } : { partnerId: id, amount };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        
        if(res.ok) {
            alert("Balans yangilandi!");
            closeBalanceModal();
            if(type === 'driver') loadDrivers();
            else loadPartners();
        } else {
            alert("Xatolik yuz berdi");
        }
    } catch(e) { console.error(e); }
}

// ==============================
// 20. HAYDOVCHI TARIXI (HISTORY) - [YANGI]
// ==============================
let historyMap = null;
let historyPolyline = null;

function openHistoryModal(phone, name) {
    if (!document.getElementById('historyModal')) {
        const html = `
        <div id="historyModal" class="modal">
            <div class="modal-content" style="width: 90%; height: 90%; display:flex; flex-direction:column;">
                <div class="modal-header">
                    <h3>🕒 Harakat Tarixi: <span id="hist-name"></span></h3>
                    <span class="close-btn" onclick="document.getElementById('historyModal').style.display='none'">&times;</span>
                </div>
                <div style="padding: 15px; background: #f9f9f9; display: flex; gap: 10px; align-items: center;">
                    <input type="date" id="hist-date" class="form-input" style="width: auto;">
                    <button class="btn btn-primary" onclick="loadDriverHistory()">Ko'rish</button>
                    <input type="hidden" id="hist-phone">
                </div>
                <div id="history-map" style="flex: 1; border: 1px solid #ddd;"></div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    document.getElementById('historyModal').style.display = 'flex';
    document.getElementById('hist-name').innerText = name;
    document.getElementById('hist-phone').value = phone;
    document.getElementById('hist-date').value = new Date().toISOString().split('T')[0];

    setTimeout(() => {
        if (!historyMap) {
            historyMap = L.map('history-map').setView([38.8410, 65.7900], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(historyMap);
        } else {
            historyMap.invalidateSize();
        }
        // Avtomatik yuklash
        loadDriverHistory();
    }, 300);
}

async function loadDriverHistory() {
    const phone = document.getElementById('hist-phone').value;
    const date = document.getElementById('hist-date').value;
    
    if (historyPolyline) historyMap.removeLayer(historyPolyline);
    
    const res = await fetch(`${API_URL}/admin/driver/history?phone=${phone}&date=${date}`);
    const locations = await res.json();
    
    if (locations.length === 0) {
        alert("Bu sana uchun ma'lumot yo'q");
        return;
    }

    const latlngs = locations.map(l => [l.lat, l.lng]);
    historyPolyline = L.polyline(latlngs, { color: 'blue', weight: 4 }).addTo(historyMap);
    historyMap.fitBounds(historyPolyline.getBounds());
}

// ==============================
// 10. JONLI XARITA (LIVE MAP)
// ==============================
let liveMap = null;
let liveMarkers = {};

function openLiveMap() {
    // Modal HTML yaratish (dinamik tarzda)
    if (!document.getElementById('liveMapModal')) {
        const html = `
        <div id="liveMapModal" class="modal">
            <style>
                .live-map-layout { display: flex; height: 100%; overflow: hidden; }
                .live-sidebar { width: 280px; background: #fff; border-right: 1px solid #ddd; display: flex; flex-direction: column; z-index: 2; }
                .live-sidebar-header { padding: 15px; border-bottom: 1px solid #eee; background: #f9f9f9; display: flex; justify-content: space-between; align-items: center; }
                .live-sidebar-content { flex: 1; overflow-y: auto; padding: 10px; }
                .live-map-wrapper { flex: 1; position: relative; }
                .driver-list-item { padding: 12px; background: white; border: 1px solid #eee; border-radius: 8px; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.2s; }
                .driver-list-item:hover { background: #f0faff; border-color: #b3e5fc; }
                .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; box-shadow: 0 0 5px rgba(0,0,0,0.2); }
                .car-icon-wrapper { transition: all 0.5s linear; }
                .car-img-anim { width: 100%; height: 100%; object-fit: contain; transition: transform 0.5s linear; }
            </style>
            <div class="modal-content" style="width: 95%; height: 90%; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
                <div class="modal-header" style="padding: 15px 20px; background: #333; color: white; border-radius: 0;">
                    <h3 style="margin:0; font-size: 18px;"><i class="fas fa-satellite-dish"></i> Jonli Kuzatuv</h3>
                    <span class="close-btn" onclick="document.getElementById('liveMapModal').style.display='none'" style="color: white;">&times;</span>
                </div>
                <div class="live-map-layout">
                    <div class="live-sidebar">
                        <div class="live-sidebar-header">
                            <b style="font-size:14px;">Haydovchilar</b>
                            <button class="btn btn-sm btn-outline" onclick="updateLiveSidebar()" title="Yangilash"><i class="fas fa-sync-alt"></i></button>
                        </div>
                        <div class="live-sidebar-content" id="live-drivers-list">
                            <div style="text-align:center; color:#888; margin-top:20px;">Yuklanmoqda...</div>
                        </div>
                    </div>
                    <div class="live-map-wrapper">
                        <div id="live-map-container" style="width: 100%; height: 100%;"></div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
    
    document.getElementById('liveMapModal').style.display = 'flex';
    
    // Xaritani ishga tushirish
    if (!liveMap) {
        liveMap = L.map('live-map-container').setView([38.8410, 65.7900], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(liveMap);
    } else {
        setTimeout(() => liveMap.invalidateSize(), 300);
    }
    updateLiveSidebar();
}

function updateLiveSidebar() {
    const list = document.getElementById('live-drivers-list');
    if(!list) return;
    
    // Filter online/busy drivers
    const activeDrivers = loadedDrivers.filter(d => d.status === 'online' || d.status === 'busy');
    
    if(activeDrivers.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#888; padding:20px;">Aktiv haydovchilar yo\'q</div>';
        return;
    }
    
    list.innerHTML = '';
    activeDrivers.forEach(d => {
        const color = d.status === 'online' ? '#2ecc71' : '#f1c40f';
        const item = document.createElement('div');
        item.className = 'driver-list-item';
        item.innerHTML = `
            <div class="status-dot" style="background:${color}"></div>
            <div>
                <div style="font-weight:bold; font-size:14px;">${d.firstname} ${d.lastname}</div>
                <div style="font-size:12px; color:#666;">${d.marka} | ${d.raqam}</div>
            </div>
        `;
        item.onclick = () => {
            if(liveMarkers[d.telefon]) {
                const m = liveMarkers[d.telefon];
                liveMap.setView(m.getLatLng(), 17);
                m.openPopup();
            } else if (d.lat && d.lng) {
                liveMap.setView([d.lat, d.lng], 17);
            }
        };
        list.appendChild(item);
    });
}

function calculateAngle(lat1, lng1, lat2, lng2) {
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

if (socket) {
    socket.on('live_tracking', (data) => {
        if (!liveMap || document.getElementById('liveMapModal').style.display === 'none') return;
        
        const id = data.id || 'unknown';
        const driver = loadedDrivers.find(d => d.telefon === id);
        
        // Custom Icon
        const carIcon = L.divIcon({
            className: 'car-icon-wrapper',
            html: '<img src="img/car.png" class="car-img-anim" style="width:100%; height:100%; object-fit: contain;">',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        let content = `<b>Tel:</b> ${id}`;
        
        if (driver) {
            content = `
                <div style="text-align:center; min-width:150px;">
                    <h4 style="margin:0 0 5px 0; color:#333;">${driver.firstname} ${driver.lastname}</h4>
                    <div style="margin-bottom:5px; font-size:13px;">${driver.marka} (${driver.raqam})</div>
                    <div style="color:green; font-weight:bold; font-size:14px;">💰 ${driver.balans.toLocaleString()} so'm</div>
                    <div style="font-size:12px; color:#666; margin-top:5px;">${driver.telefon}</div>
                </div>
            `;
        }

        if (liveMarkers[id]) {
            const marker = liveMarkers[id];
            const oldPos = marker.getLatLng();
            const newPos = L.latLng(data.lat, data.lng);
            
            // Faqat o'zgargan bo'lsa
            if (oldPos.lat !== newPos.lat || oldPos.lng !== newPos.lng) {
                marker.setLatLng(newPos);
                marker.setPopupContent(content);

                // Rotation
                if (oldPos.distanceTo(newPos) > 2) {
                    const angle = calculateAngle(oldPos.lat, oldPos.lng, data.lat, data.lng);
                    const iconEl = marker.getElement();
                    if (iconEl) {
                        const img = iconEl.querySelector('.car-img-anim');
                        if (img) img.style.transform = `rotate(${angle}deg)`;
                    }
                }
            }
        } else {
            const m = L.marker([data.lat, data.lng], {icon: carIcon}).addTo(liveMap);
            m.bindPopup(content);
            liveMarkers[id] = m;
            // Agar ro'yxatda bo'lmasa, ro'yxatni yangilash (yangi haydovchi online bo'lsa)
            if(driver && driver.status === 'offline') {
                driver.status = 'online'; // Lokal yangilash
                updateLiveSidebar();
            }
        }
    });
}

// [YANGI] HAMKORLAR (PARTNERS)
async function loadPartners() {
    ensurePageSection('partners', 'Hamkorlar', ['Brend', 'F.I.O', 'Telefon', 'Ulush (%)', 'Balans', 'Amallar']);
    
    // Qo'shish tugmasi
    const header = document.querySelector('#partners .header');
    if(header && !header.querySelector('.btn-add-pt')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-add-pt';
        btn.innerText = '+ Hamkor Qo\'shish';
        btn.onclick = () => openPartnerModal();
        header.appendChild(btn);
    }

    const res = await fetch(`${API_URL}/admin/staff`);
    const staff = await res.json();
    const partners = staff.filter(s => s.role === 'partner');

    const tbody = document.getElementById('partners-table');
    tbody.innerHTML = '';
    partners.forEach(p => {
        tbody.innerHTML += `<tr>
            <td><b>${p.partner_name || '-'}</b></td>
            <td>${p.full_name}</td>
            <td>${p.phone || '-'}</td>
            <td><span class="badge bg-new">${p.commission_percent || 0}%</span></td>
            <td><b>${(p.balance || 0).toLocaleString()}</b></td>
            <td>
                <button class="btn btn-outline" onclick="openBalanceModal('${p._id}', '${p.partner_name}', 'partner')" title="Balans">💰</button>
                <button class="btn btn-primary" onclick="editPartner('${p._id}')">✏️</button>
                <button class="btn btn-danger" onclick="deleteStaff('${p._id}')">🗑</button>
            </td>
        </tr>`;
    });
}

function openPartnerModal() {
    document.getElementById('partnerModal').style.display = 'flex';
    document.getElementById('pt-edit-id').value = '';
    document.querySelectorAll('#partnerModal input').forEach(i => i.value = '');
    document.getElementById('pt-phone').value = '+998';
    document.getElementById('pt-commission').value = 10;
}

async function savePartner() {
    const data = {
        id: document.getElementById('pt-edit-id').value || null,
        firstname: document.getElementById('pt-firstname').value,
        lastname: document.getElementById('pt-lastname').value,
        partner_name: document.getElementById('pt-brand').value,
        phone: document.getElementById('pt-phone').value,
        inn: document.getElementById('pt-inn').value,
        passport_serial: document.getElementById('pt-passport').value,
        jshshir: document.getElementById('pt-jshshir').value,
        username: document.getElementById('pt-user').value,
        password: document.getElementById('pt-pass').value,
        commission_percent: Number(document.getElementById('pt-commission').value),
        role: 'partner',
        full_name: `${document.getElementById('pt-lastname').value} ${document.getElementById('pt-firstname').value}`
    };

    if(!data.username || !data.password) return alert("Login va parol majburiy!");

    await fetch(`${API_URL}/admin/staff`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    document.getElementById('partnerModal').style.display = 'none';
    loadPartners();
    alert("Hamkor saqlandi!");
}

function injectPartnerMenuItem() {
    const existing = document.querySelector(".menu-item[onclick*='partners']");
    if (existing) return;
    const menu = document.querySelector('.menu');
    if (!menu) return;
    const btn = document.createElement('div');
    btn.className = 'menu-item';
    btn.setAttribute('onclick', "openPage('partners')");
    btn.innerHTML = '<i class="fas fa-handshake"></i> Hamkorlar';
    
    // Boshqaruv bo'limiga qo'shish (#sub-mng)
    const subMng = document.getElementById('sub-mng');
    if (subMng) subMng.appendChild(btn);
    else menu.appendChild(btn);
}

// ==============================
// 11. HISOBOTLAR (REPORTS)
// ==============================
async function loadReports() {
    try {
        const res = await fetch(`${API_URL}/drivers`);
        let drivers = await res.json();

        // [YANGI] Agar hamkor bo'lsa, faqat o'z haydovchilarini hisoblaydi
        if (currentUser && currentUser.role === 'partner') {
            drivers = drivers.filter(d => d.partner_id === currentUser.id);
        }

        const incomeMap = {};
        
        // Barcha haydovchilarning daromadlarini yig'amiz
        drivers.forEach(d => {
            if (d.daromad_tarixi && Array.isArray(d.daromad_tarixi)) {
                d.daromad_tarixi.forEach(item => {
                    if (incomeMap[item.sana]) {
                        incomeMap[item.sana] += item.summa;
                    } else {
                        incomeMap[item.sana] = item.summa;
                    }
                });
            }
        });

        // Sanalarni to'g'ri tartiblash (DD.MM)
        const labels = Object.keys(incomeMap).sort((a, b) => {
            const [d1, m1] = a.split('.').map(Number);
            const [d2, m2] = b.split('.').map(Number);
            return m1 - m2 || d1 - d2;
        });
        const data = labels.map(date => incomeMap[date]);

        const ctx = document.getElementById('incomeChart');
        if (window.myChart instanceof Chart) window.myChart.destroy();

        window.myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: "Kunlik Jami Daromad (so'm)",
                    data: data,
                    backgroundColor: '#FFD600',
                    borderRadius: 8
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        // [YANGI] KUNLIK TOP HAYDOVCHILAR REYTINGI
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const todayStr = `${dd}.${mm}`; // Masalan: "25.05"

        const topDrivers = drivers.map(d => {
            const history = d.daromad_tarixi || [];
            const entry = history.find(h => h.sana === todayStr);
            return {
                name: (d.firstname || '') + ' ' + (d.lastname || ''),
                phone: d.telefon,
                car: (d.marka || '') + ' (' + (d.raqam || '') + ')',
                amount: entry ? entry.summa : 0
            };
        })
        .filter(d => d.amount > 0) // Faqat daromad qilganlar
        .sort((a, b) => b.amount - a.amount) // Kamayish tartibida
        .slice(0, 10); // Top 10 talik

        let topContainer = document.getElementById('reports-top-container');
        if(!topContainer) {
            topContainer = document.createElement('div');
            topContainer.id = 'reports-top-container';
            topContainer.style.marginTop = '30px';
            document.getElementById('reports').appendChild(topContainer);
        }

        topContainer.innerHTML = `
            <div class="card" style="border-top: 4px solid #f1c40f;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <h3 style="margin:0; color:#333;"><i class="fas fa-trophy" style="color:#f1c40f; margin-right:10px;"></i> Kunlik Top-10 Haydovchilar</h3>
                    <span style="color:#777; font-size:12px;">${today.toLocaleDateString()}</span>
                </div>
                <table class="table">
                    <thead><tr><th width="50">#</th><th>Haydovchi</th><th>Telefon</th><th>Avtomobil</th><th style="text-align:right">Daromad</th></tr></thead>
                    <tbody>
                        ${topDrivers.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#999; padding:15px;">Bugun daromad qilganlar yo\'q</td></tr>' : ''}
                        ${topDrivers.map((d, i) => {
                            let icon = i===0 ? '🥇 ' : (i===1 ? '🥈 ' : (i===2 ? '🥉 ' : ''));
                            return `<tr><td style="text-align:center; font-weight:bold;">${icon}${i+1}</td><td><b>${d.name}</b></td><td>${d.phone}</td><td>${d.car}</td><td style="text-align:right; color:green; font-weight:bold;">${d.amount.toLocaleString()} so'm</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // [YANGI] Batafsil Jadval va Excel Export
        const resDetailed = await fetch(`${API_URL}/admin/reports/detailed`);
        const reportData = await resDetailed.json();
        
        let container = document.getElementById('reports-detailed-container');
        if(!container) {
            container = document.createElement('div');
            container.id = 'reports-detailed-container';
            container.style.marginTop = '30px';
            document.getElementById('reports').appendChild(container);
        }
        
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-top:1px solid #eee; padding-top:20px;">
                <h3>Batafsil Daromadlar</h3>
                <button class="btn btn-primary" style="background:#2ecc71;" onclick="exportTableToExcel('reports-table', 'daromadlar_hisoboti')">📊 Excelga Yuklash</button>
            </div>
            <div style="overflow-x:auto;">
                <table class="table" id="reports-table">
                    <thead>
                        <tr>
                            <th>Haydovchi</th>
                            <th>Telefon</th>
                            <th>Avtomobil</th>
                            <th>Bugun</th>
                            <th>Hafta (7 kun)</th>
                            <th>Oy (30 kun)</th>
                            <th>Balans</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.map(r => `
                            <tr>
                                <td>${r.name}</td>
                                <td>${r.phone}</td>
                                <td>${r.car}</td>
                                <td>${r.daily.toLocaleString()}</td>
                                <td>${r.weekly.toLocaleString()}</td>
                                <td>${r.monthly.toLocaleString()}</td>
                                <td>${r.balance.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) { console.error(e); }
}

// [YANGI] Excelga (CSV) yuklash funksiyasi
window.exportTableToExcel = function(tableID, filename = ''){
    let csv = [];
    // UTF-8 BOM qo'shamiz (Excel kirill alifbosini to'g'ri o'qishi uchun)
    csv.push("\uFEFF"); 
    
    let rows = document.querySelectorAll("#" + tableID + " tr");
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) 
            // Matn ichidagi vergullarni nuqtali vergulga almashtiramiz (CSV buzilmasligi uchun)
            row.push('"' + cols[j].innerText.replace(/,/g, '') + '"');
        csv.push(row.join(","));        
    }

    downloadCSV(csv.join("\n"), filename);
};

function downloadCSV(csv, filename) {
    var csvFile;
    var downloadLink;

    csvFile = new Blob([csv], {type: "text/csv"});
    downloadLink = document.createElement("a");
    downloadLink.download = filename + ".csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
}

// ==============================
// 12. HODIMLAR (STAFF)
// ==============================
let loadedStaff = [];
async function loadStaff() {
    const res = await fetch(`${API_URL}/admin/staff`);
    const staff = await res.json();
    loadedStaff = staff;
    const tbody = document.getElementById('staff-table');
    tbody.innerHTML = '';
    staff.forEach(s => {
        const statusBadge = s.is_active !== false ? '<span class="badge bg-new">Aktiv</span>' : '<span class="badge" style="background:#fee2e2; color:red">Bloklangan</span>';
        const commInfo = s.role === 'partner' ? `<br><small>Ulush: ${s.commission_percent}% | Balans: ${s.balance || 0}</small>` : '';
        
        tbody.innerHTML += `
            <tr>
                <td>${s.full_name || '-'}</td>
                <td>${s.username}</td>
                <td><span class="badge">${s.role.toUpperCase()}</span>${commInfo}</td>
                <td>${statusBadge}</td>
                <td>${s.last_login || '-'}</td>
                <td>
                    <button class="btn btn-primary" onclick="editStaff('${s._id}')">✏️</button>
                    <button class="btn btn-danger" onclick="deleteStaff('${s._id}')">🗑</button>
                </td>
            </tr>
        `;
    });
}

async function openStaffModal() { 
    document.getElementById('staffModal').style.display = 'flex'; 
    document.getElementById('st-edit-id').value = '';
    document.getElementById('st-name').value = '';
    document.getElementById('st-user').value = '';
    document.getElementById('st-pass').value = '';
    document.getElementById('st-active').checked = true;
    document.getElementById('st-commission').value = 0;
    document.getElementById('st-commission-box').style.display = 'none';

    // Rollarni yuklash
    const res = await fetch(`${API_URL}/admin/roles`);
    const roles = await res.json();
    const sel = document.getElementById('st-role');
    sel.innerHTML = roles.map(r => `<option value="${r.slug}">${r.name}</option>`).join('');
    
    // Rol o'zgarganda commission inputni ko'rsatish
    sel.onchange = () => {
        document.getElementById('st-commission-box').style.display = sel.value === 'partner' ? 'block' : 'none';
    };
}

function editStaff(id) {
    const s = loadedStaff.find(x => x._id === id);
    if(!s) return;
    openStaffModal();
    document.getElementById('st-edit-id').value = s._id;
    document.getElementById('st-name').value = s.full_name;
    document.getElementById('st-user').value = s.username;
    document.getElementById('st-pass').value = s.password;
    document.getElementById('st-role').value = s.role;
    document.getElementById('st-active').checked = s.is_active !== false;
    document.getElementById('st-commission').value = s.commission_percent || 0;
    document.getElementById('st-commission-box').style.display = s.role === 'partner' ? 'block' : 'none';
}

function closeStaffModal() { document.getElementById('staffModal').style.display = 'none'; }

async function saveStaff() {
    const data = {
        id: document.getElementById('st-edit-id').value || null,
        full_name: document.getElementById('st-name').value,
        username: document.getElementById('st-user').value,
        password: document.getElementById('st-pass').value,
        role: document.getElementById('st-role').value,
        is_active: document.getElementById('st-active').checked,
        commission_percent: Number(document.getElementById('st-commission').value)
    };
    await fetch(`${API_URL}/admin/staff`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    closeStaffModal(); loadStaff();
}

async function deleteStaff(id) {
    if(confirm("O'chirilsinmi?")) {
        await fetch(`${API_URL}/admin/staff/${id}`, { method: 'DELETE' });
        loadStaff();
    }
}

// [YANGI] Xabar yuborish Modali
function openBroadcastModal() {
    if (!document.getElementById('broadcastModal')) {
        const html = `
        <div id="broadcastModal" class="modal">
            <div class="modal-content" style="width: 400px;">
                <div class="modal-header">
                    <h3>📢 Umumiy Xabar</h3>
                    <span class="close-btn" onclick="document.getElementById('broadcastModal').style.display='none'">&times;</span>
                </div>
                <div style="padding: 20px;">
                    <textarea id="broadcast-text" rows="5" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; font-size:14px;" placeholder="Xabar matnini kiriting..."></textarea>
                    <button class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="sendBroadcast()">Yuborish</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
    document.getElementById('broadcastModal').style.display = 'flex';
    document.getElementById('broadcast-text').value = '';
}

async function sendBroadcast() {
    const text = document.getElementById('broadcast-text').value;
    if(!text) return alert("Matn kiriting!");
    
    await fetch(`${API_URL}/admin/broadcast`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ message: text })
    });
    
    alert("Xabar yuborildi!");
    document.getElementById('broadcastModal').style.display = 'none';
}

// ==============================
// 14. ROLLAR (ROLES) - [YANGI]
// ==============================
async function loadRoles() {
    const res = await fetch(`${API_URL}/admin/roles`);
    const roles = await res.json();
    const tbody = document.getElementById('roles-table');
    tbody.innerHTML = '';
    roles.forEach(r => {
        tbody.innerHTML += `
            <tr>
                <td><b>${r.slug}</b></td>
                <td>${r.name}</td>
                <td>${r.permissions.join(', ')}</td>
                <td><button class="btn btn-danger" onclick="deleteRole('${r._id}')">🗑</button></td>
            </tr>`;
    });
}

function openRoleModal() { document.getElementById('roleModal').style.display = 'flex'; }
function closeRoleModal() { document.getElementById('roleModal').style.display = 'none'; }

async function saveRole() {
    const perms = [];
    document.querySelectorAll('#r-permissions input:checked').forEach(cb => perms.push(cb.value));
    
    const data = {
        slug: document.getElementById('r-slug').value,
        name: document.getElementById('r-name').value,
        permissions: perms
    };
    await fetch(`${API_URL}/admin/roles`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    closeRoleModal(); loadRoles();
}

async function deleteRole(id) {
    if(confirm("O'chirilsinmi?")) { await fetch(`${API_URL}/admin/roles/${id}`, { method: 'DELETE' }); loadRoles(); }
}

// ==============================
// 15. MOLIYA (FINANCE) - [YANGI]
// ==============================
async function loadFinance() {
    let url = `${API_URL}/admin/transactions`;
    
    // Agar Hamkor bo'lsa, faqat o'zining tranzaksiyalarini ko'radi
    if (currentUser.role === 'partner') {
        url += `?partner_id=${currentUser.id}`;
        // Balansni ko'rsatish
        const bal = currentUser.balance || 0;
        document.getElementById('partner-balance-display').innerText = `Balans: ${bal.toLocaleString()} so'm`;
    } else {
        document.getElementById('partner-balance-display').innerText = '';
    }
    
    // [YANGI] Kompaniya ulushini yuklash (Faqat Admin uchun)
    const commCard = document.getElementById('company-commission-card');
    if (currentUser.role === 'partner') {
        if(commCard) commCard.style.display = 'none';
    } else {
        if(commCard) commCard.style.display = 'flex';
        const sRes = await fetch(`${API_URL}/settings`);
        const settings = await sRes.json();
        const commInput = document.getElementById('company-commission');
        if(commInput) commInput.value = settings.company_commission || 0;
    }

    const res = await fetch(url);
    const transactions = await res.json();
    
    const tbody = document.getElementById('finance-table');
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Tranzaksiyalar yo\'q</td></tr>';
        return;
    }

    transactions.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td>${new Date(t.date).toLocaleString("uz-UZ")}</td>
                <td>#${t.order_id}</td>
                <td>${t.driver_id}</td>
                <td>${t.total_amount.toLocaleString()}</td>
                <td style="color:green; font-weight:bold">+${t.partner_share.toLocaleString()}</td>
                <td style="color:blue">+${t.company_share.toLocaleString()}</td>
            </tr>`;
    });
}

async function saveCompanyCommission() {
    const val = document.getElementById('company-commission').value;
    await fetch(`${API_URL}/settings/commission`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ company_commission: Number(val) })
    });
    alert("Kompaniya ulushi saqlandi!");
}

// ==============================
// 16. TIZIM LOGLARI (LOGS) - [YANGI]
// ==============================
async function loadLogs() {
    const res = await fetch(`${API_URL}/admin/logs`);
    const logs = await res.json();
    const tbody = document.getElementById('logs-table');
    tbody.innerHTML = '';
    logs.forEach(l => {
        tbody.innerHTML += `
            <tr>
                <td>${l.time}</td>
                <td><b>${l.username}</b></td>
                <td>${l.action}</td>
                <td style="color:#666">${l.details}</td>
            </tr>`;
    });
}

// ==============================
// 17. ZAXIRA NUSXALAR (BACKUPS) - [YANGI]
// ==============================
async function loadBackups() {
    const res = await fetch(`${API_URL}/admin/backups`);
    const backups = await res.json();
    const tbody = document.getElementById('backups-table');
    tbody.innerHTML = '';
    if(backups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Backup fayllar yo\'q</td></tr>';
        return;
    }
    backups.forEach(b => {
        tbody.innerHTML += `
            <tr>
                <td>${b.name}</td>
                <td>${b.size}</td>
                <td>${new Date(b.date).toLocaleString("uz-UZ")}</td>
                <td><button class="btn btn-primary" onclick="restoreBackup('${b.name}')">♻️ Tiklash</button></td>
            </tr>`;
    });
}

async function restoreBackup(filename) {
    if(confirm(`Diqqat! "${filename}" nusxasini tiklamoqchimisiz? Hozirgi ma'lumotlar o'zgaradi!`)) {
        const res = await fetch(`${API_URL}/admin/backups/restore`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if(data.success) {
            alert("Tizim muvaffaqiyatli tiklandi!");
            location.reload();
        } else {
            alert("Xatolik: " + data.error);
        }
    }
}

// ==============================
// 18. PROMOKODLAR (PROMOCODES) - [YANGI]
// ==============================
async function loadPromocodes() {
    const res = await fetch(`${API_URL}/promocodes`);
    const data = await res.json();
    const tbody = document.getElementById('promocodes-table');
    tbody.innerHTML = '';
    data.forEach(p => {
        tbody.innerHTML += `<tr><td><b>${p.code}</b></td><td>${p.amount} ${p.type === 'percent' ? '%' : "so'm"}</td><td>${p.type === 'percent' ? 'Foiz' : 'Summa'}</td><td><button class="btn btn-danger" onclick="deletePromo(${p.id})">🗑</button></td></tr>`;
    });
}

function openPromoModal() { document.getElementById('promoModal').style.display = 'flex'; }
function closePromoModal() { document.getElementById('promoModal').style.display = 'none'; }

async function savePromo() {
    const data = {
        code: document.getElementById('pr-code').value.toUpperCase(),
        amount: document.getElementById('pr-amount').value,
        type: document.getElementById('pr-type').value
    };
    await fetch(`${API_URL}/promocodes`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    closePromoModal(); loadPromocodes();
}

async function deletePromo(id) {
    if(confirm("O'chirilsinmi?")) { await fetch(`${API_URL}/promocodes/${id}`, { method: 'DELETE' }); loadPromocodes(); }
}

// ==============================
// 13. PAROLNI O'ZGARTIRISH
// ==============================
function openChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'flex';
    document.getElementById('cp-old').value = '';
    document.getElementById('cp-new').value = '';
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
}

async function submitChangePassword() {
    const oldPass = document.getElementById('cp-old').value;
    const newPass = document.getElementById('cp-new').value;

    if(!oldPass || !newPass) return alert("Barcha maydonlarni to'ldiring!");
    if(!currentUser || !currentUser.id) return alert("Tizimga qayta kiring!");

    const res = await fetch(`${API_URL}/admin/change-password`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: currentUser.id, oldPassword: oldPass, newPassword: newPass })
    });
    const data = await res.json();

    if(data.success) { alert("Parol o'zgartirildi!"); closeChangePasswordModal(); }
    else { alert(data.error); }
}

// ==============================
// 19. YANGI FUNKSIYALAR (YORDAMCHI)
// ==============================

// HTML da bo'lim yo'q bo'lsa, uni avtomatik yaratish
function ensurePageSection(id, title, headers) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.className = 'page-section active'; // Darhol active qilamiz
        
        let btnHtml = '';
        if(id === 'shifts') btnHtml = `<button class="btn btn-primary" onclick="openShiftModal()">+ Qo'shish</button>`;
        if(id === 'dispatchers') btnHtml = `<button class="btn btn-primary" onclick="openDispatcherModal()">+ Yangi Dispetcher</button>`;
        if(id === 'managers') btnHtml = `<button class="btn btn-primary" onclick="openManagerModal()">+ Yangi Menejer</button>`;
        
        let thHtml = headers.map(h => `<th>${h}</th>`).join('');

        // [O'ZGARTIRILDI] Inline stillar olib tashlandi va .card klassi ishlatildi
        el.innerHTML = `
            <div class="header">
                <h2>${title}</h2>
                ${btnHtml}
            </div>
            <div class="card">
                <table>
                    <thead><tr>${thHtml}</tr></thead>
                    <tbody id="${id}-table"></tbody>
                </table>
            </div>
        `;
        
        // [O'ZGARTIRILDI] .main-content o'rniga .content ishlatildi (admin.html da shunday nomlangan)
        const container = document.querySelector('.content');
        if (container) {
            container.appendChild(el);
        } else {
            console.error("Xatolik: .content konteyneri topilmadi!");
            document.body.appendChild(el); // Ehtiyot chorasi sifatida
        }
    }
    return el;
}

// 1. GRAFIK SMEN (SHIFTS)
async function loadShifts() {
    ensurePageSection('shifts', 'Grafik Smen', ['Nomi', 'Boshlanish', 'Tugash', 'Holati', 'Amallar']);
    const res = await fetch(`${API_URL}/shifts`);
    const data = await res.json();
    const tbody = document.getElementById('shifts-table');
    tbody.innerHTML = '';
    data.forEach(s => {
        tbody.innerHTML += `<tr><td>${s.name}</td><td>${s.start}</td><td>${s.end}</td><td>${s.active?'Aktiv':'-'}</td><td><button class="btn btn-danger" onclick="deleteItem('shifts', ${s.id})">🗑</button></td></tr>`;
    });
}
async function openShiftModal() {
    const name = prompt("Smena nomi:");
    const start = prompt("Boshlanish vaqti (08:00):");
    const end = prompt("Tugash vaqti (20:00):");
    if(name && start && end) {
        await fetch(`${API_URL}/shifts`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, start, end }) });
        loadShifts();
    }
}

// 2. ZVONKI (CALLS)
async function loadCalls() {
    ensurePageSection('calls', 'Qo\'ng\'iroqlar Tarixi', ['Vaqt', 'Turi', 'Telefon', 'Davomiylik', 'Status']);
    const res = await fetch(`${API_URL}/calls`);
    const data = await res.json();
    const tbody = document.getElementById('calls-table');
    tbody.innerHTML = '';
    if(data.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Qo\'ng\'iroqlar yo\'q</td></tr>';
    data.forEach(c => {
        tbody.innerHTML += `<tr><td>${new Date(c.date).toLocaleString()}</td><td>${c.type}</td><td>${c.phone}</td><td>${c.duration}</td><td>${c.status}</td></tr>`;
    });
}

// 3. TEX PODDERJKA (SUPPORT)
async function loadSupport() {
    ensurePageSection('support', 'Texnik Yordam', ['Sana', 'Telefon', 'Mavzu', 'Xabar', 'Status', 'Amallar']);
    const res = await fetch(`${API_URL}/support`);
    const data = await res.json();
    const tbody = document.getElementById('support-table');
    tbody.innerHTML = '';
    data.forEach(s => {
        const action = s.status === 'open' ? `<button class="btn btn-primary" onclick="closeTicket(${s.id})">Yopish</button>` : 'Yopilgan';
        tbody.innerHTML += `<tr><td>${new Date(s.date).toLocaleString()}</td><td>${s.user_phone}</td><td>${s.subject}</td><td>${s.message}</td><td>${s.status}</td><td>${action}</td></tr>`;
    });
}
async function closeTicket(id) {
    if(confirm("Murojaatni yopmoqchimisiz?")) {
        await fetch(`${API_URL}/support/close`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
        loadSupport();
    }
}

// 4. VODITELI ARXIV (DRIVERS ARCHIVE)
async function loadDriversArchive() {
    ensurePageSection('drivers_archive', 'Haydovchilar Arxivi', ['Ism Familiya', 'Telefon', 'Avtomobil', 'Status']);
    // Arxivdagilarni olish uchun oddiy drivers API dan foydalanib filtrlaymiz (yoki alohida API)
    const res = await fetch(`${API_URL}/drivers`);
    const drivers = await res.json();
    const archived = drivers.filter(d => d.status === 'archived' || d.status === 'blocked'); // Arxiv sharti
    
    const tbody = document.getElementById('drivers_archive-table');
    tbody.innerHTML = '';
    if(archived.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Arxiv bo\'sh</td></tr>';
    
    archived.forEach(d => {
        tbody.innerHTML += `<tr><td>${d.lastname} ${d.firstname}</td><td>${d.telefon}</td><td>${d.marka} ${d.raqam}</td><td><span class="badge" style="background:#999">${d.status}</span></td></tr>`;
    });
}

// 5. DISPETCHERLAR VA MENEJERLAR (STAFF FILTER)
async function loadStaffByRole(role) {
    const sectionId = role === 'dispatcher' ? 'dispatchers' : 'managers';
    const title = role === 'dispatcher' ? 'Dispetcherlar' : 'Menejerlar';

    // [YANGI] Ustunlar (Dispetcher uchun Ruxsatlar qo'shildi)
    const headers = ['F.I.O', 'Login'];
    if(role === 'dispatcher' || role === 'manager') headers.push('Ruxsatlar');
    headers.push('Status', 'Oxirgi kirish', 'Amallar');
    
    ensurePageSection(sectionId, title, headers);
    
    const res = await fetch(`${API_URL}/admin/staff`);
    loadedStaff = await res.json(); // [YANGI] Global o'zgaruvchiga yuklash
    const filtered = loadedStaff.filter(s => s.role === role);
    
    const tbody = document.getElementById(sectionId + '-table');
    tbody.innerHTML = '';
    filtered.forEach(s => {
        let perms = '';
        if(role === 'dispatcher' || role === 'manager') {
            if(s.allow_sms) perms += '<i class="fas fa-comment-dots" title="SMS" style="color:#3b82f6; margin-right:4px;"></i>';
            if(s.allow_set_driver) perms += '<i class="fas fa-taxi" title="Haydovchi biriktirish" style="color:#f59e0b; margin-right:4px;"></i>';
            if(s.allow_reg_driver) perms += '<i class="fas fa-user-plus" title="Registratsiya" style="color:#10b981; margin-right:4px;"></i>';
            if(s.allow_check_photo) perms += '<i class="fas fa-camera" title="Foto nazorat" style="color:#6366f1; margin-right:4px;"></i>';
            if(s.allow_unblock_driver) perms += '<i class="fas fa-unlock" title="Blokdan chiqarish" style="color:#ef4444; margin-right:4px;"></i>';
            if(s.allow_chat_templates) perms += '<i class="fas fa-file-alt" title="Shablonlar" style="color:#8b5cf6; margin-right:4px;"></i>';
            if(!perms) perms = '<span style="color:#ccc">-</span>';
            perms = `<td>${perms}</td>`;
        }

        const deleteFunc = role === 'dispatcher' ? `deleteDispatcher('${s._id}')` : `deleteManager('${s._id}')`;
        const editFunc = role === 'dispatcher' ? `editDispatcher('${s._id}')` : `editManager('${s._id}')`; // [YANGI]

        tbody.innerHTML += `<tr>
            <td>${s.full_name}</td>
            <td>${s.username}</td>
            ${perms}
            <td>${s.is_active !== false ? '<span class="badge bg-new">Aktiv</span>' : '<span class="badge" style="background:#fee2e2; color:red">Blok</span>'}</td>
            <td>${s.last_login}</td>
            <td>
                <button class="btn btn-primary" onclick="${editFunc}">✏️</button>
                <button class="btn btn-danger" onclick="${deleteFunc}">🗑</button>
            </td>
        </tr>`;
    });
}

//  [YANGI] Dispetcher qo'shish modali

async function openDispatcherModal() {

    if (document.getElementById('dispatcherModal')) {
        document.getElementById('dispatcherModal').remove();
    }

    // Ma'lumotlarni yuklash (Xizmatlar va Hududlar)
    let services = [], regions = [];
    try {
        const [sRes, rRes] = await Promise.all([
            fetch(`${API_URL}/services`),
            fetch(`${API_URL}/regions`)
        ]);
        services = await sRes.json();
        regions = await rRes.json();
    } catch (e) { console.error("Data load error", e); }

    // Asosiy Xizmat uchun optionlar
    const serviceOptions = services.map(s => `<option value="${s.nomi}">${s.nomi}</option>`).join('');

    // Shaharlar uchun checkboxlar (Multi-select)
    const cityCheckboxes = regions.map(r => `
        <label class="checkbox-item">
            <input type="checkbox" class="d-city-cb" value="${r.nomi}">
            <span>${r.nomi}</span>
        </label>
    `).join('');

    // Ishlash Xizmatlari uchun checkboxlar (Multi-select)
    const serviceCheckboxes = services.map(s => `
        <label class="checkbox-item">
            <input type="checkbox" class="d-service-cb" value="${s.nomi}">
            <span>${s.nomi}</span>
        </label>
    `).join('');

    const html = `
    <div id="dispatcherModal" class="modal">
        <style>
            .modal-content { font-family: 'Inter', sans-serif; }
            .form-group { margin-bottom: 15px; }
            .form-label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px; color: #333; }
            .form-input, .form-select, .form-textarea { width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: 0.2s; }
            .form-input:focus { border-color: #FFD600; outline: none; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .section-title { font-size: 14px; font-weight: 700; color: #888; margin: 20px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
            
            .multi-select-box { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px; max-height: 120px; overflow-y: auto; background: #f9f9f9; }
            .checkbox-item { display: flex; align-items: center; margin-bottom: 6px; cursor: pointer; font-size: 13px; }
            .checkbox-item input { margin-right: 8px; accent-color: #FFD600; }
            .checkbox-item:last-child { margin-bottom: 0; }
            
            .perm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .perm-item { background: #f9f9f9; padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; font-size: 13px; cursor: pointer; border: 1px solid transparent; transition:0.2s; }
            .perm-item:hover { background: #fff; border-color: #ddd; }
            .perm-item input { margin-right: 8px; accent-color: #FFD600; }
        </style>
        <div class="modal-content" style="width: 750px; max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 20px;">
                <h3 style="margin:0; font-size: 18px;">Yangi Dispetcher</h3>
                <span class="close-btn" onclick="document.getElementById('dispatcherModal').style.display='none'" style="font-size: 24px;">&times;</span>
            </div>
            <div style="padding: 25px;">
                <input type="hidden" id="d-edit-id"> <!-- [YANGI] ID uchun -->
                
                <!-- Shaxsiy Ma'lumotlar -->
                <div class="section-title" style="margin-top:0;">Shaxsiy ma'lumotlar</div>
                <div class="grid-3">
                    <div class="form-group">
                        <label class="form-label">Familiya</label>
                        <input type="text" id="d-lastname" class="form-input" placeholder="Familiya">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ism</label>
                        <input type="text" id="d-firstname" class="form-input" placeholder="Ism">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Otasining ismi</label>
                        <input type="text" id="d-patronymic" class="form-input" placeholder="Sharif">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-item" style="font-weight:600;">
                        <input type="checkbox" id="d-active" checked> Aktiv (Tizimga kirish ruxsati)
                    </label>
                </div>

                <!-- Xizmat va Kirish -->
                <div class="section-title">Xizmat va Kirish</div>
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">Asosiy Xizmat (Bo'lim)</label>
                        <select id="d-service" class="form-select">
                            <option value="">Tanlang...</option>
                            ${serviceOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Telefon</label>
                        <input type="text" id="d-phone" class="form-input" placeholder="+998...">
                    </div>
                </div>
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">Login</label>
                        <input type="text" id="d-username" class="form-input" placeholder="Login">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Parol</label>
                        <input type="password" id="d-password" class="form-input" placeholder="Parol">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Izoh</label>
                    <textarea id="d-comment" class="form-textarea" rows="2" placeholder="Qo'shimcha ma'lumot..."></textarea>
                </div>

                <!-- Ruxsatlar -->
                <div class="section-title">Ruxsatlar</div>
                <div class="perm-grid">
                    <label class="perm-item"><input type="checkbox" id="d-allow-sms"> SMS yuborish</label>
                    <label class="perm-item"><input type="checkbox" id="d-allow-set-driver"> Buyurtmaga haydovchi biriktirish</label>
                    <label class="perm-item"><input type="checkbox" id="d-allow-reg-driver"> Haydovchilarni ro'yxatga olish</label>
                    <label class="perm-item"><input type="checkbox" id="d-allow-check-photo"> Foto hisobotlarni tekshirish</label>
                    <label class="perm-item"><input type="checkbox" id="d-allow-unblock-driver"> Haydovchilarni blokdan chiqarish</label>
                    <label class="perm-item"><input type="checkbox" id="d-allow-chat-templates"> Chatda faqat shablonlar</label>
                </div>

                <!-- Cheklovlar -->
                <div class="section-title">Cheklovlar (Agar bo'sh bo'lsa, hammasi)</div>
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">Ishlash Shaharlari</label>
                        <div class="multi-select-box">
                            ${cityCheckboxes || '<div style="color:#999; font-size:12px;">Shaharlar yo\'q</div>'}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ishlash Xizmatlari</label>
                        <div class="multi-select-box">
                            ${serviceCheckboxes || '<div style="color:#999; font-size:12px;">Xizmatlar yo\'q</div>'}
                        </div>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">Navbatlar (Queues)</label>
                        <input type="text" id="d-queues" class="form-input" placeholder="Vergul bilan ajrating">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Kiruvchi Liniyalar</label>
                        <input type="text" id="d-lines" class="form-input" placeholder="Vergul bilan ajrating">
                    </div>
                </div>

                <button class="btn btn-primary" style="width:100%; margin-top:20px; padding:12px; font-size:16px;" onclick="saveDispatcher()">Saqlash</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('dispatcherModal').style.display = 'flex';
}

async function saveDispatcher() {
    const id = document.getElementById('d-edit-id').value; // [YANGI]
    const lastname = document.getElementById('d-lastname').value;
    const firstname = document.getElementById('d-firstname').value;
    const patronymic = document.getElementById('d-patronymic').value;

    // Multi-select qiymatlarini yig'ish
    const cities = Array.from(document.querySelectorAll('.d-city-cb:checked')).map(cb => cb.value).join(',');
    const workServices = Array.from(document.querySelectorAll('.d-service-cb:checked')).map(cb => cb.value).join(',');

    const data = {
        id: id || null, // [YANGI]
        lastname, firstname, patronymic,
        full_name: `${lastname} ${firstname} ${patronymic}`.trim(),
        is_active: document.getElementById('d-active').checked,
        
        service: document.getElementById('d-service').value,
        phone: document.getElementById('d-phone').value,
        username: document.getElementById('d-username').value,
        password: document.getElementById('d-password').value,
        comment: document.getElementById('d-comment').value,
        
        allow_sms: document.getElementById('d-allow-sms').checked,
        allow_set_driver: document.getElementById('d-allow-set-driver').checked,
        allow_reg_driver: document.getElementById('d-allow-reg-driver').checked,
        allow_check_photo: document.getElementById('d-allow-check-photo').checked,
        allow_unblock_driver: document.getElementById('d-allow-unblock-driver').checked,
        allow_chat_templates: document.getElementById('d-allow-chat-templates').checked,
        
        working_cities: cities,
        working_services: workServices,
        working_queues: document.getElementById('d-queues').value,
        incoming_lines: document.getElementById('d-lines').value,
        
        role: 'dispatcher',
    };

    if(!data.username || !data.password) return alert("Login va Parol majburiy!");

    await fetch(`${API_URL}/admin/staff`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    document.getElementById('dispatcherModal').style.display = 'none';
    loadStaffByRole('dispatcher');
    alert("Dispetcher saqlandi!");
}

// [YANGI] Dispetcherni tahrirlash funksiyasi
async function editDispatcher(id) {
    const s = loadedStaff.find(x => x._id === id);
    if(!s) return;

    await openDispatcherModal();
    
    document.getElementById('d-edit-id').value = s._id;
    document.querySelector('#dispatcherModal h3').innerText = "Dispetcherni tahrirlash";
    
    document.getElementById('d-lastname').value = s.lastname || '';
    document.getElementById('d-firstname').value = s.firstname || '';
    document.getElementById('d-patronymic').value = s.patronymic || '';
    
    // Agar eski ma'lumotda faqat full_name bo'lsa, uni bo'lib olamiz
    if(!s.lastname && !s.firstname && s.full_name) {
        const parts = s.full_name.split(' ');
        if(parts.length > 0) document.getElementById('d-lastname').value = parts[0];
        if(parts.length > 1) document.getElementById('d-firstname').value = parts[1];
        if(parts.length > 2) document.getElementById('d-patronymic').value = parts.slice(2).join(' ');
    }

    document.getElementById('d-active').checked = s.is_active !== false;
    document.getElementById('d-service').value = s.service || '';
    document.getElementById('d-phone').value = s.phone || '';
    document.getElementById('d-username').value = s.username || '';
    document.getElementById('d-password').value = s.password || '';
    document.getElementById('d-comment').value = s.comment || '';
    
    document.getElementById('d-allow-sms').checked = s.allow_sms;
    document.getElementById('d-allow-set-driver').checked = s.allow_set_driver;
    document.getElementById('d-allow-reg-driver').checked = s.allow_reg_driver;
    document.getElementById('d-allow-check-photo').checked = s.allow_check_photo;
    document.getElementById('d-allow-unblock-driver').checked = s.allow_unblock_driver;
    document.getElementById('d-allow-chat-templates').checked = s.allow_chat_templates;
    
    document.getElementById('d-queues').value = s.working_queues || '';
    document.getElementById('d-lines').value = s.incoming_lines || '';

    const cities = (s.working_cities || '').split(',');
    document.querySelectorAll('.d-city-cb').forEach(cb => { if(cities.includes(cb.value)) cb.checked = true; });
    
    const srvs = (s.working_services || '').split(',');
    document.querySelectorAll('.d-service-cb').forEach(cb => { if(srvs.includes(cb.value)) cb.checked = true; });
}

// [YANGI] Menejer qo'shish modali (Dispetcher bilan bir xil dizayn)
async function openManagerModal() {
    if (document.getElementById('managerModal')) {
        document.getElementById('managerModal').remove();
    }

    let services = [], regions = [];
    try {
        const [sRes, rRes] = await Promise.all([
            fetch(`${API_URL}/services`),
            fetch(`${API_URL}/regions`)
        ]);
        services = await sRes.json();
        regions = await rRes.json();
    } catch (e) { console.error("Data load error", e); }

    const serviceOptions = services.map(s => `<option value="${s.nomi}">${s.nomi}</option>`).join('');
    const cityCheckboxes = regions.map(r => `<label class="checkbox-item"><input type="checkbox" class="m-city-cb" value="${r.nomi}"><span>${r.nomi}</span></label>`).join('');
    const serviceCheckboxes = services.map(s => `<label class="checkbox-item"><input type="checkbox" class="m-service-cb" value="${s.nomi}"><span>${s.nomi}</span></label>`).join('');

    const html = `
    <div id="managerModal" class="modal">
        <style>
            .modal-content { font-family: 'Inter', sans-serif; }
            .form-group { margin-bottom: 15px; }
            .form-label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px; color: #333; }
            .form-input, .form-select, .form-textarea { width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: 0.2s; }
            .form-input:focus { border-color: #FFD600; outline: none; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .section-title { font-size: 14px; font-weight: 700; color: #888; margin: 20px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
            .multi-select-box { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px; max-height: 120px; overflow-y: auto; background: #f9f9f9; }
            .checkbox-item { display: flex; align-items: center; margin-bottom: 6px; cursor: pointer; font-size: 13px; }
            .checkbox-item input { margin-right: 8px; accent-color: #FFD600; }
            .perm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .perm-item { background: #f9f9f9; padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; font-size: 13px; cursor: pointer; border: 1px solid transparent; transition:0.2s; }
            .perm-item:hover { background: #fff; border-color: #ddd; }
            .perm-item input { margin-right: 8px; accent-color: #FFD600; }
        </style>
        <div class="modal-content" style="width: 750px; max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 20px;">
                <h3 style="margin:0; font-size: 18px;">Yangi Menejer</h3>
                <span class="close-btn" onclick="document.getElementById('managerModal').style.display='none'" style="font-size: 24px;">&times;</span>
            </div>
            <div style="padding: 25px;">
                <input type="hidden" id="m-edit-id"> <!-- [YANGI] ID uchun -->
                <div class="section-title" style="margin-top:0;">Shaxsiy ma'lumotlar</div>
                <div class="grid-3">
                    <div class="form-group"><label class="form-label">Familiya</label><input type="text" id="m-lastname" class="form-input" placeholder="Familiya"></div>
                    <div class="form-group"><label class="form-label">Ism</label><input type="text" id="m-firstname" class="form-input" placeholder="Ism"></div>
                    <div class="form-group"><label class="form-label">Otasining ismi</label><input type="text" id="m-patronymic" class="form-input" placeholder="Sharif"></div>
                </div>
                <div class="form-group"><label class="checkbox-item" style="font-weight:600;"><input type="checkbox" id="m-active" checked> Aktiv (Tizimga kirish ruxsati)</label></div>

                <div class="section-title">Xizmat va Kirish</div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Asosiy Xizmat (Bo'lim)</label><select id="m-service" class="form-select"><option value="">Tanlang...</option>${serviceOptions}</select></div>
                    <div class="form-group"><label class="form-label">Telefon</label><input type="text" id="m-phone" class="form-input" placeholder="+998..."></div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Login</label><input type="text" id="m-username" class="form-input" placeholder="Login"></div>
                    <div class="form-group"><label class="form-label">Parol</label><input type="password" id="m-password" class="form-input" placeholder="Parol"></div>
                </div>
                <div class="form-group"><label class="form-label">Izoh</label><textarea id="m-comment" class="form-textarea" rows="2" placeholder="Qo'shimcha ma'lumot..."></textarea></div>

                <div class="section-title">Ruxsatlar</div>
                <div class="perm-grid">
                    <label class="perm-item"><input type="checkbox" id="m-allow-sms"> SMS yuborish</label>
                    <label class="perm-item"><input type="checkbox" id="m-allow-set-driver"> Buyurtmaga haydovchi biriktirish</label>
                    <label class="perm-item"><input type="checkbox" id="m-allow-reg-driver"> Haydovchilarni ro'yxatga olish</label>
                    <label class="perm-item"><input type="checkbox" id="m-allow-check-photo"> Foto hisobotlarni tekshirish</label>
                    <label class="perm-item"><input type="checkbox" id="m-allow-unblock-driver"> Haydovchilarni blokdan chiqarish</label>
                    <label class="perm-item"><input type="checkbox" id="m-allow-chat-templates"> Chatda faqat shablonlar</label>
                </div>

                <div class="section-title">Cheklovlar (Agar bo'sh bo'lsa, hammasi)</div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Ishlash Shaharlari</label><div class="multi-select-box">${cityCheckboxes || '<div style="color:#999; font-size:12px;">Shaharlar yo\'q</div>'}</div></div>
                    <div class="form-group"><label class="form-label">Ishlash Xizmatlari</label><div class="multi-select-box">${serviceCheckboxes || '<div style="color:#999; font-size:12px;">Xizmatlar yo\'q</div>'}</div></div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Navbatlar (Queues)</label><input type="text" id="m-queues" class="form-input" placeholder="Vergul bilan ajrating"></div>
                    <div class="form-group"><label class="form-label">Kiruvchi Liniyalar</label><input type="text" id="m-lines" class="form-input" placeholder="Vergul bilan ajrating"></div>
                </div>

                <button class="btn btn-primary" style="width:100%; margin-top:20px; padding:12px; font-size:16px;" onclick="saveManager()">Saqlash</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('managerModal').style.display = 'flex';
}

async function saveManager() {
    const id = document.getElementById('m-edit-id').value; // [YANGI]
    const lastname = document.getElementById('m-lastname').value;
    const firstname = document.getElementById('m-firstname').value;
    const patronymic = document.getElementById('m-patronymic').value;
    const cities = Array.from(document.querySelectorAll('.m-city-cb:checked')).map(cb => cb.value).join(',');
    const workServices = Array.from(document.querySelectorAll('.m-service-cb:checked')).map(cb => cb.value).join(',');

    const data = {
        id: id || null, // [YANGI]
        lastname, firstname, patronymic,
        full_name: `${lastname} ${firstname} ${patronymic}`.trim(),
        is_active: document.getElementById('m-active').checked,
        service: document.getElementById('m-service').value,
        phone: document.getElementById('m-phone').value,
        username: document.getElementById('m-username').value,
        password: document.getElementById('m-password').value,
        comment: document.getElementById('m-comment').value,
        allow_sms: document.getElementById('m-allow-sms').checked,
        allow_set_driver: document.getElementById('m-allow-set-driver').checked,
        allow_reg_driver: document.getElementById('m-allow-reg-driver').checked,
        allow_check_photo: document.getElementById('m-allow-check-photo').checked,
        allow_unblock_driver: document.getElementById('m-allow-unblock-driver').checked,
        allow_chat_templates: document.getElementById('m-allow-chat-templates').checked,
        working_cities: cities,
        working_services: workServices,
        working_queues: document.getElementById('m-queues').value,
        incoming_lines: document.getElementById('m-lines').value,
        role: 'manager',
    };

    if(!data.username || !data.password) return alert("Login va Parol majburiy!");
    await fetch(`${API_URL}/admin/staff`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    document.getElementById('managerModal').style.display = 'none';
    loadStaffByRole('manager');
    alert("Menejer saqlandi!");
}

// [YANGI] Menejerni tahrirlash funksiyasi
async function editManager(id) {
    const s = loadedStaff.find(x => x._id === id);
    if(!s) return;

    await openManagerModal();
    
    document.getElementById('m-edit-id').value = s._id;
    document.querySelector('#managerModal h3').innerText = "Menejerni tahrirlash";
    
    document.getElementById('m-lastname').value = s.lastname || '';
    document.getElementById('m-firstname').value = s.firstname || '';
    document.getElementById('m-patronymic').value = s.patronymic || '';
    
    if(!s.lastname && !s.firstname && s.full_name) {
        const parts = s.full_name.split(' ');
        if(parts.length > 0) document.getElementById('m-lastname').value = parts[0];
        if(parts.length > 1) document.getElementById('m-firstname').value = parts[1];
        if(parts.length > 2) document.getElementById('m-patronymic').value = parts.slice(2).join(' ');
    }

    document.getElementById('m-active').checked = s.is_active !== false;
    document.getElementById('m-service').value = s.service || '';
    document.getElementById('m-phone').value = s.phone || '';
    document.getElementById('m-username').value = s.username || '';
    document.getElementById('m-password').value = s.password || '';
    document.getElementById('m-comment').value = s.comment || '';
    
    document.getElementById('m-allow-sms').checked = s.allow_sms;
    document.getElementById('m-allow-set-driver').checked = s.allow_set_driver;
    document.getElementById('m-allow-reg-driver').checked = s.allow_reg_driver;
    document.getElementById('m-allow-check-photo').checked = s.allow_check_photo;
    document.getElementById('m-allow-unblock-driver').checked = s.allow_unblock_driver;
    document.getElementById('m-allow-chat-templates').checked = s.allow_chat_templates;
    
    document.getElementById('m-queues').value = s.working_queues || '';
    document.getElementById('m-lines').value = s.incoming_lines || '';

    const cities = (s.working_cities || '').split(',');
    document.querySelectorAll('.m-city-cb').forEach(cb => { if(cities.includes(cb.value)) cb.checked = true; });
    
    const srvs = (s.working_services || '').split(',');
    document.querySelectorAll('.m-service-cb').forEach(cb => { if(srvs.includes(cb.value)) cb.checked = true; });
}

async function deleteManager(id) {
    if(confirm("O'chirilsinmi?")) {
        await fetch(`${API_URL}/admin/staff/${id}`, { method: 'DELETE' });
        loadStaffByRole('manager');
    }
}

async function deleteDispatcher(id) {
    if(confirm("O'chirilsinmi?")) {
        await fetch(`${API_URL}/admin/staff/${id}`, { method: 'DELETE' });
        loadStaffByRole('dispatcher');
    }
}

// 6. INFO
function loadInfo() {
    const el = ensurePageSection('info', 'Tizim Haqida', []);
    el.innerHTML = `
        <div style="padding:20px; text-align:center;">
            <img src="img/logo.png" style="height:60px; margin-bottom:10px;">
            <h3>Taxi Pro System v2.0</h3>
            <p>Barcha huquqlar himoyalangan &copy; 2024</p>
            <p>Texnik yordam: +998 90 123 45 67</p>
        </div>
    `;
}

// [YANGI] Menyuga Dispetcher bo'limini qo'shish funksiyasi
function injectDispatcherMenuItem() {
    const existing = document.querySelector(".menu-item[onclick*='dispatchers']");
    if (existing) return;
    
    const menu = document.querySelector('.menu');
    if (!menu) return;

    const btn = document.createElement('div');
    btn.className = 'menu-item';
    btn.setAttribute('onclick', "openPage('dispatchers')");
    btn.innerHTML = '<i class="fas fa-headset"></i> Dispetcherlar';
    
    // Konstruktor bo'limidan keyin qo'shish (#sub-cons)
    const subCons = document.getElementById('sub-cons');
    if (subCons && subCons.nextSibling) menu.insertBefore(btn, subCons.nextSibling);
    else menu.appendChild(btn);
}

function injectManagerMenuItem() {
    const existing = document.querySelector(".menu-item[onclick*='managers']");
    if (existing) return;
    
    const menu = document.querySelector('.menu');
    if (!menu) return;

    const btn = document.createElement('div');
    btn.className = 'menu-item';
    btn.setAttribute('onclick', "openPage('managers')");
    btn.innerHTML = '<i class="fas fa-user-tie"></i> Menejerlar';
    
    const dispBtn = document.querySelector(".menu-item[onclick*='dispatchers']");
    if (dispBtn && dispBtn.nextSibling) menu.insertBefore(btn, dispBtn.nextSibling);
    else {
        const subCons = document.getElementById('sub-cons');
        if (subCons && subCons.nextSibling) menu.insertBefore(btn, subCons.nextSibling);
        else menu.appendChild(btn);
    }
}

// [YANGI] Calculation Groups (Hisob-kitob guruhlari)
let loadedCalcGroups = [];

async function loadCalculationGroups() {
    ensurePageSection('calculation_groups', 'Hisob-kitob guruhlari', ['Nomi', 'Shahar', 'Turi', 'Qiymati', 'Amallar']);
    
    const res = await fetch(`${API_URL}/calculation-groups`);
    loadedCalcGroups = await res.json();
    
    const tbody = document.getElementById('calculation_groups-table');
    tbody.innerHTML = '';
    
    loadedCalcGroups.forEach(g => {
        tbody.innerHTML += `<tr>
            <td><b>${g.name}</b></td>
            <td>${g.city || '-'}</td>
            <td>${g.calculation_type || '-'}</td>
            <td>${g.calculation_value}</td>
            <td>
                <button class="btn btn-primary" onclick="editCalculationGroup('${g._id}')">✏️</button>
                <button class="btn btn-danger" onclick="deleteCalculationGroup('${g._id}')">🗑</button>
            </td>
        </tr>`;
    });

    // Qo'shish tugmasini sarlavhaga joylash
    const header = document.querySelector('#calculation_groups .header');
    if(header && !header.querySelector('.btn-add-calc')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-add-calc';
        btn.innerText = '+ Guruh qo\'shish';
        btn.onclick = () => openCalculationGroupModal();
        header.appendChild(btn);
    }
}

async function openCalculationGroupModal(groupId = null) {
    if (document.getElementById('calcGroupModal')) document.getElementById('calcGroupModal').remove();

    // Xizmatlar va boshqa guruhlarni yuklash (Selectlar uchun)
    let services = [], groups = [];
    try {
        const [sRes, gRes] = await Promise.all([fetch(`${API_URL}/services`), fetch(`${API_URL}/calculation-groups`)]);
        services = await sRes.json();
        groups = await gRes.json();
    } catch(e){}

    const serviceOpts = services.map(s => `<option value="${s.nomi}">${s.nomi}</option>`).join('');
    const groupOpts = groups.map(g => `<option value="${g._id}">${g.name}</option>`).join('');

    const html = `
    <div id="calcGroupModal" class="modal">
        <div class="modal-content" style="width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>${groupId ? 'Guruhni tahrirlash' : 'Hisob-kitob guruhini qo\'shish'}</h3>
                <span class="close-btn" onclick="document.getElementById('calcGroupModal').style.display='none'">&times;</span>
            </div>
            <div style="padding: 20px;">
                <input type="hidden" id="cg-id" value="${groupId || ''}">
                
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Shahar</label><input type="text" id="cg-city" class="form-input"></div>
                    <div class="form-group"><label class="form-label">Nomi</label><input type="text" id="cg-name" class="form-input"></div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Hisob-kitob turi</label>
                        <select id="cg-type" class="form-select">
                            <option value="fixed">Fiksirlangan</option>
                            <option value="percent">Foizli</option>
                            <option value="time">Vaqt bo'yicha</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label">Hisob-kitob davri (soat/kun)</label><input type="number" id="cg-period" class="form-input" value="1"></div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Hisob-kitob qiymati</label><input type="number" id="cg-value" class="form-input" value="0.00"></div>
                    <div class="form-group"><label class="form-label">Qo'shimcha hisob-kitob qiymati</label><input type="number" id="cg-add-value" class="form-input" value="0.00"></div>
                </div>

                <div class="section-title">Limitlar va Chegaralar</div>
                <div class="grid-3">
                    <div class="form-group"><label class="form-label">Bloklash chegarasi</label><input type="number" id="cg-block" class="form-input" value="0"></div>
                    <div class="form-group"><label class="form-label">Ishga tushish chegarasi</label><input type="number" id="cg-trigger" class="form-input" value="0.00"></div>
                    <div class="form-group"><label class="form-label">Kompensatsiya qilish</label><input type="number" id="cg-compensate" class="form-input" value="0.00"></div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Pullik davrlar</label><input type="number" id="cg-paid" class="form-input" value="0"></div>
                    <div class="form-group"><label class="form-label">Bepul davrlar</label><input type="number" id="cg-free" class="form-input" value="0"></div>
                </div>

                <div class="section-title">Qo'shimcha maydonlar</div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Xizmat</label><select id="cg-service" class="form-select"><option value="">Barchasi</option>${serviceOpts}</select></div>
                    <div class="form-group"><label class="form-label">Qo'shimcha hisob turi</label><input type="text" id="cg-add-type" class="form-input"></div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Kontragentlar guruhi</label><select id="cg-contractor" class="form-select"><option value="">Yo'q</option>${groupOpts}</select></div>
                    <div class="form-group"><label class="form-label">Mustaqil buyurtmalar guruhi</label><select id="cg-self" class="form-select"><option value="">Yo'q</option>${groupOpts}</select></div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Naqdsiz to'lov guruhi</label><select id="cg-cashless" class="form-select"><option value="">Yo'q</option>${groupOpts}</select></div>
                    <div class="form-group"><label class="form-label">O'tadi</label><select id="cg-transition" class="form-select"><option value="">Yo'q</option>${groupOpts}</select></div>
                </div>

                <div style="margin-top:10px;">
                    <label class="checkbox-item"><input type="checkbox" id="cg-consider-service"> Xizmatni inobatga olish</label>
                    <label class="checkbox-item"><input type="checkbox" id="cg-charge-no-orders"> Buyurtma bo'lmasa ham yechib olish</label>
                </div>

                <button class="btn btn-primary" style="width:100%; margin-top:20px;" onclick="saveCalculationGroup()">Saqlash</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('calcGroupModal').style.display = 'flex';

    // Tahrirlash bo'lsa ma'lumotlarni to'ldirish
    if(groupId) {
        const g = loadedCalcGroups.find(x => x._id === groupId);
        if(g) {
            document.getElementById('cg-city').value = g.city || '';
            document.getElementById('cg-name').value = g.name || '';
            document.getElementById('cg-type').value = g.calculation_type || 'fixed';
            document.getElementById('cg-period').value = g.calculation_period || 1;
            document.getElementById('cg-value').value = g.calculation_value || 0;
            document.getElementById('cg-add-value').value = g.additional_calculation_value || 0;
            document.getElementById('cg-block').value = g.blocking_threshold || 0;
            document.getElementById('cg-trigger').value = g.trigger_threshold || 0;
            document.getElementById('cg-compensate').value = g.compensate_to || 0;
            document.getElementById('cg-paid').value = g.paid_periods || 0;
            document.getElementById('cg-free').value = g.free_periods || 0;
            document.getElementById('cg-service').value = g.service || '';
            document.getElementById('cg-add-type').value = g.additional_calculation_type || '';
            document.getElementById('cg-contractor').value = g.contractor_group || '';
            document.getElementById('cg-self').value = g.self_order_group || '';
            document.getElementById('cg-cashless').value = g.cashless_group || '';
            document.getElementById('cg-transition').value = g.transition_group || '';
            document.getElementById('cg-consider-service').checked = g.consider_service;
            document.getElementById('cg-charge-no-orders').checked = g.charge_no_orders;
        }
    }
}

async function saveCalculationGroup() {
    const data = {
        _id: document.getElementById('cg-id').value || null,
        city: document.getElementById('cg-city').value,
        name: document.getElementById('cg-name').value,
        calculation_type: document.getElementById('cg-type').value,
        calculation_period: Number(document.getElementById('cg-period').value),
        calculation_value: Number(document.getElementById('cg-value').value),
        additional_calculation_value: Number(document.getElementById('cg-add-value').value),
        blocking_threshold: Number(document.getElementById('cg-block').value),
        trigger_threshold: Number(document.getElementById('cg-trigger').value),
        compensate_to: Number(document.getElementById('cg-compensate').value),
        paid_periods: Number(document.getElementById('cg-paid').value),
        free_periods: Number(document.getElementById('cg-free').value),
        service: document.getElementById('cg-service').value,
        additional_calculation_type: document.getElementById('cg-add-type').value,
        contractor_group: document.getElementById('cg-contractor').value,
        self_order_group: document.getElementById('cg-self').value,
        cashless_group: document.getElementById('cg-cashless').value,
        transition_group: document.getElementById('cg-transition').value,
        consider_service: document.getElementById('cg-consider-service').checked,
        charge_no_orders: document.getElementById('cg-charge-no-orders').checked
    };

    await fetch(`${API_URL}/calculation-groups`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    document.getElementById('calcGroupModal').style.display = 'none';
    loadCalculationGroups();
}

async function deleteCalculationGroup(id) {
    if(confirm("O'chirilsinmi?")) {
        await fetch(`${API_URL}/calculation-groups/${id}`, { method: 'DELETE' });
        loadCalculationGroups();
    }
}

function editCalculationGroup(id) { openCalculationGroupModal(id); }

function injectCalculationGroupMenuItem() {
    const existing = document.querySelector(".menu-item[onclick*='calculation_groups']");
    if (existing) return;
    
    const menu = document.querySelector('.menu');
    if (!menu) return;

    const btn = document.createElement('div');
    btn.className = 'menu-item';
    btn.setAttribute('onclick', "openPage('calculation_groups')");
    btn.innerHTML = '<i class="fas fa-calculator"></i> Hisob-kitob guruhlari';
    
    const mgrBtn = document.querySelector(".menu-item[onclick*='managers']");
    if (mgrBtn && mgrBtn.nextSibling) menu.insertBefore(btn, mgrBtn.nextSibling);
    else menu.appendChild(btn);
}

// [YANGI] Hamkor Kabinetini yuklash
async function loadPartnerDashboard() {
    if (!currentUser || currentUser.role !== 'partner') return;
    // Standart holatda statistikani ochamiz
    switchPartnerTab('stats');
}

// [YANGI] Tablarni almashtirish
function switchPartnerTab(tabId) {
    // Tugmalar aktivligini o'zgartirish
    document.querySelectorAll('.partner-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Kontentni ko'rsatish/yashirish
    document.querySelectorAll('.partner-tab-content').forEach(div => div.style.display = 'none');
    document.getElementById(`pd-tab-${tabId}`).style.display = 'block';

    if (tabId === 'stats') loadPartnerStats();
    if (tabId === 'drivers') loadPartnerDrivers();
    if (tabId === 'orders') loadPartnerOrders();
}

async function loadPartnerStats() {
    const res = await fetch(`${API_URL}/partner/stats?partner_id=${currentUser.id}`);
    const stats = await res.json();
    
    document.getElementById('pd-total-drivers').innerText = stats.totalDrivers;
    document.getElementById('pd-active-drivers').innerText = stats.activeDrivers;
    document.getElementById('pd-today-income').innerText = stats.todayIncome.toLocaleString() + " so'm";
    document.getElementById('pd-balance').innerText = stats.balance.toLocaleString() + " so'm";
    if(document.getElementById('pd-commission')) document.getElementById('pd-commission').value = stats.commission_percent || 0; // [YANGI]
    
    loadPartnerChart();
}

async function loadPartnerDrivers() {
    const res = await fetch(`${API_URL}/drivers`);
    let drivers = await res.json();
    // Faqat o'zining haydovchilari
    drivers = drivers.filter(d => d.partner_id === currentUser.id);

    const tbody = document.getElementById('pd-drivers-table');
    tbody.innerHTML = '';
    
    if (drivers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Haydovchilar yo\'q</td></tr>';
        return;
    }

    drivers.forEach(d => {
        let stColor = d.status === 'online' ? '#22c55e' : (d.status === 'busy' ? '#f59e0b' : '#64748b');
        let stText = d.status === 'online' ? '🟢 Online' : (d.status === 'busy' ? '🟡 Band' : '⚫ Offline');
        
        tbody.innerHTML += `<tr>
            <td>${d.lastname} ${d.firstname}</td>
            <td>${d.telefon}</td>
            <td>${d.marka} (${d.raqam})</td>
            <td><span style="color:${stColor}; font-weight:600">${stText}</span></td>
            <td><b>${(d.balans || 0).toLocaleString()}</b></td>
            <td>
                <button class="btn btn-outline" onclick="openBalanceModal('${d._id}', '${d.firstname}', 'driver')" title="Balans">💰</button>
                <button class="btn btn-primary" onclick="editDriver('${d._id}')">✏️</button>
            </td>
        </tr>`;
    });
}

async function loadPartnerOrders() {
    const resOrders = await fetch(`${API_URL}/partner/orders?partner_id=${currentUser.id}`);
    const orders = await resOrders.json();
    const tbody = document.getElementById('partner-orders-table');
    if(tbody) {
        tbody.innerHTML = '';
        orders.forEach(o => {
            tbody.innerHTML += `
                <tr>
                    <td>${o.vaqt}</td>
                    <td>${o.haydovchi || '-'}</td>
                    <td>${o.telefon}</td>
                    <td>${o.qayerdan} ➝ ${o.qayerga}</td>
                    <td><b>${o.narx}</b></td>
                    <td><span class="badge">${o.status}</span></td>
                </tr>`;
        });
    }
}

async function loadPartnerChart() {
    const res = await fetch(`${API_URL}/drivers`);
    let drivers = await res.json();
    drivers = drivers.filter(d => d.partner_id === currentUser.id);

    const incomeMap = {};
    drivers.forEach(d => {
        if (d.daromad_tarixi) {
            d.daromad_tarixi.forEach(item => {
                incomeMap[item.sana] = (incomeMap[item.sana] || 0) + item.summa;
            });
        }
    });

    const labels = Object.keys(incomeMap).slice(-7); // Oxirgi 7 kun
    const data = labels.map(date => incomeMap[date]);

    const ctx = document.getElementById('partnerChart');
    if (window.partnerChartInstance instanceof Chart) window.partnerChartInstance.destroy();

    window.partnerChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: "Daromad", data: data, borderColor: '#3b82f6', tension: 0.4 }]
        }
    });
}

// [YANGI] Hamkor o'z ulushini saqlashi
async function saveMyPartnerCommission() {
    if (!currentUser) return;
    const val = document.getElementById('pd-commission').value;
    
    await fetch(`${API_URL}/admin/staff`, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ id: currentUser.id, commission_percent: Number(val) }) 
    });
    
    alert("Ulush saqlandi!");
}

// [YANGI] Hamkor uchun haydovchi qo'shish
async function openPartnerAddDriverModal() {
    await openNewDriverModal();
    // Hamkor maydonini avtomatik tanlash va bloklash
    const partnerSel = document.getElementById('d-partner');
    if(partnerSel && currentUser) {
        partnerSel.value = currentUser.id;
        partnerSel.disabled = true; // O'zgartira olmasligi uchun
    }
}

// [YANGI] SMS Tarixi (Logs)
async function loadSmsLogs() {
    ensurePageSection('sms_logs', 'SMS Tarixi', ['Vaqt', 'Telefon', 'Xabar', 'Status']);
    
    // [YANGI] Qidiruv inputini qo'shish
    const header = document.querySelector('#sms_logs .header');
    if(header && !document.getElementById('sms-search-input')) {
        const div = document.createElement('div');
        div.style.cssText = "display:flex; gap:10px; align-items:center;";
        div.innerHTML = `
            <input type="text" id="sms-search-input" placeholder="Tel raqam..." style="padding:8px; border:1px solid #ddd; border-radius:5px; outline:none;">
            <button class="btn btn-primary" onclick="loadSmsLogs()">Izlash</button>
        `;
        header.appendChild(div);
    }

    const searchVal = document.getElementById('sms-search-input') ? document.getElementById('sms-search-input').value : '';
    const res = await fetch(`${API_URL}/admin/sms-logs${searchVal ? '?phone='+encodeURIComponent(searchVal) : ''}`);
    const logs = await res.json();
    
    const tbody = document.getElementById('sms_logs-table');
    tbody.innerHTML = '';
    
    if(logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">SMS tarixi bo\'sh</td></tr>';
        return;
    }

    logs.forEach(l => {
        const statusBadge = l.status === 'sent' 
            ? '<span class="badge bg-new">Yuborildi</span>' 
            : `<span class="badge" style="background:#fee2e2; color:red">Xato: ${l.error || ''}</span>`;
            
        tbody.innerHTML += `
            <tr>
                <td>${new Date(l.date).toLocaleString("uz-UZ")}</td>
                <td>${l.phone}</td>
                <td>${l.message}</td>
                <td>${statusBadge}</td>
            </tr>`;
    });
}

function injectSmsLogsMenuItem() {
    const existing = document.querySelector(".menu-item[onclick*='sms_logs']");
    if (existing) return;
    const menu = document.querySelector('.menu');
    if (!menu) return;
    const btn = document.createElement('div');
    btn.className = 'menu-item';
    btn.setAttribute('onclick', "openPage('sms_logs')");
    btn.innerHTML = '<i class="fas fa-sms"></i> SMS Tarixi';
    
    // Loglar bo'limidan keyin qo'shish
    const logsBtn = document.querySelector(".menu-item[onclick*='logs']");
    if (logsBtn && logsBtn.nextSibling) menu.insertBefore(btn, logsBtn.nextSibling);
    else menu.appendChild(btn);
}
