// client/script.js

// ==========================================
// 0. GLOBAL O'ZGARUVCHILAR
// ==========================================
var socket = io();
var API_BASE = ''; 
var map = null; 
var currentTariff = 'Start';
var currentUserPhone = localStorage.getItem('client_phone') || null;
var currentLang = localStorage.getItem('client_lang') || 'uz'; // [YANGI] Til

// Dinamik narx va Regionlar
var surgeMultiplier = 1.0; 
var surgeActive = false;
var globalServices = [];
var activeTariff = null;
var activeRegion = null;
var selectedPaymentMethod = 'naqd'; 
var selectedOptions = { ac: false, luggage: false };
var activePromo = null; // [YANGI] Aktiv promokod

// Markerlar
var driversOnMap = {};          
var userMarker = null;          
var destinationMarker = null;   
var stopMarkers = [];           
var driverMarker = null;        

// Yo'l va Status
var routeLayer = null; 
var driverRouteLayer = null; // [YANGI] Haydovchi kelish yo'li uchun
var searchTimerInterval; 
var isPinFixed = false;         
var isPickingDestination = false; // [YANGI] Manzil tanlash rejimi
var destinationSelectionMarker = null; // [YANGI] Manzil tanlash markeri
var currentOrderId = null;      

// --- 1. IKONKALARNI KICHRAYTIRISH (TUZATILDI) ---

// Taksi Ikonkasi (Kichraytirildi: 35x35)
var carIcon = L.divIcon({
    className: 'car-icon-wrapper',
    html: '<img src="img/car_1.png" class="car-img-anim" style="width:100%; height:100%; object-fit: contain;">',
    iconSize: [35, 35], // 50 edi -> 35 qilindi
    iconAnchor: [17, 17]    
});

// Start (Mijoz) Ikonkasi (Kichraytirildi: 40x40)
function getStartIcon() {
    return L.divIcon({
        className: 'my-custom-pin',
        html: `<img src="img/pin.png" style="width:100%; height:100%; object-fit:contain; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.3));">`,
        iconSize: [50, 50],
        iconAnchor: [25, 50], 
    });
}

// [YANGI] Manzil tanlash uchun (Finish) ikonka
function getFinishIcon() {
    return L.divIcon({
        className: 'my-custom-pin-finish',
        // Finish uchun ham o'sha pin.png ishlatiladi, lekin rangi sal boshqacha (hue-rotate) bo'lishi mumkin yoki o'zi qoladi
        html: `<img src="img/pin.png" style="width:100%; height:100%; object-fit:contain; filter: hue-rotate(200deg) drop-shadow(0 5px 5px rgba(0,0,0,0.3));">`,
        iconSize: [50, 50],
        iconAnchor: [25, 50], // Uchi markazda
    });
}


// ==========================================
// 2. EKRANLAR VA LOGIN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    if (currentUserPhone) {
        document.getElementById('screen-login').classList.remove('active');
        document.getElementById('screen-login').style.display = 'none'; // To'liq yashirish
        document.getElementById('screen-home').classList.add('active');
        loadSavedAddresses();
        loadSettings();
        loadSystemData();
        loadMyAddresses(); // [YANGI]
        loadFavorites(); // [YANGI]
    } else {
        loadSavedAddresses();
    }
});

