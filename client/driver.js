// client/driver.js - TO'LIQ TUZATILGAN VERSIYA

// [YANGI] Global o'zgaruvchilar va funksiyalarni eng tepaga olamiz (Xatolik oldini olish uchun)
var pendingOrder = null; 
var waitingTimerInterval = null; // [YANGI] Kutish taymeri
var socket;

// [YANGI] Ovozli navigatsiya o'zgaruvchilari
let navSteps = [];
let currentStepIndex = 0;
let isNavigating = false;
let lastSpokenIndex = -1;

window.acceptPendingOrder = function() {
    acceptOrderById(pendingOrder ? pendingOrder.id : null);
};

window.skipOrder = function() {
    const panel = document.getElementById('panel-request');
    if(panel) panel.classList.add('hidden-panel');
    pendingOrder = null;
};

// Socket ulanishini himoyalaymiz (Agar io() topilmasa, kod to'xtab qolmaydi)
try { 
    socket = io(); 
} catch(e) { console.error("Socket xatosi:", e); }
// [YANGI] Agar socket ulanmasa, kod sinmasligi uchun bo'sh obyekt yaratamiz
if (!socket) socket = { on: function(){}, emit: function(){} };

var API_BASE = '';
let currentPhone = localStorage.getItem('d_phone') || null;
let map = null;
let driverMarker = null;
let driverMarkerEl = null; // Marker elementi
let currentOrder = null;
let activeOrderId = null; // Aktiv zakaz ID si
let stopMarkers = []; // Oraliq bekat markerlari
let tripStatus = 'yetib_keldi'; // yetib_keldi -> boshlash -> yakunlash
let availableOrders = []; // Ro'yxatdagi zakazlar
let currentSpeed = 0; // [YANGI]
let deviceHeading = 0; // [YANGI]
let wakeLock = null; // [YANGI] Ekran o'chmasligi uchun (Background mode)
let isChatOpen = false; // [YANGI] Chat holati

// --- 1. LOGIN ---
window.loginDriver = async function() {
    const phone = getDriverPhone();
    if(!phone) return alert("Raqamni kiriting!");
    
    try {
        // 1. Login so'rovi
        let res = await fetch(`${API_BASE}/api/driver/login`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ phone })
        });
        let data = await res.json();
        
        // 2. Kod so'rash
        if (data.requireOtp) {
            // [YANGI] Tekshirish funksiyasi
            const verifyCallback = async (code) => {
                const r = await fetch(`${API_BASE}/api/driver/login`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ phone, code })
                });
                return await r.json();
            };
            
            data = await requestDriverOtpInput(phone, verifyCallback);
            if (!data) return;
        }
        
        if(data.success) {
            currentPhone = phone;
            localStorage.setItem('d_phone', phone);
            const loginScreen = document.getElementById('screen-login');
            if(loginScreen) {
                loginScreen.classList.remove('active');
                loginScreen.style.display = 'none';
            }
            openMap();
            loadProfile();
            if(data.activeOrder) {
                restoreActiveOrder(data.activeOrder);
            }
            initChatInterface(); // [YANGI] Chat oynasini yaratish
            requestWakeLock(); // [YANGI] Ekranni yoqiq saqlash
        } else {
            alert(data.error || "Bunday haydovchi topilmadi!");
        }
    } catch(e) { console.error("Login error:", e); }
};

function getDriverPhone() {
    let input = document.getElementById('login-phone');
    if(!input) return null;
    let val = input.value.replace(/\D/g, '');
    if(!val) val = "901234567"; // Default test uchun
    return "+998" + (val.startsWith('998') ? val.substring(3) : val);
}

// Haydovchi statusini va aktiv zakazni tekshirish
async function checkDriverStatus() {
    if(!currentPhone) return;
    try {
        const res = await fetch(`${API_BASE}/api/driver/login`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ phone: currentPhone })
        });
        const data = await res.json();
        if(data.success) {
            loadProfile();
            if(data.activeOrder) restoreActiveOrder(data.activeOrder);
            initChatInterface(); // [YANGI]
            requestWakeLock(); // [YANGI]
        }
    } catch(e) { console.error(e); }
}

async function loadProfile() {
    if(!currentPhone) return;
    try {
        // Profil va Statistika
        const res = await fetch(`${API_BASE}/api/driver/profile?phone=${encodeURIComponent(currentPhone)}`);
        let driver = await res.json();
        if(driver.error) return;

        // [YANGI] Statistikani hisoblash (Agar serverdan kelmasa)
        if (!driver.stats) {
            const today = new Date().toLocaleDateString("ru-RU").substring(0, 5); // DD.MM
            const history = driver.daromad_tarixi || [];
            driver.stats = {
                daily: history.find(h => h.sana === today)?.summa || 0,
                weekly: history.slice(-7).reduce((a, b) => a + b.summa, 0),
                monthly: history.slice(-30).reduce((a, b) => a + b.summa, 0)
            };
        }

        // Buyurtmalar Tarixi
        const resOrders = await fetch(`${API_BASE}/api/driver/orders-history?phone=${encodeURIComponent(currentPhone)}`);
        const orders = await resOrders.json();

        renderDriverDashboard(driver, orders);
    } catch(e) { console.error(e); }
}