async function goToHome() {
    var phoneInput = document.getElementById('phone-number');
    if (!phoneInput) { alert("Xato: Input topilmadi!"); return; }

    var rawVal = phoneInput.value;
    var cleanNum = rawVal.replace(/\D/g, ''); 

    if (cleanNum.length === 12 && cleanNum.startsWith('998')) cleanNum = cleanNum.substring(3);
    if (cleanNum.length !== 9) { alert("Raqam noto'g'ri!"); return; }

    const fullPhone = "+998" + cleanNum;
    currentUserPhone = fullPhone;
    localStorage.setItem('client_phone', fullPhone);

    try {
        // 1. Login so'rovi (Kod so'rash)
        let res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: fullPhone })
        });
        let data = await res.json();

        // 2. Agar kod kerak bo'lsa
        if (data.requireOtp) {
            // [YANGI] Tekshirish funksiyasini yuboramiz
            const verifyCallback = async (code) => {
                const r = await fetch(`${API_BASE}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: fullPhone, code: code })
                });
                return await r.json();
            };
            
            data = await requestOtpInput(fullPhone, verifyCallback);
            if (!data) return;
        }

        if (data.success) {
            document.getElementById('screen-login').classList.remove('active');
            document.getElementById('screen-home').classList.add('active');
            loadSettings();
            loadSystemData();
            loadMyAddresses();
            loadFavorites();
        } else {
            alert(data.error || "Xatolik yuz berdi");
        }
    } catch (error) { console.error("Login xatosi:", error); alert("Server xatosi"); }
}

function goToMap(locationName) {
    if (locationName) document.getElementById('input-to').value = locationName;
    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-map').classList.add('active');

    setTimeout(() => {
        initMap();
        if (map) map.invalidateSize();
    }, 300);
}

function goBackToHome() {
    document.getElementById('screen-map').classList.remove('active');
    document.getElementById('screen-home').classList.add('active');
    
    // [YANGI] Agar aktiv zakaz bo'lsa, uni saqlab qolamiz
    if (currentOrderId) {
        const banner = document.getElementById('active-order-banner');
        if(banner) {
            banner.style.display = 'flex';
            const statusText = document.querySelector('#active-order-banner span');
            if(statusText) statusText.innerText = "Buyurtmaga qaytish";
        }
    } else {
        // Zakaz yo'q bo'lsa, hammasini tozalaymiz
        resetMapState();
        document.querySelector('.map-bottom-panel').style.display = 'block';
        document.getElementById('driver-panel').style.display = 'none';
        stopSearchAnimationOnly(); 
        const banner = document.getElementById('active-order-banner');
        if(banner) banner.style.display = 'none';
    }
}

// [YANGI] Aktiv zakazga qaytish
function returnToActiveOrder() {
    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-map').classList.add('active');
}

function resetMapState() {
    isPinFixed = false;
    if (routeLayer && map) map.removeLayer(routeLayer);
    if (destinationMarker && map) map.removeLayer(destinationMarker);
    destinationMarker = null;
    stopMarkers.forEach(m => map.removeLayer(m));
    stopMarkers = [];
    routeLayer = null;
    if (driverRouteLayer && map) map.removeLayer(driverRouteLayer); // [YANGI]
    driverRouteLayer = null;
    document.getElementById('input-to').value = "";
    calculatePrice();
}


// ==========================================
// 3. XARITA VA GEOLOKATSIYA
// ==========================================
function initMap() {
    if (map !== null) return;

    var defaultLat = 38.8410; // Qarshi
    var defaultLng = 65.7900;

    map = L.map('map', { zoomControl: false }).setView([defaultLat, defaultLng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    userMarker = L.marker(map.getCenter(), {icon: getStartIcon(), zIndexOffset: 1000}).addTo(map);

    map.on('move', function() { 
        const center = map.getCenter();
        if (isPickingDestination) {
            // Manzil tanlash rejimi
            if (!destinationSelectionMarker) {
                destinationSelectionMarker = L.marker(center, {icon: getFinishIcon(), zIndexOffset: 1001}).addTo(map);
            }
            destinationSelectionMarker.setLatLng(center);
        } else {
            // Oddiy rejim (Mijoz joylashuvi)
                if (!isPinFixed) userMarker.setLatLng(center);
                updateNearestETA(); // [YANGI] ETA ni yangilash
            }
        });
    
    map.on('moveend', function() {
        const center = map.getCenter();
        if (isPickingDestination) {
            // Manzilni aniqlash (Reverse Geocoding)
            getAddressFromCoords(center.lat, center.lng, 'to');
        } else if (!isPinFixed) {
            getAddressFromCoords(center.lat, center.lng);
            checkRegion(center.lat, center.lng);
        }
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                map.setView([lat, lng], 16);
                if (!isPinFixed) {
                    userMarker.setLatLng([lat, lng]);
                    getAddressFromCoords(lat, lng);
                    checkRegion(lat, lng);
                }
            },
            () => { 
                document.getElementById('input-from').value = "Qarshi, O'zbekiston"; 
                checkRegion(defaultLat, defaultLng);
            }
        );
    }
    loadOnlineDrivers();
}

async function getAddressFromCoords(lat, lng, type = 'from') {
    const inputEl = type === 'to' ? document.getElementById('input-to') : document.getElementById('input-from');
    if(!inputEl) return;
    
    try {
        let response = await fetch(`${API_BASE}/api/geocoding?lat=${lat}&lng=${lng}`);
        if (response.ok) {
            let data = await response.json();
            
            if (data.error) {
                inputEl.value = "Noma'lum hudud";
                return;
            }
            
            let fullAddress = "";
            if (data.address) {
                const a = data.address;
                // Ko'proq maydonlarni tekshiramiz
                fullAddress = a.road || a.pedestrian || a.street || a.residential || a.village || a.town || a.city || a.county || (data.display_name ? data.display_name.split(',')[0] : "Belgilangan joy");
            } else if (data.display_name) {
                fullAddress = data.display_name.split(',')[0];
            }
            
            inputEl.value = fullAddress;
        }
    } catch (e) { console.error(e); }
}

async function loadOnlineDrivers() {
    try {
        const res = await fetch(`${API_BASE}/api/drivers`);
        const drivers = await res.json();
        
        drivers.forEach(d => {
            if (d.status === 'online' && d.lat && d.lng) {
                const id = d.telefon;
                if (!driversOnMap[id]) {
                    const newMarker = L.marker([d.lat, d.lng], {icon: carIcon}).addTo(map);
            
                    driversOnMap[id] = newMarker;
                }
            }
        });
        updateNearestETA(); // [YANGI]
    } catch (e) { console.error(e); }
}

// [YANGI] Geolokatsiya tugmasi funksiyasi
window.locateUser = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                if(map) {
                    map.setView([lat, lng], 17);
                    if (!isPinFixed && userMarker && !isPickingDestination) {
                        userMarker.setLatLng([lat, lng]);
                        getAddressFromCoords(lat, lng);
                        checkRegion(lat, lng);
                    }
                }
            },
            (err) => console.error(err),
            { enableHighAccuracy: true }
        );
    } else {
        alert("Geolokatsiya yoqilmagan");
    }
};

// [YANGI] Manzilni xaritadan tanlash
window.openDestinationPicker = function() {
    isPickingDestination = true;
    document.querySelector('.map-bottom-panel').style.display = 'none';
    document.getElementById('destination-pick-controls').style.display = 'block';
    
    // Markazga vaqtinchalik marker qo'yamiz
    const center = map.getCenter();
    if(destinationSelectionMarker) map.removeLayer(destinationSelectionMarker);
    destinationSelectionMarker = L.marker(center, {icon: getFinishIcon(), zIndexOffset: 1001}).addTo(map);
    
    // User markerni yashirmaymiz, lekin u qimirlamaydi
};

window.confirmDestinationPicker = function() {
    isPickingDestination = false;
    document.querySelector('.map-bottom-panel').style.display = 'block';
    document.getElementById('destination-pick-controls').style.display = 'none';
    
    if(destinationSelectionMarker) map.removeLayer(destinationSelectionMarker);
    destinationSelectionMarker = null;
    
    calculatePrice(); // Yo'lni hisoblash
};

window.cancelDestinationPicker = function() {
    isPickingDestination = false;
    document.querySelector('.map-bottom-panel').style.display = 'block';
    document.getElementById('destination-pick-controls').style.display = 'none';
    if(destinationSelectionMarker) map.removeLayer(destinationSelectionMarker);
    destinationSelectionMarker = null;
    document.getElementById('input-to').value = ''; // Tozalash
};

// ==========================================
// 4. QIDIRUV VA TARIFLAR
// ==========================================
var allAddresses = [];
async function loadSavedAddresses() {
    try {
        const res = await fetch(`${API_BASE}/api/addresses`);
        if (res.ok) allAddresses = await res.json();
        else console.warn("Manzillarni yuklashda server xatosi:", res.status);
    } catch (err) { console.error(err); }
}

// [YANGI] Debounce funksiyasi (Serverni yuklamaslik uchun)
function debounce(func, timeout = 500){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

var inputTo = document.getElementById('input-to');
if (inputTo) inputTo.addEventListener('input', debounce(function() {
    const val = this.value.toLowerCase();
    const list = document.getElementById('search-results');
    list.innerHTML = '';

    if (!val) { list.style.display = 'none'; resetMapState(); return; }

    const filtered = allAddresses.filter(addr => 
        addr.nomi.toLowerCase().includes(val) || (addr.manzil && addr.manzil.toLowerCase().includes(val))
    );

    if (filtered.length > 0) {
        list.style.display = 'block';
        filtered.forEach(addr => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `<b>${addr.nomi}</b><small>${addr.manzil || ''}</small>`;
            div.onclick = function() {
                document.getElementById('input-to').value = addr.nomi;
                list.style.display = 'none';
                calculatePrice(); 
            };
            list.appendChild(div);
        });
    } else { list.style.display = 'none'; }
}, 500)); // 500ms kutib keyin qidiradi


document.addEventListener('click', function(e) {
    if (e.target.id !== 'input-to') document.getElementById('search-results').style.display = 'none';
});

// ==========================================
// 5. BUYURTMA BERISH
// ==========================================
async function placeOrder() {
    const fromVal = document.getElementById('input-from').value;
    const toVal = document.getElementById('input-to').value;

    if (!toVal) { alert("Iltimos, qayerga borishingizni yozing!"); return; }
    if (!currentUserPhone) { alert("Tizimga kiring!"); goToHome(); return; }

    // [YANGI] Ismni aniqlash (Aniq ma'lumot uchun)
    let clientName = localStorage.getItem('client_name');
    if (!clientName || clientName.trim() === "") {
        clientName = prompt("Buyurtma berish uchun ismingizni kiriting:");
        if (clientName) localStorage.setItem('client_name', clientName);
        else clientName = "Mijoz"; // Agar kiritmasa
    }

    let calcPrice = "Kelishilgan";
    const activeCard = document.querySelector('.tariff-card.active .tariff-price b');
    if (activeCard) calcPrice = activeCard.innerText;

    let fLat = 0, fLng = 0, tLat = 0, tLng = 0;
    
    // [YANGI] Vaqtni olish
    let scheduledTime = null;
    const scheduleInput = document.getElementById('order-schedule-time');
    if(document.getElementById('schedule-row').style.display !== 'none' && scheduleInput.value) {
        scheduledTime = scheduleInput.value;
    }

    if (userMarker) {
        const pos = userMarker.getLatLng();
        fLat = pos.lat; fLng = pos.lng;
    }
    if (destinationMarker) {
        const pos = destinationMarker.getLatLng();
        tLat = pos.lat; tLng = pos.lng;
    }

    const orderData = {
        phone: currentUserPhone,
        name: clientName, // [YANGI] Haqiqiy ism
        from: fromVal, to: toVal,
        fromLat: fLat, fromLng: fLng,
        toLat: tLat, toLng: tLng,
        comment: currentTariff,
        narx: calcPrice,
        scheduledTime: scheduledTime // [YANGI]
    };

    document.getElementById('screen-searching').classList.add('active');
    document.querySelector('.map-bottom-panel').style.display = 'none';

    if (map && userMarker) map.setView(userMarker.getLatLng(), 17);
    
    // Timer
    let sec = 0;
    const timerEl = document.getElementById('search-timer');
    clearInterval(searchTimerInterval);
    searchTimerInterval = setInterval(() => {
        sec++;
        let m = Math.floor(sec / 60).toString().padStart(2, '0');
        let s = (sec % 60).toString().padStart(2, '0');
        if(timerEl) timerEl.innerText = `${m}:${s}`;
    }, 1000);

    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await res.json();
        if(data.success && data.order) {
            if (data.order.status === 'scheduled') {
                alert(`Buyurtma qabul qilindi!\nVaqt: ${data.order.vaqt}`);
                cancelSearch(); // Qidiruvni to'xtatamiz, chunki bu rejali
                return;
            }
            currentOrderId = data.order.id;
            socket.emit('join_chat', currentOrderId); // Xonaga ulanish
        } else {
            cancelSearch(); alert("Xatolik!");
        }
    } catch (err) {
        cancelSearch(); alert("Server bilan aloqa yo'q!");
    }
}

function cancelSearch() {
    if (currentOrderId) {
        socket.emit('cancel_order', currentOrderId);
    }
    stopSearchAnimationOnly();
    document.querySelector('.map-bottom-panel').style.display = 'block';
    currentOrderId = null; // [YANGI] Qidiruv bekor qilinsa ID ni tozalash
}

function stopSearchAnimationOnly() {
    document.getElementById('screen-searching').classList.remove('active');
    clearInterval(searchTimerInterval);
}

// ==========================================
// 6. SOCKET HODISALARI
// ==========================================
socket.on('driver_found', function(data) {
    stopSearchAnimationOnly();
    document.querySelector('.map-bottom-panel').style.display = 'none'; 
    const driverPanel = document.getElementById('driver-panel');
    driverPanel.style.display = 'block';

    // Yangi ma'lumotlarni to'ldirish
    document.getElementById('lbl-driver-name').innerText = data.driver || "Haydovchi";
    document.getElementById('lbl-car-name').innerText = data.car_model || "Avtomobil";
    document.getElementById('lbl-car-plate').innerText = data.car_plate || "---";
    document.getElementById('lbl-car-color').innerText = data.car_color || "";
    document.getElementById('lbl-driver-rating').innerText = `★ ${data.rating || 5.0}`;
    
    if(data.phone) {
        document.getElementById('btn-call-driver').href = `tel:${data.phone}`;
    }
    
    document.getElementById('lbl-arrival-time').innerText = "~3 daq"; 
    document.getElementById('lbl-driver-status').innerText = translations[currentLang].driver_arriving; // [YANGI]

    // [YANGI] Haydovchidan Mijozgacha yo'l chizish
    if (data.driverLat != null && data.driverLng != null && userMarker) {
        const userPos = userMarker.getLatLng();
        drawDriverToClientRoute(data.driverLat, data.driverLng, userPos.lat, userPos.lng);
    }
});

// [YANGI] Global status o'zgarishini tinglash (Ehtiyot shart)
socket.on('order_status_change_global', function(data) {
    if (currentOrderId && String(data.orderId) === String(currentOrderId) && data.status === 'accepted') {
        // Agar mijoz hali ham qidiruv ekranida bo'lsa, uni haydovchi topildi ekraniga o'tkazamiz
        const driver = data.driverData || {};
        // driver_found hodisasini qo'lda chaqiramiz
        socket.emit('driver_found_manual', { // Bu shunchaki lokal funksiyani chaqirish uchun
            driver: driver.firstname + " " + driver.lastname,
            phone: driver.telefon,
            car_model: driver.marka + " " + driver.model,
            car_plate: driver.raqam,
            car_color: driver.rang,
            rating: driver.reyting
        });
    }
});

socket.on('order_status_update', function(data) {
    const timeLabel = document.getElementById('lbl-arrival-time');
    const statusText = document.getElementById('lbl-driver-status'); // [YANGI]
    const t = translations[currentLang]; // [YANGI]

    if (data.status === 'arrived') {
        timeLabel.innerText = t.driver_arrived;
        if(statusText) statusText.innerText = t.driver_arrived;
        timeLabel.style.color = "#27ae60";
    } else if (data.status === 'started') {
        timeLabel.innerText = t.driver_started;
        if(statusText) statusText.innerText = t.driver_started;
        timeLabel.style.color = "#2980b9";
        
        // [YANGI] Haydovchi kelish yo'lini o'chirish
        if (driverRouteLayer && map) map.removeLayer(driverRouteLayer);
        
        // [YANGI] Sayohat yo'lini chizish (Mijoz -> Manzil)
        if (data.fromLat != null && data.toLat != null) {
            drawTripRoute(data.fromLat, data.fromLng, data.toLat, data.toLng, data.stops);
        }
    } else if (data.status === 'finished') {
        alert(t.driver_finished);
        location.reload(); 
    } else if (data.status === 'cancelled') {
        alert("Haydovchi buyurtmani bekor qildi.");
        location.reload();
    }
});

socket.on('live_tracking', function(data) {
    if (!map) return;
    if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') return; // [YANGI] Validatsiya
    const driverId = data.id || 'unknown';
    if (driversOnMap[driverId]) {
        const marker = driversOnMap[driverId];
        const oldPos = marker.getLatLng();
        const newPos = L.latLng(data.lat, data.lng);

        // [YANGI] Mashina burilishini hisoblash (agar 2 metrdan ko'p yursa)
        if (oldPos.distanceTo(newPos) > 2) { 
             const angle = calculateAngle(oldPos.lat, oldPos.lng, data.lat, data.lng);
             const iconEl = marker.getElement();
             if (iconEl) {
                 const img = iconEl.querySelector('.car-img-anim');
                 if (img) {
                     img.style.transform = `rotate(${angle}deg)`;
                 }
             }
        }

        animateMarker(marker, data.lat, data.lng, 1000); // [YANGI] Silliq harakat (1 soniya)
        updateNearestETA(); // [YANGI]
    } else {
        const newMarker = L.marker([data.lat, data.lng], {icon: carIcon}).addTo(map);
        driversOnMap[driverId] = newMarker;
    }
});

// [YANGI] Burchakni hisoblash funksiyasi
function calculateAngle(lat1, lng1, lat2, lng2) {
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

// [YANGI] Marker animatsiyasi funksiyasi
function animateMarker(marker, newLat, newLng, duration) {
    if (marker.animationFrameId) cancelAnimationFrame(marker.animationFrameId);

    const startLat = marker.getLatLng().lat;
    const startLng = marker.getLatLng().lng;
    const startTime = performance.now();

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentLat = startLat + (newLat - startLat) * progress;
        const currentLng = startLng + (newLng - startLng) * progress;

        marker.setLatLng([currentLat, currentLng]);

        if (progress < 1) {
            marker.animationFrameId = requestAnimationFrame(step);
        } else {
            marker.animationFrameId = null;
        }
    }
    marker.animationFrameId = requestAnimationFrame(step);
}

// [YANGI] Eng yaqin mashinagacha vaqtni hisoblash (ETA)
function updateNearestETA() {
    if (!userMarker || !map) return;
    const userPos = userMarker.getLatLng();
    let minDistance = Infinity;
    let hasDrivers = false;

    for (let id in driversOnMap) {
        const marker = driversOnMap[id];
        const pos = marker.getLatLng();
        const dist = getDistanceFromLatLonInKm(userPos.lat, userPos.lng, pos.lat, pos.lng);
        if (dist < minDistance) minDistance = dist;
        hasDrivers = true;
    }

    const footer = document.querySelector('.promo-footer');
    if (!footer) return;
    
    const taxiText = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang].promo_taxi : "Taksi";

    if (!hasDrivers) {
        footer.innerHTML = `<b data-i18n="promo_taxi">${taxiText}</b> • --`;
    } else {
        // 30 km/h o'rtacha tezlik => 1 km = 2 daqiqa + 1 daqiqa podacha
        let eta = Math.ceil(minDistance * 2) + 1; 
        if (eta < 2) eta = 2;
        footer.innerHTML = `<b data-i18n="promo_taxi">${taxiText}</b> • ~${eta} daq`;
    }
}

function cancelOrder() {
    if(confirm("Bekor qilasizmi?")) {
        if (currentOrderId) {
            socket.emit('cancel_order', currentOrderId);
        } else {
            location.reload();
        }
    }
}

socket.on('order_cancelled_success', function() {
    alert("Buyurtma bekor qilindi.");
    location.reload();
});

// ==========================================
// 7. REGION & TARIFLAR (HISOBLASH)
// ==========================================
async function loadSystemData() {
    try {
        const res = await fetch(`${API_BASE}/api/services`);
        if (res.ok) globalServices = await res.json();
    } catch (e) { console.error(e); }
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; 
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function checkRegion(lat, lng) {
    try {
        const res = await fetch(`${API_BASE}/api/regions`);
        if (res.ok) {
            const regions = await res.json();
            let foundRegion = null;
            for (let reg of regions) {
                if (getDistanceFromLatLonInKm(lat, lng, reg.lat, reg.lng) <= reg.radius) { foundRegion = reg; break; }
            }
            if (foundRegion && (!activeRegion || activeRegion.id !== foundRegion.id)) {
                activeRegion = foundRegion;
                loadTariffsForRegion(foundRegion.id);
            } else if (!foundRegion) {
                document.getElementById('tariff-list').innerHTML = '<div style="padding:15px; color:red">Xizmat doirasidan tashqarida</div>';
            }
        }
    } catch (e) { console.error(e); }
}

async function loadTariffsForRegion(regionId) {
    try {
        const res = await fetch(`${API_BASE}/api/tariffs`);
        const allTariffs = await res.json();
        const localTariffs = allTariffs.filter(t => t.region_id === regionId);
        
        const list = document.getElementById('tariff-list');
        list.innerHTML = '';

        if (localTariffs.length === 0) { list.innerHTML = '...'; return; }

        localTariffs.forEach((tariff, index) => {
            const srv = globalServices.find(s => s.id === tariff.service_id) || { nomi: 'Noma\'lum', icon: 'car.png' };
            const isActive = index === 0 ? 'active' : '';
            if (index === 0) activeTariff = tariff;

            const div = document.createElement('div');
            div.className = `tariff-card ${isActive}`;
            div.onclick = () => {
                document.querySelectorAll('.tariff-card').forEach(c => c.classList.remove('active'));
                div.classList.add('active');
                activeTariff = tariff;
                currentTariff = srv.nomi;
                calculatePrice();
            };
            div.innerHTML = `
                <img src="img/${srv.icon}" class="tariff-car" style="width:70px;">
                <div class="tariff-name">${srv.nomi}</div>
                <div class="tariff-price">min. ${tariff.min_narx} so'm</div>
            `;
            list.appendChild(div);
        });
        calculatePrice(); 
    } catch (e) { console.error(e); }
}

// [YANGI] Promokodni tekshirish
async function checkPromoCode() {
    const code = document.getElementById('promo-input').value.toUpperCase();
    const statusEl = document.getElementById('promo-status');
    
    if(!code) { activePromo = null; statusEl.innerHTML = ''; calculatePrice(); return; }

    const res = await fetch(`${API_BASE}/api/promocodes/validate`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ code })
    });
    const data = await res.json();
    if(data.success) {
        activePromo = data.promo;
        statusEl.innerHTML = '<span style="color:green">✓</span>';
        calculatePrice();
    } else {
        activePromo = null;
        statusEl.innerHTML = '<span style="color:red">✗</span>';
        calculatePrice();
    }
}

async function calculatePrice() {
    if (!activeTariff) return;
    
    const toInput = document.getElementById('input-to').value.trim();
    if (!toInput || !userMarker) {
        let minPrice = activeTariff.min_narx;
        if (surgeActive && surgeMultiplier > 1) minPrice = Math.ceil(minPrice * surgeMultiplier / 500) * 500;
        const activePriceEl = document.querySelector('.tariff-card.active .tariff-price');
        if(activePriceEl) activePriceEl.innerHTML = `min. ${minPrice} so'm`;
        return;
    }

    try {
        // Koordinatalarni topish (Address listdan yoki Search API)
        let toLat, toLng;
        const localMatch = allAddresses.find(addr => addr.nomi.toLowerCase() === toInput.toLowerCase());
        
        if (localMatch) { toLat = localMatch.lat; toLng = localMatch.lng; } 
        else {
            const resSearch = await fetch(`${API_BASE}/api/search?q=${toInput}`);
            const dataSearch = await resSearch.json();
            if (dataSearch.length > 0) { toLat = parseFloat(dataSearch[0].lat); toLng = parseFloat(dataSearch[0].lon); }
            else return;
        }

        if (isNaN(toLat) || isNaN(toLng)) return; // [YANGI] Koordinata xato bo'lsa to'xtatish

        isPinFixed = true;
        if (destinationMarker) map.removeLayer(destinationMarker);
        destinationMarker = L.marker([toLat, toLng], {icon: getFinishIcon()}).addTo(map);

        const userPos = userMarker.getLatLng();
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userPos.lng},${userPos.lat};${toLng},${toLat}?overview=full&geometries=geojson`;
        
        const resRoute = await fetch(osrmUrl);
        const dataRoute = await resRoute.json();

        if (dataRoute.routes && dataRoute.routes.length > 0) {
            const route = dataRoute.routes[0];
            const distanceKm = route.distance / 1000;
            const durationMin = Math.round(route.duration / 60);

            if (routeLayer) map.removeLayer(routeLayer);
            routeLayer = L.geoJSON(route.geometry, { style: { color: '#27ae60', weight: 5, opacity: 0.8 } }).addTo(map);
            map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

            let distanceCost = 0;
            if (distanceKm > activeTariff.tekin_km) {
                distanceCost = (distanceKm - activeTariff.tekin_km) * activeTariff.km_narxi;
            }
            let total = activeTariff.posadka + distanceCost;
            if (total < activeTariff.min_narx) total = activeTariff.min_narx;

            let finalPrice = total;
            let surgeHtml = ""; 
            if (surgeActive && surgeMultiplier > 1) {
                finalPrice = Math.ceil(total * surgeMultiplier / 500) * 500; 
                surgeHtml = ` <i class="fas fa-bolt" style="color: #FFD600;"></i>`;
            }
            
            // [YANGI] Promokodni qo'llash
            if (activePromo) {
                let discount = 0;
                if (activePromo.type === 'percent') discount = finalPrice * activePromo.amount / 100;
                else discount = activePromo.amount;
                finalPrice = Math.max(0, finalPrice - discount);
                surgeHtml += ` <span style="color:green; font-size:12px">(-${discount.toLocaleString()})</span>`;
            }

            const activePriceEl = document.querySelector('.tariff-card.active .tariff-price');
            if(activePriceEl) {
                // [YANGI] Narxni animatsiya bilan o'zgartirish
                const currentB = activePriceEl.querySelector('b');
                let startVal = 0;
                if(currentB) startVal = parseInt(currentB.innerText.replace(/\D/g, '')) || 0;

                if(startVal > 0 && startVal !== finalPrice) {
                    animatePriceChange(activePriceEl, startVal, finalPrice, surgeHtml, distanceKm, durationMin);
                } else {
                    activePriceEl.innerHTML = `
                        <b>${finalPrice.toLocaleString()} so'm</b>${surgeHtml}
                        <div style="font-size:9px; color:#555">~${distanceKm.toFixed(1)} km • ${durationMin} daq</div>
                    `;
                }
            }
        }
    } catch (e) { console.error(e); }
}

// [YANGI] Narx animatsiyasi funksiyasi
function animatePriceChange(el, start, end, surgeHtml, dist, dur) {
    if (el.animationFrameId) cancelAnimationFrame(el.animationFrameId);
    
    const duration = 500; 
    const startTime = performance.now();

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out

        const val = Math.floor(start + (end - start) * ease);
        
        el.innerHTML = `
            <b>${val.toLocaleString()} so'm</b>${surgeHtml}
            <div style="font-size:9px; color:#555">~${dist.toFixed(1)} km • ${dur} daq</div>
        `;

        if (progress < 1) {
            el.animationFrameId = requestAnimationFrame(step);
        } else {
             el.innerHTML = `
                <b>${end.toLocaleString()} so'm</b>${surgeHtml}
                <div style="font-size:9px; color:#555">~${dist.toFixed(1)} km • ${dur} daq</div>
            `;
            el.animationFrameId = null;
        }
    }
    el.animationFrameId = requestAnimationFrame(step);
}

// [YANGI] Haydovchi -> Mijoz marshrutini chizish
async function drawDriverToClientRoute(dLat, dLng, cLat, cLng) {
    if (!map) return;
    if (dLat == null || dLng == null || cLat == null || cLng == null) return; // [YANGI]

    // Eski yo'llarni tozalash
    if (routeLayer) map.removeLayer(routeLayer);
    if (driverRouteLayer) map.removeLayer(driverRouteLayer);

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${cLng},${cLat}?overview=full&geometries=geojson`;
    
    try {
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            // Ko'k rangda chizamiz (Navigator uslubi)
            driverRouteLayer = L.geoJSON(route.geometry, { style: { color: '#007AFF', weight: 6, opacity: 0.8 } }).addTo(map);
            map.fitBounds(driverRouteLayer.getBounds(), { padding: [80, 80] });
        }
    } catch (e) { console.error("Driver route error:", e); }
}