function renderDriverDashboard(driver, orders) {
    let dashboard = document.getElementById('screen-dashboard');
    if(!dashboard) {
        dashboard = document.createElement('div');
        dashboard.id = 'screen-dashboard';
        dashboard.className = 'screen';
        document.body.appendChild(dashboard);
    }

    const fmt = (num) => (num || 0).toLocaleString() + " so'm";

    dashboard.innerHTML = `
        <div class="top-header" style="padding-bottom:10px;">
            <div class="menu-circle" onclick="openMap()"><i class="fas fa-map"></i></div>
            <div class="center-info"><h3>Kabinet</h3></div>
            <div style="width:45px"></div>
        </div>

        <div class="content-body" style="padding-top:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#f9f9f9; padding:15px; border-radius:15px;">
                <div>
                    <div style="font-size:12px; color:#888;">Balans</div>
                    <div style="font-size:20px; font-weight:800;">${fmt(driver.balans)}</div>
                    <div style="margin-top:5px; color:#10b981; font-size:13px; font-weight:600; cursor:pointer;" onclick="openPaymeModal()">
                        <i class="fas fa-plus-circle"></i> To'ldirish
                    </div>
                </div>
                <div style="text-align:right;">
                    <label class="switch">
                        <input type="checkbox" id="driver-status-switch" onchange="toggleStatus()" ${driver.status === 'online' ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                    <div id="status-text" style="font-size:12px; font-weight:600; margin-top:5px; color:${driver.status === 'online' ? '#4ADE80' : '#888'}">
                        ${driver.status === 'online' ? 'Online' : 'Offline'}
                    </div>
                </div>
            </div>

            <div class="profile-card" style="background:white; padding:20px; border-radius:20px; box-shadow:0 5px 15px rgba(0,0,0,0.05); margin-bottom:20px; text-align:center;">
                <div style="width:80px; height:80px; background:#f3f4f6; border-radius:50%; margin:0 auto 10px; display:flex; align-items:center; justify-content:center; font-size:30px; color:#ccc;">
                    <i class="fas fa-user"></i>
                </div>
                <h2 style="font-size:18px; margin-bottom:5px;">${driver.lastname} ${driver.firstname}</h2>
                <div style="color:#888; font-size:14px; margin-bottom:15px;">${driver.partner_name || 'Kompaniya'}</div>
                
                <div style="display:flex; justify-content:center; gap:10px;">
                    <div style="background:#f9f9f9; padding:8px 15px; border-radius:10px; font-size:13px;">
                        <b>${driver.marka} ${driver.model}</b><br>${driver.raqam}
                    </div>
                    <div style="background:#fff9c4; padding:8px 15px; border-radius:10px; font-size:13px; color:#b45309;">
                        ★ ${driver.reyting.toFixed(1)}
                    </div>
                </div>
            </div>

            <h3 style="font-size:16px; margin-bottom:10px;">Statistika</h3>
            <div class="stat-grid">
                <div class="stat-box">
                    <div class="stat-val" style="font-size:16px;">${fmt(driver.stats.daily)}</div>
                    <div class="stat-label">Bugun</div>
                </div>
                <div class="stat-box">
                    <div class="stat-val" style="font-size:16px;">${fmt(driver.stats.weekly)}</div>
                    <div class="stat-label">Hafta</div>
                </div>
                <div class="stat-box">
                    <div class="stat-val" style="font-size:16px;">${fmt(driver.stats.monthly)}</div>
                    <div class="stat-label">Oy</div>
                </div>
            </div>

            <!-- [YANGI] Grafik -->
            <div style="background:white; padding:15px; border-radius:20px; margin-bottom:20px; box-shadow:0 5px 15px rgba(0,0,0,0.05);">
                <h4 style="margin:0 0 15px 0; font-size:15px; color:#333;">Daromad Grafigi (7 kun)</h4>
                <canvas id="incomeChart" style="max-height: 200px;"></canvas>
            </div>

            <h3 style="font-size:16px; margin-bottom:10px; margin-top:10px;">Buyurtmalar Tarixi</h3>
            <div id="orders-history-list">
                ${orders.length === 0 ? '<div style="text-align:center; color:#999; padding:20px;">Buyurtmalar yo\'q</div>' : ''}
                ${orders.map(o => {
                    let stColor = o.status === 'finished' ? 'green' : (o.status === 'cancelled' ? 'red' : 'orange');
                    let stText = o.status === 'finished' ? 'Yakunlandi' : (o.status === 'cancelled' ? 'Bekor qilindi' : o.status);
                    return `
                    <div style="background:white; padding:15px; border-radius:15px; margin-bottom:10px; border:1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-weight:700; font-size:16px;">${o.narx}</span>
                            <span style="font-size:12px; color:${stColor}; font-weight:600;">${stText}</span>
                        </div>
                        <div style="font-size:13px; color:#555; margin-bottom:3px;"><i class="fas fa-map-marker-alt"></i> ${o.qayerdan}</div>
                        <div style="font-size:13px; color:#555;"><i class="fas fa-flag-checkered"></i> ${o.qayerga}</div>
                        <div style="text-align:right; font-size:11px; color:#999; margin-top:5px;">${new Date(o.id).toLocaleString()}</div>
                        <button onclick="viewOrderRoute('${o.id}')" style="width:100%; margin-top:10px; padding:8px; background:#e0f2f1; color:#00695c; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">🗺 Yo'lni ko'rish</button>
                    </div>
                    `;
                }).join('')}
            </div>
            
            <div style="height:80px;"></div>
        </div>
    `;

    // [YANGI] Grafikni chizish
    setTimeout(() => {
        if(typeof renderIncomeChart === 'function') renderIncomeChart(driver.daromad_tarixi);
    }, 300);
}

window.toggleStatus = function() {
    const dashSwitch = document.getElementById('driver-status-switch');
    const isOn = dashSwitch ? dashSwitch.checked : false;
    const txt = isOn ? "Online" : "Offline";
    const color = isOn ? "#4ADE80" : "#888";

    const stText = document.getElementById('status-text');
    if(stText) {
        stText.innerText = txt;
        stText.style.color = color;
    }
    
    if(isOn) socket.emit('driver_online', { phone: currentPhone });
    else socket.emit('driver_offline', { phone: currentPhone });
    
    // [YANGI] Online bo'lganda ekranni o'chirmaslik (GPS ishlashi uchun)
    if(isOn) requestWakeLock();
};

// [YANGI] Ekranni o'chirmaslik funksiyasi
async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { console.log(err); }
};