// [YANGI] Sayohat paytida yo'l chizish (Mijoz uchun)
async function drawTripRoute(lat1, lng1, lat2, lng2, stops) {
    if (!map) return;
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return; // [YANGI]
    if (routeLayer) map.removeLayer(routeLayer);

    let waypoints = `${lng1},${lat1}`;
    if(stops && stops.length > 0) {
        stops.forEach(s => waypoints += `;${s.lng},${s.lat}`);
    }
    waypoints += `;${lng2},${lat2}`;

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
    
    try {
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            routeLayer = L.geoJSON(route.geometry, { style: { color: '#27ae60', weight: 6, opacity: 0.8 } }).addTo(map);
            map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// 8. TIZIM SOZLAMALARI
// ==========================================
async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        if (res.ok) {
            const data = await res.json();
            surgeActive = data.surge_active;
            surgeMultiplier = data.surge_multiplier;
            calculatePrice(); 
        }
    } catch(e) { console.log(e); }
}

socket.on('surge_update', (data) => {
    surgeActive = data.active;
    surgeMultiplier = data.multiplier;
    calculatePrice(); 
});

// Chat (Mijoz)
function toggleChat() {
    const chat = document.getElementById('chat-modal');
    chat.style.display = chat.style.display === 'flex' ? 'none' : 'flex';
}
function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentOrderId) return;
    document.getElementById('chat-messages').innerHTML += `<div class="msg out">${text}</div>`;
    socket.emit('send_message', { orderId: currentOrderId, text: text, sender: 'client' });
    input.value = '';
}
socket.on('receive_message', function(data) {
    if (data.sender !== 'client') {
        document.getElementById('chat-messages').innerHTML += `<div class="msg in">${data.text}</div>`;
    }
});