// ==============================
// XARITA VA NAVIGATSIYA
// ==============================
function openMap() {
    const dash = document.getElementById('screen-dashboard');
    if(dash) dash.classList.remove('active');
    
    document.getElementById('screen-map').classList.add('active');
    
    if(!map) {
        const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';
        map = new maplibregl.Map({
            container: 'map',
            style: styleUrl,
            center: [65.7900, 38.8410],
            zoom: 17,
            pitch: 0, // [YANGI] 2D rejim (Tepadan ko'rinish)
            bearing: 0
        });

        map.on('styleimagemissing', (e) => {
            const image = new Image(1, 1);
            image.onload = () => { if (!map.hasImage(e.id)) map.addImage(e.id, image); };
            image.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';
        });

        map.on('load', () => {
            /* [YANGI] 2D rejimda 3D binolar kerak emas, shuning uchun o'chirib qo'yamiz
            // 3D Binolar
            const sourceId = map.getSource('openmaptiles') ? 'openmaptiles' : 'openfreemap';
            if (!map.getLayer('3d-buildings') && map.getSource(sourceId)) {
                map.addLayer({
                    'id': '3d-buildings', 'source': sourceId, 'source-layer': 'building',
                    'filter': ['==', 'extrude', 'true'], 'type': 'fill-extrusion', 'minzoom': 15,
                    'paint': { 
                        'fill-extrusion-color': '#e0e0e0',
                        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['coalesce', ['get', 'height'], 0]],
                        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['coalesce', ['get', 'min_height'], 0]],
                        'fill-extrusion-opacity': 0.9 
                    }
                });
            }
            */

            const el = document.createElement('div');
            el.innerHTML = `<svg width="60" height="60" viewBox="0 0 100 100" style="filter: drop-shadow(0 5px 5px rgba(0,0,0,0.3));"><path d="M50 5 L10 85 L50 65 Z" fill="#F4D03F" stroke="white" stroke-width="2"/><path d="M50 5 L90 85 L50 65 Z" fill="#D4AC0D" stroke="white" stroke-width="2"/></svg>`;
            el.className = 'driver-marker';
            driverMarkerEl = new maplibregl.Marker({ element: el }).setLngLat([65.7900, 38.8410]).addTo(map);
        });

        // [YANGI] Gyroscope (Kompas) orqali yo'nalishni aniqlash
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (event) => {
                let heading = event.alpha;
                // iOS qurilmalari uchun
                if (event.webkitCompassHeading) {
                    heading = event.webkitCompassHeading;
                } else if (heading != null) {
                    // Android (alpha teskari bo'lishi mumkin, 360 dan ayiramiz)
                    heading = 360 - heading;
                }

                if (heading != null) {
                    deviceHeading = heading;
                    // Agar mashina to'xtab turgan bo'lsa (tezlik < 1 m/s), xaritani buramiz
                    if (map) { // [YANGI] Har doim burilsin (Mijoz talabi: telefoni qayerga qarab tursa)
                        map.easeTo({
                            bearing: deviceHeading,
                            duration: 200, // Silliq o'tish
                            easing: t => t
                        });
                    }
                }
            }, true);
        }
        
        // GPS
        if(navigator.geolocation) {
            navigator.geolocation.watchPosition(pos => {
                const {latitude, longitude, heading, speed} = pos.coords;
                // Null qiymat tekshiruvi
                if (latitude == null || longitude == null) return;
                
                currentSpeed = speed || 0; // [YANGI] Tezlikni yangilash
                const coords = [longitude, latitude];
                
                if(driverMarkerEl) driverMarkerEl.setLngLat(coords);
                
                const switchEl = document.getElementById('driver-status-switch');
                if((switchEl && switchEl.checked) || activeOrderId) { // [YANGI] Zakaz paytida ham joylashuvni yuborish
                    socket.emit('driver_location', { id: currentPhone, lat: latitude, lng: longitude });
                }
                
                // [YANGI] Bearingni aniqlash: Tezlik katta bo'lsa GPS, bo'lmasa Gyroscope
                let finalBearing = (speed > 1 && heading != null) ? heading : (deviceHeading || 0);

                map.easeTo({
                    center: coords,
                    bearing: finalBearing,
                    pitch: 0, // [YANGI] Harakatlanayotganda ham 2D saqlanadi
                    zoom: 18,
                    duration: 1000 
                });
            }, err => { console.warn(err); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }); // [YANGI] Parametrlar
        }
    }
    setTimeout(() => map.resize(), 300);
}

window.openDashboard = function() {
    if (!document.getElementById('screen-dashboard')) {
        const div = document.createElement('div');
        div.id = 'screen-dashboard';
        div.className = 'screen';
        document.body.appendChild(div);
    }
    document.getElementById('screen-map').classList.remove('active');
    document.getElementById('screen-dashboard').classList.add('active');
    loadProfile();
};

// ==============================
// BUYURTMA LOGIKASI
// ==============================

socket.on('yangi_buyurtma', (order) => {
    pendingOrder = order;
    
    document.getElementById('req-address').innerText = order.qayerdan;
    document.getElementById('req-info').innerText = "Yangi Buyurtma";
    document.getElementById('panel-request').classList.remove('hidden-panel');
    
    addOrderToList(order);
    playNotificationSound();
    
    if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
    requestWakeLock(); // [YANGI] Yangi buyurtma kelganda ekranni yoqish
});

function acceptOrderById(orderId) {
    if(!orderId) return;
    
    // Xonaga ulanish
    socket.emit('join_chat', orderId);

    socket.emit('driver_accept_order', { 
        orderId: orderId, 
        phone: currentPhone,
        driverName: "Haydovchi" 
    });
    document.getElementById('panel-request').classList.add('hidden-panel');
    toggleOrdersList(false);
}

// [YANGI] Internet uzilib qolsa yoki ilova qayta ochilsa qayta ulanish
socket.on('connect', () => {
    if(currentPhone) {
        // Serverga qaytadan online ekanligini bildirish
        socket.emit('driver_online', { phone: currentPhone });
        // Agar aktiv zakaz bo'lsa, xonaga qayta kirish
        if(activeOrderId) socket.emit('join_chat', activeOrderId);
    }
});

socket.on('order_accepted_success', (order) => {
    currentOrder = order;
    activeOrderId = order.id;
    tripStatus = 'yetib_keldi';
    injectChatButton(); // [YANGI] Chat tugmasini qo'shish
    
    const panel = document.getElementById('panel-active');
    if(panel) {
        panel.classList.remove('hidden-panel');
        const addrEl = document.getElementById('act-address');
        if(addrEl) addrEl.innerText = "Mijoz: " + order.qayerdan;
        
        if(typeof resetActiveSlider === 'function') resetActiveSlider("YETIB KELDIM", "state-yellow", nextStatus);
    }
    requestWakeLock(); // [YANGI]
    
    if(driverMarkerEl) {
        const dPos = driverMarkerEl.getLngLat();
        drawRoute(dPos.lat, dPos.lng, order.fromLat, order.fromLng, [], true); // [YANGI] Navigatsiya bor
    }
});

// Aktiv buyurtmani qayta tiklash
function restoreActiveOrder(order) {
    currentOrder = order;
    activeOrderId = order.id;
    injectChatButton(); // [YANGI]
    
    // Qayta kirganda serverdagi xonaga (room) ulanish
    if (socket) {
        socket.emit('join_chat', order.id);
    }

    const panel = document.getElementById('panel-active');
    if(panel) {
        document.getElementById('panel-request').classList.add('hidden-panel');
        panel.classList.remove('hidden-panel');
        const addrEl = document.getElementById('act-address');
        if(addrEl) addrEl.innerText = (order.status === 'started') ? ("Manzil: " + order.qayerga) : ("Mijoz: " + order.qayerdan);
        
        if(typeof resetActiveSlider === 'function') {
            if(order.status === 'accepted') {
                tripStatus = 'yetib_keldi';
                resetActiveSlider("YETIB KELDIM", "state-yellow", nextStatus);
            } else if(order.status === 'arrived') {
                tripStatus = 'boshlash';
                resetActiveSlider("BOSHLASH", "state-blue", nextStatus);
                // [YANGI] Agar serverda vaqt bo'lsa, o'shandan davom ettiramiz
                if (order.arrived_time) startWaitingTimer(order.arrived_time);
                else startWaitingTimer(new Date()); // Fallback
            } else if(order.status === 'started') {
                tripStatus = 'yakunlash';
                resetActiveSlider("YAKUNLASH", "state-red", nextStatus);
            }
        }
    }
    requestWakeLock(); // [YANGI]
    socket.emit('driver_online', { phone: currentPhone });
}

window.nextStatus = function() {
    if(!currentOrder) return;
    
    if(tripStatus === 'yetib_keldi') {
        socket.emit('driver_update_status', { orderId: currentOrder.id, status: 'arrived' });
        tripStatus = 'boshlash';
        
        if(typeof resetActiveSlider === 'function') resetActiveSlider("BOSHLASH", "state-blue", nextStatus);
        startWaitingTimer(new Date()); // [YANGI] Taymerni boshlash
        
        if (map && map.getSource('route')) {
            map.getSource('route').setData({type: 'FeatureCollection', features: []});
        }
    } 
    else if(tripStatus === 'boshlash') {
        socket.emit('driver_update_status', { orderId: currentOrder.id, status: 'started' });
        tripStatus = 'yakunlash';
        stopWaitingTimer(); // [YANGI] Taymerni to'xtatish
        if(document.getElementById('act-address')) document.getElementById('act-address').innerText = "Manzil: " + currentOrder.qayerga;
        if(typeof resetActiveSlider === 'function') resetActiveSlider("YAKUNLASH", "state-red", nextStatus);
        
        if (driverMarkerEl) {
            const dPos = driverMarkerEl.getLngLat();
            drawRoute(dPos.lat, dPos.lng, currentOrder.toLat, currentOrder.toLng, currentOrder.stops, true); // [YANGI] Navigatsiya bor
        } else {
            drawRoute(currentOrder.fromLat, currentOrder.fromLng, currentOrder.toLat, currentOrder.toLng, currentOrder.stops, true); // [YANGI] Navigatsiya bor
        }
    }
    else if(tripStatus === 'yakunlash') {
        socket.emit('driver_update_status', { orderId: currentOrder.id, status: 'finished' });
        
        let finalPrice = currentOrder.narx || "Kelishilgan";
        alert("Sayohat tugadi!\nTo'lov summasi: " + finalPrice);

        if(document.getElementById('panel-active')) document.getElementById('panel-active').classList.add('hidden-panel');
        currentOrder = null;
        activeOrderId = null;
        tripStatus = 'yetib_keldi';
        
        if (map && map.getSource('route')) {
            map.getSource('route').setData({type: 'FeatureCollection', features: []});
        }
        stopWaitingTimer();
        stopMarkers.forEach(m => m.remove());
        stopMarkers = [];
        
        goOnline();
        loadProfile();
        stopNavigation(); // [YANGI]
    }
};

window.cancelActiveOrder = function() { 
    if(confirm("Haqiqatan ham bekor qilasizmi?")) {
        socket.emit('driver_update_status', { orderId: activeOrderId, status: 'cancelled' });
        alert("Buyurtma bekor qilindi!");

        document.getElementById('panel-active').classList.add('hidden-panel');
        currentOrder = null;
        activeOrderId = null;
        tripStatus = 'yetib_keldi';
        stopWaitingTimer();
        
        if (map && map.getLayer('route')) map.removeLayer('route');
        if (map && map.getSource('route')) map.removeSource('route');
        
        goOnline();
        loadProfile();
    } 
};

socket.on('order_cancelled', (orderId) => {
    if ((currentOrder && String(currentOrder.id) === String(orderId)) || (activeOrderId && String(activeOrderId) === String(orderId))) {
        try { playNotificationSound(); } catch(e){}
        
        if(document.getElementById('panel-active')) document.getElementById('panel-active').classList.add('hidden-panel');
        if(document.getElementById('panel-request')) document.getElementById('panel-request').classList.add('hidden-panel');

        currentOrder = null;
        activeOrderId = null;
        tripStatus = 'yetib_keldi';
        stopWaitingTimer();
        
        if (map && map.getLayer('route')) map.removeLayer('route');
        if (map && map.getSource('route')) map.removeSource('route');

        stopMarkers.forEach(m => m.remove());
        stopMarkers = [];
        
        goOnline();
        loadProfile();
        
        // [TUZATISH] Alertni ozgina kechiktiramiz, shunda UI yangilanib ulguradi
        setTimeout(() => alert("Mijoz buyurtmani bekor qildi."), 100);
        stopNavigation(); // [YANGI]
    }
});

// [YANGI] Admin xabarini qabul qilish
socket.on('admin_message', (msg) => {
    playNotificationSound();
    alert("📢 ADMIN XABARI:\n\n" + msg);
});

socket.on('remove_order', (orderId) => {
    if (pendingOrder && String(pendingOrder.id) === String(orderId)) {
        document.getElementById('panel-request').classList.add('hidden-panel');
        pendingOrder = null;
        alert("Buyurtma bekor qilindi yoki boshqa haydovchi oldi!");
        renderOrdersList(); 
    }
    availableOrders = availableOrders.filter(o => o.id !== orderId);
    renderOrdersList();
});