// ==========================================
// 9. MULTILANGUAGE (TIL SOZLAMALARI)
// ==========================================
var translations = {
    uz: {
        login_title: "Raqamingizni kiriting",
        login_subtitle: "Raqamga tasdiqlash kodi yuboriladi",
        login_btn: "Kirish",
        search_placeholder: "Nima qidiryapsiz?",
        promo_taxi: "Taksi",
        profile_title: "Profil",
        profile_name_placeholder: "Ismingizni kiriting",
        profile_history: "Buyurtmalar tarixi",
        profile_logout: "Chiqish",
        profile_save: "Saqlash",
        history_title: "Buyurtmalar Tarixi",
        rating_title: "Sayohat qanday o'tdi?",
        rating_subtitle: "Haydovchiga baho bering",
        rating_placeholder: "Izoh qoldiring (ixtiyoriy)",
        rating_btn: "Baho berish",
        searching_title: "Haydovchi<br>qidirilmoqda...",
        searching_cancel: "Bekor qilish",
        searching_params: "Parametrlar",
        driver_arriving: "Haydovchi siz tomonga kelmoqda",
        driver_arrived: "🚖 Haydovchi keldi",
        driver_started: "🚀 Yo'lda",
        driver_finished: "✅ Manzilga yetdingiz.",
        order_btn: "Buyurtma berish",
        payment_title: "To'lov turi",
        payment_cash: "Naqd pul",
        payment_card: "Karta (Click / Payme)",
        options_title: "Sayohat istaklari",
        option_ac: "Konditsioner",
        option_luggage: "Bo'sh yukxona",
        save_btn: "Saqlash",
        input_to_placeholder: "Qayerga?",
        menu_language: "Tilni o'zgartirish",
        eco: "Ekonom",
        addr_home: "Uy",
        addr_work: "Ish",
        addr_not_set: "Manzil kiritilmagan",
        enter_addr_home: "Uy manzilingizni kiriting:",
        enter_addr_work: "Ish manzilingizni kiriting:",
        fav_add_btn: "Yangi manzil",
        fav_add_desc: "Sevimlilarga qo'shish",
        fav_name_prompt: "Manzil nomi (Masalan: Sport zal):",
        fav_addr_prompt: "Manzilni kiriting:"
    },
    ru: {
        login_title: "Введите ваш номер",
        login_subtitle: "Код подтверждения будет отправлен на номер",
        login_btn: "Войти",
        search_placeholder: "Куда поедем?",
        promo_taxi: "Такси",
        profile_title: "Профиль",
        profile_name_placeholder: "Введите ваше имя",
        profile_history: "История заказов",
        profile_logout: "Выйти",
        profile_save: "Сохранить",
        history_title: "История заказов",
        rating_title: "Как прошла поездка?",
        rating_subtitle: "Оцените водителя",
        rating_placeholder: "Оставьте комментарий (необязательно)",
        rating_btn: "Оценить",
        searching_title: "Поиск<br>водителя...",
        searching_cancel: "Отменить",
        searching_params: "Параметры",
        driver_arriving: "Водитель едет к вам",
        driver_arrived: "🚖 Водитель ожидает",
        driver_started: "🚀 В пути",
        driver_finished: "✅ Вы прибыли.",
        order_btn: "Заказать",
        payment_title: "Способ оплаты",
        payment_cash: "Наличные",
        payment_card: "Карта (Click / Payme)",
        options_title: "Пожелания к поездке",
        option_ac: "Кондиционер",
        option_luggage: "Пустой багажник",
        save_btn: "Сохранить",
        input_to_placeholder: "Куда?",
        menu_language: "Сменить язык",
        eco: "Эконом",
        addr_home: "Дом",
        addr_work: "Работа",
        addr_not_set: "Адрес не указан",
        enter_addr_home: "Введите домашний адрес:",
        enter_addr_work: "Введите рабочий адрес:",
        fav_add_btn: "Новый адрес",
        fav_add_desc: "Добавить в избранное",
        fav_name_prompt: "Название (Например: Спортзал):",
        fav_addr_prompt: "Введите адрес:"
    },
    en: {
        login_title: "Enter your number",
        login_subtitle: "Verification code will be sent to the number",
        login_btn: "Login",
        search_placeholder: "Where to?",
        promo_taxi: "Taxi",
        profile_title: "Profile",
        profile_name_placeholder: "Enter your name",
        profile_history: "Order History",
        profile_logout: "Logout",
        profile_save: "Save",
        history_title: "Order History",
        rating_title: "How was your trip?",
        rating_subtitle: "Rate the driver",
        rating_placeholder: "Leave a comment (optional)",
        rating_btn: "Submit",
        searching_title: "Searching for<br>driver...",
        searching_cancel: "Cancel",
        searching_params: "Parameters",
        driver_arriving: "Driver is coming to you",
        driver_arrived: "🚖 Driver is waiting",
        driver_started: "🚀 On the way",
        driver_finished: "✅ Arrived.",
        order_btn: "Order",
        payment_title: "Payment Method",
        payment_cash: "Cash",
        payment_card: "Card (Click / Payme)",
        options_title: "Ride Preferences",
        option_ac: "Air Conditioner",
        option_luggage: "Empty Trunk",
        save_btn: "Save",
        input_to_placeholder: "Where to?",
        menu_language: "Change Language",
        eco: "Economy",
        addr_home: "Home",
        addr_work: "Work",
        addr_not_set: "Address not set",
        enter_addr_home: "Enter home address:",
        enter_addr_work: "Enter work address:",
        fav_add_btn: "New Address",
        fav_add_desc: "Add to favorites",
        fav_name_prompt: "Location name (e.g. Gym):",
        fav_addr_prompt: "Enter address:"
    }
};