async function drawRoute(lat1, lng1, lat2, lng2, stops = [], startNav = false) {
    if(!map) return;
    // Null tekshiruvi
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return;

    stopMarkers.forEach(m => m.remove());
    stopMarkers = [];

    let waypoints = `${lng1},${lat1}`;

    if (stops && Array.isArray(stops)) {
        stops.forEach(stop => {
            if (stop.lat && stop.lng) {
                waypoints += `;${stop.lng},${stop.lat}`;
                
                const el = document.createElement('div');
                el.style.width = '15px'; el.style.height = '15px';
                el.style.backgroundColor = 'black'; el.style.borderRadius = '50%';
                el.style.border = '2px solid white';
                
                const sm = new maplibregl.Marker({ element: el })
                    .setLngLat([stop.lng, stop.lat])
                    .addTo(map);
                stopMarkers.push(sm);
            }
        });
    }

    waypoints += `;${lng2},${lat2}`;

    const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=true`; // [YANGI] steps=true
    try {
        const res = await fetch(url);
        const data = await res.json();
        if(data.routes && data.routes.length > 0) {
            const routeGeoJSON = data.routes[0].geometry;
            
            if (map.getSource('route')) {
                map.getSource('route').setData(routeGeoJSON);
            } else {
                map.addSource('route', {
                    'type': 'geojson',
                    'data': routeGeoJSON
                });
                map.addLayer({
                    'id': 'route',
                    'type': 'line',
                    'source': 'route',
                    'layout': { 'line-join': 'round', 'line-cap': 'round' },
                    'paint': {
                        'line-color': '#007AFF', 
                        'line-width': 8,
                        'line-opacity': 0.8
                    }
                });
            }

            const coordinates = routeGeoJSON.coordinates;
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

            map.fitBounds(bounds, { padding: 80 });

            // [YANGI] Navigatsiyani boshlash
            if (startNav && data.routes[0].legs && data.routes[0].legs.length > 0) {
                // 1 soniya kutib keyin boshlaymiz (Avvalgi gap tugashi uchun)
                setTimeout(() => startNavigation(data.routes[0].legs[0].steps), 1000);
            }
        }
    } catch(e) { console.error("Marshrut xatosi:", e); }
}

socket.on('active_orders_list', (orders) => {
    availableOrders = orders;
    renderOrdersList();
});

function addOrderToList(order) {
    if(!availableOrders.find(o => o.id === order.id)) {
        availableOrders.push(order);
        renderOrdersList();
    }
}

function renderOrdersList() {
    const panel = document.getElementById('orders-list-panel');
    const countBadge = document.getElementById('orders-count');
    
    if(countBadge) {
        countBadge.innerText = availableOrders.length;
        countBadge.style.display = availableOrders.length > 0 ? 'inline-block' : 'none';
    }

    if(!panel) return;

    if(availableOrders.length === 0) {
        panel.innerHTML = '<div style="text-align:center; color:#888; padding:10px;">Hozircha zakazlar yo\'q</div>';
        return;
    }

    panel.innerHTML = '';
    availableOrders.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-card';
        div.innerHTML = `
            <h4>${order.qayerdan} ➝ ${order.qayerga}</h4>
            <p>Narx: <b>${order.narx}</b> | Masofa: ~${order.masofa || '?'} km</p>
            <button class="btn-accept" onclick="acceptOrderById(${order.id})">Qabul qilish</button>
        `;
        panel.appendChild(div);
    });
}

function toggleOrdersList(forceState) {
    const panel = document.getElementById('orders-list-panel');
    if(!panel) return;
    if (typeof forceState === 'boolean') {
        panel.style.display = forceState ? 'block' : 'none';
    } else {
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    }
}

window.toggleNightMode = function() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('driver_dark_mode', isDark);
    
    const chk = document.getElementById('toggle-night');
    if(chk) chk.checked = isDark;
};

window.openSettings = function() {
    document.getElementById('modal-settings').classList.remove('hidden-panel');
    const chk = document.getElementById('toggle-night');
    if(chk) chk.checked = document.body.classList.contains('dark-mode');
};

window.closeModal = function(id) {
    document.getElementById(id).classList.add('hidden-panel');
};

if(localStorage.getItem('driver_dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
}

socket.on('heatmap_update', (zones) => {
    if (!map) return;
    drawDriverHeatmap(zones);
});

function drawDriverHeatmap(zones) {
    if (!map.getSource('heat_zones')) {
        map.addSource('heat_zones', {
            'type': 'geojson',
            'data': { 'type': 'FeatureCollection', 'features': [] }
        });
        
        map.addLayer({
            'id': 'heat_zones_layer',
            'type': 'fill',
            'source': 'heat_zones',
            'paint': {
                'fill-color': '#ff0000',
                'fill-opacity': 0.4
            }
        });
    }

    if (map.getLayer('heat_zones_layer')) map.removeLayer('heat_zones_layer');
    if (map.getSource('heat_zones')) map.removeSource('heat_zones');

    zones.forEach(z => {
        const id = 'heat_zone_' + z.id;
        if (map.getSource(id)) {
            map.getSource(id).setData({ type: 'Point', coordinates: [z.lng, z.lat] });
        } else {
            const el = document.createElement('div');
            el.className = 'heat-marker';
            el.style.width = (z.radius / 5) + 'px'; 
            el.style.height = (z.radius / 5) + 'px';
            el.style.background = 'rgba(255, 0, 0, 0.3)';
            el.style.borderRadius = '50%';
            el.style.boxShadow = '0 0 20px rgba(255,0,0,0.5)';
            
            new maplibregl.Marker({ element: el })
                .setLngLat([z.lng, z.lat])
                .addTo(map);
        }
    });
}

// [YANGI] Daromad grafigini chizish funksiyasi
function renderIncomeChart(history) {
    if (!history) history = [];
    
    // Chart.js kutubxonasini yuklash (agar yo'q bo'lsa)
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => renderIncomeChart(history);
        document.head.appendChild(script);
        return;
    }

    const ctx = document.getElementById('incomeChart');
    if (!ctx) return;

    // Oxirgi 7 kunni olish
    const data = history.slice(-7);
    const labels = data.map(d => d.sana);
    const values = data.map(d => d.summa);

    // Agar eski chart bo'lsa yo'q qilish
    if (window.driverIncomeChart instanceof Chart) {
        window.driverIncomeChart.destroy();
    }

    window.driverIncomeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: "Daromad (so'm)",
                data: values,
                backgroundColor: '#FFD600',
                borderRadius: 6,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) { console.error("Audio error", e); }
}

window.goOnline = function() { 
    document.getElementById('panel-offline').classList.add('hidden-panel'); 
    socket.emit('driver_online', { phone: currentPhone }); 
    alert("Siz liniyadasiz! Buyurtma kuting..."); 
};
window.toggleOfflineMode = function() { 
    if(currentOrder) { alert("Avval aktiv zakazni tugating!"); return; } 
    document.getElementById('panel-offline').classList.remove('hidden-panel'); 
    socket.emit('driver_offline', { phone: currentPhone }); 
};
window.resetCamera = function() { 
    if(map) map.easeTo({ pitch: 0, bearing: 0, zoom: 17 }); 
};
// window.openHistory = openHistory; // [TUZATISH] Bu qator xato berayotgan edi (funksiya yo'q). O'chiramiz.
window.closeDashboard = function() {
    const dash = document.getElementById('screen-dashboard');
    if(dash) dash.classList.remove('active');
    document.getElementById('screen-map').classList.add('active');
};

document.addEventListener("DOMContentLoaded", () => {
    let profileBtn = document.querySelector('#screen-map .menu-circle i.fa-user');
    if (profileBtn) {
        profileBtn = profileBtn.closest('.menu-circle');
    } else {
        profileBtn = document.querySelector('#screen-map .menu-circle');
    }

    if(profileBtn) {
        profileBtn.removeAttribute('onclick');
        profileBtn.onclick = function(e) {
            e.preventDefault();
            openDashboard();
        };
    }
});

// [YANGI] Ilova ochilganda darhol login ekranini yashirish (Agar oldin kirgan bo'lsa)
if(localStorage.getItem('d_phone')) {
    const loginScreen = document.getElementById('screen-login');
    if(loginScreen) loginScreen.style.display = 'none';
}

// ==============================
// [YANGI] CHAT TIZIMI (HAYDOVCHI UCHUN)
// ==============================

function initChatInterface() {
    if (document.getElementById('driver-chat-modal')) return;

    const chatHtml = `
    <div id="driver-chat-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:3000; justify-content:center; align-items:center;">
        <div style="width:90%; height:70%; background:white; border-radius:15px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 5px 20px rgba(0,0,0,0.3);">
            <div style="padding:15px; background:#FFD600; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                <span>Mijoz bilan chat</span>
                <i class="fas fa-times" style="font-size:20px; cursor:pointer;" onclick="toggleDriverChat()"></i>
            </div>
            <div id="driver-chat-messages" style="flex:1; padding:15px; overflow-y:auto; background:#f3f4f6; display:flex; flex-direction:column; gap:10px;"></div>
            <div style="padding:10px; background:white; border-top:1px solid #eee; display:flex; gap:10px;">
                <input type="text" id="driver-chat-input" placeholder="Xabar yozing..." style="flex:1; padding:12px; border:1px solid #ddd; border-radius:20px; outline:none;">
                <button onclick="sendDriverMessage()" style="width:45px; height:45px; background:#FFD600; border:none; border-radius:50%; cursor:pointer;"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', chatHtml);
}