function updateUIText() {
    const t = translations[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.hasAttribute('placeholder')) el.placeholder = t[key];
            } else {
                el.innerHTML = t[key];
            }
        }
    });
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('client_lang', lang);
    updateUIText();
    loadMyAddresses(); // [YANGI]
    loadFavorites(); // [YANGI]
    closeLanguageModal();
    
    // Update checks in modal
    document.querySelectorAll('.check-icon').forEach(el => el.style.display = 'none');
    const check = document.getElementById(`lang-check-${lang}`);
    if(check) check.style.display = 'block';
}

function openLanguageModal() {
    document.getElementById('languageModal').classList.add('active');
    // Set active check
    document.querySelectorAll('.check-icon').forEach(el => el.style.display = 'none');
    const check = document.getElementById(`lang-check-${currentLang}`);
    if(check) check.style.display = 'block';
}

function closeLanguageModal() {
    document.getElementById('languageModal').classList.remove('active');
}

// ==========================================
// 10. YETISHMAYOTGAN FUNKSIYALAR (TUZATISH)
// ==========================================

// PROFIL
function openProfile() {
    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-profile').classList.add('active');
    document.getElementById('p-phone').innerText = currentUserPhone || "+998 -- --- -- --";
    document.getElementById('p-name').value = localStorage.getItem('client_name') || "";
}
function closeProfile() {
    document.getElementById('screen-profile').classList.remove('active');
    document.getElementById('screen-home').classList.add('active');
}
function saveProfile() {
    const name = document.getElementById('p-name').value;
    localStorage.setItem('client_name', name);
    alert("Profil saqlandi!");
    closeProfile();
}
function clientLogout() {
    if(confirm("Tizimdan chiqmoqchimisiz?")) {
        localStorage.removeItem('client_phone');
        localStorage.removeItem('client_name');
        location.reload();
    }
}