function injectChatButton() {
    // Agar tugma allaqachon bo'lsa, qayta qo'shmaymiz
    if (document.getElementById('btn-open-chat')) return;

    const panel = document.getElementById('panel-active');
    if (panel) {
        // Tugmani panel ichiga joylaymiz (masalan, manzil tagiga)
        const btn = document.createElement('button');
        btn.id = 'btn-open-chat';
        btn.innerHTML = '<i class="fas fa-comment-dots"></i> Chat';
        btn.style.cssText = "margin-top:10px; width:100%; padding:12px; background:#3b82f6; color:white; border:none; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer;";
        btn.onclick = toggleDriverChat;
        
        // [YANGI] Tashqi Navigator tugmasi
        const navBtn = document.createElement('button');
        navBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Google Maps';
        navBtn.style.cssText = "margin-top:10px; width:100%; padding:12px; background:#fff; color:#333; border:1px solid #ddd; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer; margin-bottom: 10px;";
        navBtn.onclick = function() {
            if(currentOrder && currentOrder.toLat && currentOrder.toLng) {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentOrder.toLat},${currentOrder.toLng}`, '_blank');
            } else {
                alert("Manzil koordinatalari yo'q");
            }
        };

        // Panelning tugmalar qismidan oldin qo'shamiz
        const slider = panel.querySelector('#slider-container');
        if(slider) {
            panel.insertBefore(navBtn, slider);
            panel.insertBefore(btn, slider);
        } else {
            panel.appendChild(navBtn);
            panel.appendChild(btn);
        }
    }
}

window.toggleDriverChat = function() {
    const modal = document.getElementById('driver-chat-modal');
    if (!modal) return;
    
    isChatOpen = !isChatOpen;
    modal.style.display = isChatOpen ? 'flex' : 'none';
    
    // Chat ochilganda yangi xabar indikatorini o'chirish (agar bo'lsa)
    const btn = document.getElementById('btn-open-chat');
    if(btn) btn.style.background = '#3b82f6';
};

window.sendDriverMessage = function() {
    const input = document.getElementById('driver-chat-input');
    const text = input.value.trim();
    if (!text || !activeOrderId) return;

    // Ekranga chiqarish
    const msgBox = document.getElementById('driver-chat-messages');
    msgBox.innerHTML += `<div style="align-self:flex-end; background:#FFD600; padding:8px 12px; border-radius:12px 12px 0 12px; max-width:80%; margin-bottom:5px;">${text}</div>`;
    msgBox.scrollTop = msgBox.scrollHeight;

    // Serverga yuborish
    socket.emit('send_message', { orderId: activeOrderId, text: text, sender: 'driver' });
    input.value = '';
};

// Xabar kelganda
socket.on('receive_message', (data) => {
    // Agar xabar haydovchidan bo'lsa (o'zimizdan), qayta chiqarmaymiz
    if (data.sender === 'driver') return;

    const msgBox = document.getElementById('driver-chat-messages');
    if (msgBox) {
        msgBox.innerHTML += `<div style="align-self:flex-start; background:white; border:1px solid #ddd; padding:8px 12px; border-radius:12px 12px 12px 0; max-width:80%; margin-bottom:5px;">${data.text}</div>`;
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    // Agar chat yopiq bo'lsa, tugma rangini o'zgartiramiz va ovoz chiqaramiz
    if (!isChatOpen) {
        const btn = document.getElementById('btn-open-chat');
        if(btn) btn.style.background = '#ef4444'; // Qizil rang
        playNotificationSound();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
});


// --- INIT (ENG OXIRIDA) ---
if(currentPhone) {
    checkDriverStatus(); // Status va aktiv zakazni tekshirish
    const loginScreen = document.getElementById('screen-login');
    if(loginScreen) {
        loginScreen.classList.remove('active');
        loginScreen.style.display = 'none';
    }
    openMap();
}

// ==============================
// OVOZLI NAVIGATSIYA TIZIMI
// ==============================

function startNavigation(steps) {
    navSteps = steps;
    currentStepIndex = 0;
    isNavigating = true;
    lastSpokenIndex = -1;
    
    // Birinchi qadamni gapirish
    if (navSteps.length > 0) {
        announceStep(0); // Birinchi instruktsiya (Masalan: "Harakatni boshlang")
    }
}

function stopNavigation() {
    isNavigating = false;
    navSteps = [];
    currentStepIndex = 0;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function updateNavigation(lat, lng) {
    if (!navSteps[currentStepIndex]) return;

    // Keyingi manevr nuqtasi
    let nextStep = navSteps[currentStepIndex + 1];
    if (!nextStep) return; 

    const targetLat = nextStep.maneuver.location[1];
    const targetLng = nextStep.maneuver.location[0];
    
    const dist = getDistMeters(lat, lng, targetLat, targetLng);

    // Agar manevrga 40 metrdan kam qolsa, keyingi qadamni gapiramiz
    if (dist < 40) {
        currentStepIndex++;
        announceStep(currentStepIndex);
    }
}

function announceStep(index) {
    if (index === lastSpokenIndex) return;
    lastSpokenIndex = index;

    const step = navSteps[index];
    const type = step.maneuver.type;
    const modifier = step.maneuver.modifier;
    const dist = Math.round(step.distance);
    
    let text = "";

    if (type === 'depart') text = `Harakatni boshlang. ${dist} metr to'g'riga.`;
    else if (type === 'arrive') { text = "Manzilga yetib keldingiz."; stopNavigation(); }
    else if (type === 'turn') {
        if (modifier && modifier.includes('left')) text = "Chapga buriling.";
        else if (modifier && modifier.includes('right')) text = "O'ngga buriling.";
        if (dist > 0) text += ` Keyin ${dist} metr to'g'riga.`;
    } else {
        text = `To'g'riga ${dist} metr.`;
    }

    speak(text);
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1; // Sal tezroq gapirish
        // utterance.lang = 'uz-UZ'; // Agar qurilmada o'zbek tili bo'lsa
        window.speechSynthesis.speak(utterance);
    }
}

function getDistMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// [YANGI] SMS Kod kiritish oynasi (Haydovchi uchun)
function injectDriverOtpModal() {
    if (document.getElementById('driver-otp-modal')) return;
    const html = `
    <div id="driver-otp-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:#1f2937; color:white; padding:25px; border-radius:20px; width:85%; max-width:320px; text-align:center; border:1px solid #374151; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <div style="width:60px; height:60px; background:#374151; border-radius:50%; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; font-size:24px; color:#FFD600;">
                <i class="fas fa-shield-alt"></i>
            </div>
            <h3 style="margin:0 0 10px 0; color:#FFD600;">Xavfsizlik</h3>
            <p id="d-otp-phone" style="color:#9ca3af; font-size:14px; margin-bottom:20px;">SMS kodni kiriting</p>
            <input type="tel" id="driver-otp-input" maxlength="4" placeholder="0000" style="width:100%; padding:15px; font-size:24px; text-align:center; border:2px solid #4b5563; background:#111827; color:white; border-radius:12px; margin-bottom:20px; outline:none; font-weight:bold; letter-spacing:5px;">
            <button id="btn-driver-verify-otp" style="width:100%; padding:14px; background:#FFD600; color:black; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer;">Kirish</button>
            <div style="margin-top:15px; font-size:13px; color:#6b7280; cursor:pointer;" onclick="location.reload()">Bekor qilish</div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function requestDriverOtpInput(phone, verifyCallback) {
    return new Promise((resolve) => {
        injectDriverOtpModal();
        const modal = document.getElementById('driver-otp-modal');
        const input = document.getElementById('driver-otp-input');
        const btn = document.getElementById('btn-driver-verify-otp');
        const phoneDisplay = document.getElementById('d-otp-phone');
        
        if(phoneDisplay) {
            phoneDisplay.innerText = `${phone} raqamiga kod yuborildi`;
            phoneDisplay.style.color = '#9ca3af';
        }
        
        modal.style.display = 'flex';
        input.value = ''; 
        input.style.borderColor = '#4b5563';
        input.focus();
        
        const onSubmit = async () => {
            const code = input.value;
            if(code.length >= 4) { 
                const oldText = btn.innerText;
                btn.innerText = "...";
                btn.disabled = true;
                try {
                    const res = await verifyCallback(code);
                    if(res.success) {
                        modal.style.display = 'none';
                        resolve(res);
                    } else {
                        input.style.borderColor = 'red';
                        input.value = '';
                        if(phoneDisplay) {
                            phoneDisplay.innerText = res.error || "Kod noto'g'ri!";
                            phoneDisplay.style.color = 'red';
                        }
                        input.focus();
                    }
                } catch(e) { alert("Xatolik"); }
                finally { btn.innerText = oldText; btn.disabled = false; }
            }
            else { input.style.borderColor = 'red'; }
        };
        
        input.onkeyup = (e) => { 
            input.style.borderColor = '#4b5563';
            if(e.key === 'Enter') onSubmit(); 
        };
        btn.onclick = onSubmit;
    });
}

// [YANGI] Payme orqali hisob to'ldirish
window.openPaymeModal = function() {
    if (document.getElementById('payme-modal')) return;
    const html = `
    <div id="payme-modal" style="display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:20px; width:85%; max-width:320px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <div style="width:60px; height:60px; background:#e0f2f1; border-radius:50%; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; font-size:24px; color:#00CCCC;">
                <i class="fas fa-wallet"></i>
            </div>
            <h3 style="margin:0 0 10px 0;">Hisobni to'ldirish</h3>
            <p style="color:#666; font-size:14px; margin-bottom:20px;">Payme orqali onlayn to'lov</p>
            <input type="number" id="payme-amount" placeholder="Summa (so'm)" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:10px; margin-bottom:15px; font-size:18px; text-align:center; outline:none;">
            <button onclick="processPaymePayment()" style="width:100%; padding:12px; background:#00CCCC; color:white; border:none; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer;">To'lash</button>
            <div style="margin-top:15px; font-size:13px; color:#999; cursor:pointer;" onclick="document.getElementById('payme-modal').remove()">Bekor qilish</div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('payme-amount').focus(), 100);
};

window.processPaymePayment = function() {
    const amount = document.getElementById('payme-amount').value;
    if(!amount || amount < 1000) return alert("Minimal summa 1000 so'm");
    
    // Payme URL generatsiyasi
    // DIQQAT: Bu yerda o'zingizning Merchant ID raqamingizni yozishingiz kerak
    const merchantId = "YOUR_MERCHANT_ID"; 
    const driverId = currentPhone.replace(/\D/g, ''); // Faqat raqamlar
    const amountTiyin = amount * 100;
    
    // Payme Checkout URL formati: m=MERCHANT_ID;ac.driver_id=ID;a=AMOUNT
    const params = `m=${merchantId};ac.driver_id=${driverId};a=${amountTiyin}`;
    const encoded = btoa(params);
    const url = `https://checkout.paycom.uz/${encoded}`;
    
    // Haqiqiy loyihada quyidagi qatorni ochib qo'yasiz:
    window.open(url, '_blank');
    document.getElementById('payme-modal').remove();
};

// [YANGI] Buyurtma yo'lini ko'rish funksiyasi
window.viewOrderRoute = async function(orderId) {
    // Modalni yaratish
    if (!document.getElementById('route-view-modal')) {
        const html = `
        <div id="route-view-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:4000; flex-direction:column;">
            <div style="padding:15px; background:#fff; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.1); z-index:10;">
                <h3 style="margin:0; font-size:16px;">Sayohat Hisoboti</h3>
                <button onclick="document.getElementById('route-view-modal').style.display='none'" style="background:none; border:none; font-size:24px;">&times;</button>
            </div>
            <div id="route-map" style="flex:1; width:100%;"></div>
            <div id="route-stats" style="padding:15px; background:#f9f9f9; border-top:1px solid #eee; max-height:30%; overflow-y:auto;">
                Yuklanmoqda...
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
    
    const modal = document.getElementById('route-view-modal');
    modal.style.display = 'flex';
    document.getElementById('route-stats').innerHTML = 'Yuklanmoqda...';

    // Xaritani ishga tushirish
    let routeMap;
    if (!window.routeViewMap) {
        window.routeViewMap = L.map('route-map').setView([38.8410, 65.7900], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(window.routeViewMap);
    }
    routeMap = window.routeViewMap;
    
    // Eski chiziqlarni tozalash
    routeMap.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer instanceof L.Marker) routeMap.removeLayer(layer);
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(routeMap); // Tile qayta qo'shish

    try {
        const res = await fetch(`${API_BASE}/api/driver/order-route/${orderId}`);
        const data = await res.json();

        if (data.error) {
            document.getElementById('route-stats').innerHTML = `<div style="color:red; text-align:center;">${data.error}</div>`;
            return;
        }

        // Chiziqlarni chizish
        const pickupLatLngs = data.pickup.map(l => [l.lat, l.lng]);
        const tripLatLngs = data.trip.map(l => [l.lat, l.lng]);

        if (pickupLatLngs.length > 0) {
            L.polyline(pickupLatLngs, { color: 'blue', weight: 4, dashArray: '10, 10' }).addTo(routeMap); // Pickup - ko'k uzuq chiziq
        }
        if (tripLatLngs.length > 0) {
            L.polyline(tripLatLngs, { color: 'green', weight: 5 }).addTo(routeMap); // Trip - yashil qalin
            routeMap.fitBounds(L.polyline(tripLatLngs).getBounds(), { padding: [50, 50] });
        } else if (pickupLatLngs.length > 0) {
            routeMap.fitBounds(L.polyline(pickupLatLngs).getBounds(), { padding: [50, 50] });
        }

        // To'xtash joylarini belgilash
        const addStops = (stops, color) => {
            stops.forEach(s => {
                L.marker([s.lat, s.lng], {
                    icon: L.divIcon({
                        className: 'stop-icon',
                        html: `<div style="background:${color}; color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);">P</div>`
                    })
                }).addTo(routeMap).bindPopup(`To'xtash: ${s.duration} daqiqa<br>Vaqt: ${s.time}`);
            });
        };
        addStops(data.stats.pickup.stops, 'blue');
        addStops(data.stats.trip.stops, 'red');

        // Statistikani chiqarish
        document.getElementById('route-stats').innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                <div style="background:white; padding:10px; border-radius:10px; border-left:4px solid blue;">
                    <div style="font-size:12px; color:#666;">Mijozgacha</div>
                    <div style="font-weight:bold;">${data.stats.pickup.dist} km</div>
                    <div style="font-size:11px;">To'xtashlar: ${data.stats.pickup.stops.length} ta</div>
                </div>
                <div style="background:white; padding:10px; border-radius:10px; border-left:4px solid green;">
                    <div style="font-size:12px; color:#666;">Mijoz bilan</div>
                    <div style="font-weight:bold;">${data.stats.trip.dist} km</div>
                    <div style="font-size:11px;">To'xtashlar: ${data.stats.trip.stops.length} ta</div>
                </div>
            </div>
            <div style="font-size:12px; color:#888; text-align:center;">
                <span style="color:blue">---</span> Mijozgacha &nbsp;&nbsp; <span style="color:green">━━━</span> Sayohat
            </div>
        `;
        setTimeout(() => routeMap.invalidateSize(), 300);

    } catch (e) { console.error(e); alert("Xatolik yuz berdi"); }
};