// TARIX
function openHistory() {
    if (!currentUserPhone) return;
    document.getElementById('screen-profile').classList.remove('active');
    document.getElementById('screen-history').classList.add('active');
    
    const list = document.getElementById('history-list');
    list.innerHTML = '<div style="text-align:center; margin-top:20px;">Yuklanmoqda...</div>';

    fetch(`${API_BASE}/api/client/orders?phone=${encodeURIComponent(currentUserPhone)}`)
        .then(res => res.json())
        .then(orders => {
            list.innerHTML = '';
            if(orders.length === 0) {
                list.innerHTML = '<div style="text-align:center; margin-top:30px; color:#888;">Tarix bo\'sh</div>';
                return;
            }
            orders.forEach(o => {
                list.innerHTML += `
                    <div style="background:var(--input-bg); padding:15px; border-radius:15px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-weight:700;">${o.narx || 'Kelishilgan'}</span>
                            <span style="color:#888; font-size:12px;">${o.vaqt || ''}</span>
                        </div>
                        <div style="font-size:14px; margin-bottom:5px;"><i class="fas fa-map-marker-alt" style="color:green"></i> ${o.qayerdan}</div>
                        <div style="font-size:14px;"><i class="fas fa-flag-checkered" style="color:red"></i> ${o.qayerga}</div>
                    </div>
                `;
            });
        })
        .catch(e => { console.error(e); list.innerHTML = 'Xatolik'; });
}
function closeHistory() {
    document.getElementById('screen-history').classList.remove('active');
    document.getElementById('screen-profile').classList.add('active');
}

// TO'LOV
function openPaymentModal() { document.getElementById('paymentModal').classList.add('active'); }
function closePaymentModal() { document.getElementById('paymentModal').classList.remove('active'); }
function selectPayment(type) {
    selectedPaymentMethod = type;
    document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
    if(type === 'naqd') document.getElementById('pay-cash').classList.add('selected');
    if(type === 'karta') document.getElementById('pay-card').classList.add('selected');
    
    const icon = document.getElementById('footer-payment-icon');
    if(type === 'naqd') { icon.className = 'fas fa-money-bill-wave'; icon.style.color = '#2E7D32'; }
    else { icon.className = 'fas fa-credit-card'; icon.style.color = '#1976D2'; }
    closePaymentModal();
}

// OPSIYALAR
function openOptionsModal() { 
    document.getElementById('optionsModal').classList.add('active'); 
    document.getElementById('opt-ac').checked = selectedOptions.ac;
    document.getElementById('opt-luggage').checked = selectedOptions.luggage;
}
function closeOptionsModal() { 
    selectedOptions.ac = document.getElementById('opt-ac').checked;
    selectedOptions.luggage = document.getElementById('opt-luggage').checked;
    document.getElementById('optionsModal').classList.remove('active'); 
}

// [YANGI] Vaqt tanlashni ko'rsatish/yashirish
window.toggleScheduleInput = function() {
    const isChecked = document.getElementById('opt-schedule').checked;
    document.getElementById('schedule-row').style.display = isChecked ? 'flex' : 'none';
    if(!isChecked) document.getElementById('order-schedule-time').value = '';
};

// RATING
var ratingValue = 0;
function openRatingScreen() {
    document.getElementById('screen-map').classList.remove('active');
    document.getElementById('driver-panel').style.display = 'none';
    document.getElementById('screen-rating').classList.add('active');
}
function setRating(n) {
    ratingValue = n;
    const stars = document.querySelectorAll('.rating-stars .star');
    stars.forEach((star, index) => {
        if (index < n) star.classList.add('active');
        else star.classList.remove('active');
    });
}
async function submitRating() {
    const comment = document.getElementById('rating-comment').value;
    if (ratingValue === 0) { alert("Iltimos, baho bering!"); return; }
    try {
        await fetch(`${API_BASE}/api/driver/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: currentOrderId, rating: ratingValue, comment })
        });
    } catch(e) { console.error(e); }
    alert("Rahmat! Bahoyingiz qabul qilindi.");
    location.reload();
}

function addStopInput() {
    const container = document.getElementById('stops-container');
    const div = document.createElement('div');
    div.className = 'route-row stop-item';
    div.innerHTML = `
        <i class="fas fa-map-marker-alt" style="color:orange"></i>
        <div class="search-container">
            <input type="text" class="stop-input" placeholder="Oraliq manzil..." autocomplete="off">
        </div>
        <button class="btn-remove-stop" onclick="this.parentElement.remove(); calculatePrice();"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(div);
}

// [YANGI] Mening Manzillarim funksiyalari
function loadMyAddresses() {
    const t = translations[currentLang];
    const home = localStorage.getItem('client_home_addr');
    const work = localStorage.getItem('client_work_addr');
    
    const homeEl = document.getElementById('saved-home-addr');
    if(homeEl) homeEl.innerText = home || t.addr_not_set;
    
    const workEl = document.getElementById('saved-work-addr');
    if(workEl) workEl.innerText = work || t.addr_not_set;
}

window.editSavedAddress = function(type) {
    const t = translations[currentLang];
    const current = localStorage.getItem('client_' + type + '_addr') || "";
    const promptText = type === 'home' ? t.enter_addr_home : t.enter_addr_work;
    
    const newVal = prompt(promptText, current);
    if(newVal !== null && newVal.trim() !== "") {
        localStorage.setItem('client_' + type + '_addr', newVal);
        loadMyAddresses();
    }
};

window.selectSavedAddress = function(type) {
    const addr = localStorage.getItem('client_' + type + '_addr');
    if(addr) {
        goToMap(addr);
    } else {
        editSavedAddress(type);
    }
};

// [YANGI] Sevimlilar (Favorites) funksiyalari
var favorites = JSON.parse(localStorage.getItem('client_favorites') || '[]');

function loadFavorites() {
    const list = document.getElementById('favorites-list');
    if(!list) return;
    list.innerHTML = '';
    
    favorites.forEach((fav, index) => {
        const div = document.createElement('div');
        div.className = 'loc-item';
        div.onclick = () => goToMap(fav.address);
        div.innerHTML = `
            <div class="loc-icon"><i class="fas fa-star" style="color:#FFD600"></i></div>
            <div class="loc-text"><b>${fav.name}</b><span>${fav.address}</span></div>
            <div class="edit-addr-btn" onclick="event.stopPropagation(); removeFavorite(${index})" style="color:#ff3b30"><i class="fas fa-trash"></i></div>
        `;
        list.appendChild(div);
    });
}

window.addNewFavorite = function() {
    const t = translations[currentLang];
    const name = prompt(t.fav_name_prompt);
    if(!name) return;
    const address = prompt(t.fav_addr_prompt);
    if(!address) return;
    
    favorites.push({ name, address });
    localStorage.setItem('client_favorites', JSON.stringify(favorites));
    loadFavorites();
};

window.removeFavorite = function(index) {
    if(confirm("O'chirilsinmi?")) {
        favorites.splice(index, 1);
        localStorage.setItem('client_favorites', JSON.stringify(favorites));
        loadFavorites();
    }
};

// [YANGI] SMS Kod kiritish oynasi (Mijoz uchun)
function injectOtpModal() {
    if (document.getElementById('otp-modal')) return;
    const html = `
    <div id="otp-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:20px; width:85%; max-width:320px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s ease;">
            <div style="width:60px; height:60px; background:#f3f4f6; border-radius:50%; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; font-size:24px; color:#333;">
                <i class="fas fa-sms"></i>
            </div>
            <h3 style="margin:0 0 10px 0; font-size:18px;">Tasdiqlash</h3>
            <p id="otp-phone-display" style="color:#666; font-size:14px; margin-bottom:20px;">Kod yuborildi</p>
            <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px;">
                <input type="tel" id="otp-input" maxlength="4" placeholder="0000" style="width:100%; padding:15px; font-size:24px; text-align:center; border:2px solid #eee; border-radius:12px; outline:none; font-weight:bold; letter-spacing:5px;">
            </div>
            <button id="btn-verify-otp" style="width:100%; padding:14px; background:#FFD600; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow: 0 4px 10px rgba(255, 214, 0, 0.3);">Tasdiqlash</button>
            <div style="margin-top:15px; font-size:13px; color:#999; cursor:pointer;" onclick="location.reload()">Bekor qilish</div>
        </div>
    </div>
    <style>@keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function requestOtpInput(phone, verifyCallback) {
    return new Promise((resolve) => {
        injectOtpModal();
        const modal = document.getElementById('otp-modal');
        const input = document.getElementById('otp-input');
        const btn = document.getElementById('btn-verify-otp');
        const phoneDisplay = document.getElementById('otp-phone-display');
        
        if(phoneDisplay) {
            phoneDisplay.innerText = `${phone} raqamiga kod yuborildi`;
            phoneDisplay.style.color = '#666';
        }
        input.value = ''; 
        input.style.borderColor = '#eee';
        
        modal.style.display = 'flex';
        input.focus();
        
        const onSubmit = async () => {
            const code = input.value;
            if(code.length >= 4) {
                const oldText = btn.innerText;
                btn.innerText = "Tekshirilmoqda...";
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
                } catch(e) { alert("Xatolik!"); }
                finally { btn.innerText = oldText; btn.disabled = false; }
            } else { 
                input.style.borderColor = 'red'; 
            }
        };
        
        input.onkeyup = (e) => { 
            input.style.borderColor = '#eee';
            if(e.key === 'Enter') onSubmit(); 
        };
        btn.onclick = onSubmit;
    });
}
