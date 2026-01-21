const express = require('express');
const http = require('http');
const https = require('https'); // [YANGI] Tashqi API uchun
const { Server } = require("socket.io");
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs'); // [YANGI] Fayllar bilan ishlash uchun
const smpp = require('smpp'); // [YANGI] SMS yuborish uchun

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Favicon xatosini oldini olish
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Client papkasini ulash
app.use(express.static(path.join(__dirname, '../client')));

// --- ☁️ MONGODB ULANISH ---
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://xakimov:Azizbek8889@cluster0.66sckhd.mongodb.net/taxi-pro?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ MONGODB BAZASIGA ULANDI!");
        startBackgroundTasks(); // [YANGI] Orqa fon vazifalarini boshlash
    })
    .catch(err => console.error("❌ Baza xatosi:", err));

// [YANGI] API Middleware: Baza ulanishini tekshirish
app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: "Tizim yuklanmoqda, iltimos kuting..." });
    }
    next();
});

// ==========================================
// [YANGI] SMS SERVER (SMPP) SOZLAMALARI
// ==========================================
const otpStore = {}; // Vaqtincha kodlarni saqlash
let smppSession;

// [YANGI] SMS Log Schema
const SmsLogSchema = new mongoose.Schema({
    phone: String,
    message: String,
    status: String, // 'sent', 'failed'
    error: String,
    date: { type: Date, default: Date.now }
});
const SmsLog = mongoose.model('SmsLog', SmsLogSchema);

function connectSMPP() {
    smppSession = new smpp.Session({host: '213.230.96.207', port: 2775});
    smppSession.on('connect', () => {
        smppSession.bind_transceiver({
            system_id: 'admin',
            password: '123456'
        }, (pdu) => {
            if (pdu.command_status === 0) console.log('✅ SMPP (SMS) Serverga ulandi!');
            else console.error('❌ SMPP Ulanish xatosi:', pdu.command_status);
        });
    });
    smppSession.on('close', () => {
        console.log('⚠️ SMPP Uzildi. 5 soniyadan keyin qayta ulanadi...');
        setTimeout(connectSMPP, 5000);
    });
    smppSession.on('error', (err) => console.error('SMPP Error:', err));
}
connectSMPP();

function sendSMS(phone, text) {
    if (!smppSession) {
        try { new SmsLog({ phone, message: text, status: 'failed', error: "SMPP sessiyasi yo'q" }).save(); } catch(e){}
        return console.error("SMPP sessiyasi yo'q!");
    }
    
    smppSession.submit_sm({
        source_addr: '+998939001069',
        destination_addr: phone,
        short_message: text,
        source_addr_ton: 0, // UNKNOWN
        source_addr_npi: 1, // ISDN
        dest_addr_ton: 0, // UNKNOWN
        dest_addr_npi: 1, // ISDN
    }, (pdu) => {
        if (pdu.command_status === 0) {
            console.log(`📩 SMS yuborildi: ${phone}`);
            try { new SmsLog({ phone, message: text, status: 'sent' }).save(); } catch(e){}
        } else {
            console.error(`❌ SMS xatosi: ${pdu.command_status}`);
            try { new SmsLog({ phone, message: text, status: 'failed', error: `Code: ${pdu.command_status}` }).save(); } catch(e){}
        }
    });
}

// ==========================================
// 1. SCHEMALAR (HAMMASI JOIYDA)
// ==========================================

const RegionSchema = new mongoose.Schema({
    id: Number, nomi: String, lat: Number, lng: Number, radius: Number,
    is_active: { type: Boolean, default: true }
});
const Region = mongoose.model('Region', RegionSchema);

const TagSchema = new mongoose.Schema({
    id: Number, nomi: String
});
const Tag = mongoose.model('Tag', TagSchema);

const ServiceSchema = new mongoose.Schema({
    id: Number, nomi: String, icon: String, tartib: Number,
    tag_id: Number
});
const Service = mongoose.model('Service', ServiceSchema);

const TarifSchema = new mongoose.Schema({
    id: Number, region_id: Number, service_id: Number,
    nomi: String,
    min_narx: { type: Number, default: 0 }, km_narxi: { type: Number, default: 0 }, tekin_km: { type: Number, default: 0 },
    first_km_narxi: { type: Number, default: 0 },
    vaqt_narxi: { type: Number, default: 0 }, tekin_vaqt: { type: Number, default: 0 }, vaqt_birligi: { type: Number, default: 1 },
    posadka: { type: Number, default: 0 },
    kutish_narxi: { type: Number, default: 0 }, tekin_kutish: { type: Number, default: 0 },
    stop_narxi: { type: Number, default: 0 }, tekin_stop: { type: Number, default: 0 },
    point_narxi: { type: Number, default: 0 },
    stop_speed: { type: Number, default: 5 }, traffic_wait: { type: Number, default: 60 },
    round_to: { type: Number, default: 100 }, round_method: { type: String, default: 'math' },
    is_hidden: { type: Boolean, default: false },
    auto_stop: { type: Boolean, default: true },
    round_live: { type: Boolean, default: false },
    show_min: { type: Boolean, default: true },
    group_id: String, transfer_to: String, transfer_load: String,
    is_active: { type: Boolean, default: true }
});
const Tarif = mongoose.model('Tarif', TarifSchema);

const MijozSchema = new mongoose.Schema({
    id: Number, phone: String, date: String
});
const Mijoz = mongoose.model('Mijoz', MijozSchema);

const HaydovchiSchema = new mongoose.Schema({
    id: Number,
    ism: String, lastname: String, firstname: String,
    telefon: String,
    socketId: String, // [YANGI] Aniq haydovchiga yuborish uchun
    marka: String, model: String, raqam: String, rang: String,
    status: { type: String, default: 'offline' },
    balans: { type: Number, default: 0 },
    lat: { type: Number, default: 38.8410 },
    lng: { type: Number, default: 65.7900 },
    callsign: { type: String, default: 'x77' },
    aktivlik: { type: Number, default: 100 },
    reyting: { type: Number, default: 5.0 },
    rating_count: { type: Number, default: 0 },
    daraja: { type: String, default: 'Platina' },
    daromad_tarixi: [{ sana: String, summa: Number }],
    partner_id: { type: String, default: null }, // [YANGI] Qaysi hamkorga tegishli
    balance_history: [{ date: Date, amount: Number, type: String, comment: String }],
    calculation_group_id: { type: String, default: null } // [YANGI] Hisob-kitob guruhi
});
const Haydovchi = mongoose.model('Haydovchi', HaydovchiSchema);

const BuyurtmaSchema = new mongoose.Schema({
    id: Number,
    telefon: String, ism: String,
    qayerdan: String, qayerga: String,
    stops: [{ address: String, lat: Number, lng: Number }], // [YANGI] Oraliq manzillar
    fromLat: Number, fromLng: Number,
    toLat: Number, toLng: Number,
    izoh: String,
    lat: Number, lng: Number,
    vaqt: String,
    narx: String,
    status: { type: String, default: 'yangi' },
    haydovchi: String,
    haydovchi_id: String,
    haydovchi_phone: String,
    arrived_time: { type: Date }, // [YANGI] Kutish vaqti uchun
    wait_cost: { type: Number, default: 0 } // [YANGI] Kutish narxi
});
const Buyurtma = mongoose.model('Buyurtma', BuyurtmaSchema);

const ManzilSchema = new mongoose.Schema({
    id: Number, nomi: String, manzil: String, lat: Number, lng: Number
});
const Manzil = mongoose.model('Manzil', ManzilSchema);

const SettingsSchema = new mongoose.Schema({
    id: { type: String, default: 'global' },
    surge_active: { type: Boolean, default: false },
    surge_multiplier: { type: Number, default: 1.0 },
    
    // [YANGI] Avto-Surge sozlamalari
    auto_surge: { type: Boolean, default: false },
    surge_threshold: { type: Number, default: 5 }, // Nechta zakaz kutib tursa
    surge_target: { type: Number, default: 1.5 }, // Qanchaga oshadi
    auto_heatmap: { type: Boolean, default: false }, // [YANGI] Avto Heatmap
    
    heat_zones: [{ id: Number, lat: Number, lng: Number, radius: Number }],
    company_commission: { type: Number, default: 0 } // [YANGI] Kompaniya ulushi (%)
});
const Settings = mongoose.model('Settings', SettingsSchema);

// [YANGI] Admin/Hodimlar Schemasi
const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'dispatcher', 'manager', 'partner'], default: 'dispatcher' },
    full_name: String,
    is_active: { type: Boolean, default: true }, // [YANGI] Bloklash uchun
    last_login: { type: String, default: '-' },   // [YANGI] Oxirgi kirish
    commission_percent: { type: Number, default: 0 }, // [YANGI] Hamkor ulushi (%)
    balance: { type: Number, default: 0 }, // [YANGI] Hamkor balansi

    // [YANGI] Dispetcher uchun maxsus maydonlar
    lastname: String,
    firstname: String,
    patronymic: String,
    service: String,
    phone: String,
    comment: String,
    
    // Ruxsatlar (Permissions)
    allow_sms: { type: Boolean, default: false },
    allow_set_driver: { type: Boolean, default: false },
    allow_reg_driver: { type: Boolean, default: false },
    allow_check_photo: { type: Boolean, default: false },
    allow_unblock_driver: { type: Boolean, default: false },
    allow_chat_templates: { type: Boolean, default: false },
    
    // [YANGI] Hamkor (Partner) uchun maxsus maydonlar
    partner_name: String, // Brend nomi (Haydovchida ko'rinadi)
    inn: String,          // STIR (INN)
    passport_serial: String, // Pasport Seriya
    jshshir: String,      // JSHSHIR

    // Cheklovlar (Restrictions)
    working_cities: String,
    working_services: String,
    working_queues: String,
    incoming_lines: String
});
const Admin = mongoose.model('Admin', AdminSchema);

// [YANGI] Rollar va Ruxsatlar
const RoleSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true }, // 'admin', 'partner'
    name: String, // 'Administrator', 'Hamkor'
    permissions: [String] // ['orders', 'drivers', 'reports']
});
const Role = mongoose.model('Role', RoleSchema);

// [YANGI] Tranzaksiyalar (Moliya)
const TransactionSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    order_id: Number,
    driver_id: String,
    partner_id: String,
    total_amount: Number,
    partner_share: Number,
    company_share: Number
});
const Transaction = mongoose.model('Transaction', TransactionSchema);

// [YANGI] Promokodlar
const PromoCodeSchema = new mongoose.Schema({
    id: Number, code: String, amount: Number, type: String // 'percent' or 'fixed'
});
const PromoCode = mongoose.model('PromoCode', PromoCodeSchema);

// [YANGI] Tizim Loglari
const LogSchema = new mongoose.Schema({
    id: Number,
    time: String,
    username: String,
    action: String,
    details: String
});
const Log = mongoose.model('Log', LogSchema);

// [YANGI] Smena (Grafik)
const ShiftSchema = new mongoose.Schema({
    id: Number, name: String, start: String, end: String, active: { type: Boolean, default: true }
});
const Shift = mongoose.model('Shift', ShiftSchema);

// [YANGI] Qo'ng'iroqlar (Calls)
const CallSchema = new mongoose.Schema({
    id: Number, type: String, phone: String, duration: String, status: String, date: { type: Date, default: Date.now }
});
const Call = mongoose.model('Call', CallSchema);

// [YANGI] Texnik yordam (Support)
const SupportSchema = new mongoose.Schema({
    id: Number, user_phone: String, subject: String, message: String, status: {type: String, default: 'open'}, date: { type: Date, default: Date.now }
});
const Support = mongoose.model('Support', SupportSchema);

// [YANGI] Calculation Groups (Hisob-kitob guruhlari)
const CalculationGroupSchema = new mongoose.Schema({
    id: Number,
    city: String,
    name: String,
    calculation_type: String,
    calculation_period: { type: Number, default: 1 },
    calculation_value: { type: Number, default: 0 },
    additional_calculation_value: { type: Number, default: 0 },
    blocking_threshold: { type: Number, default: 0 },
    trigger_threshold: { type: Number, default: 0 },
    compensate_to: { type: Number, default: 0 },
    paid_periods: { type: Number, default: 0 },
    free_periods: { type: Number, default: 0 },
    service: String,
    additional_calculation_type: String,
    contractor_group: String,
    self_order_group: String,
    cashless_group: String,
    consider_service: { type: Boolean, default: false },
    charge_no_orders: { type: Boolean, default: false },
    transition_group: String
});
const CalculationGroup = mongoose.model('CalculationGroup', CalculationGroupSchema);

// [YANGI] Haydovchi Harakat Tarixi
const DriverHistorySchema = new mongoose.Schema({
    driver_phone: String,
    date: String, // YYYY-MM-DD
    locations: [{ lat: Number, lng: Number, time: String }]
});
const DriverHistory = mongoose.model('DriverHistory', DriverHistorySchema);

// ==========================================
// 2. SOCKET.IO (YANGI FUNKSIYALAR QO'SHILDI)
// ==========================================

io.on('connection', (socket) => {
    console.log('⚡️ Socket ulandi: ' + socket.id);

    // 1. Haydovchi Liniyaga chiqdi (ONLINE)
    socket.on('driver_online', async (data) => {
        socket.join('active_drivers');
        try {
            // Telefon orqali topib statusini yangilaymiz
            if(data && data.phone) {
                await Haydovchi.findOneAndUpdate({ telefon: data.phone }, { status: 'online', socketId: socket.id });
                console.log("Haydovchi Online:", data.phone);
            }
            // Kutib turgan zakaz bo'lsa yuborish
            const orders = await Buyurtma.find({ status: 'yangi' });
            socket.emit('active_orders_list', orders);
        } catch(e) { console.error(e); }
    });

    // 2. [YANGI] Haydovchi Liniyadan ketdi (OFFLINE)
    socket.on('driver_offline', async (data) => {
        socket.leave('active_drivers');
        try {
            if(data && data.phone) {
                await Haydovchi.findOneAndUpdate({ telefon: data.phone }, { status: 'offline' });
                console.log("Haydovchi Offline:", data.phone);
            }
        } catch(e) { console.error(e); }
    });

   // 3. Zakazni qabul qilish
    socket.on('driver_accept_order', async (data) => {
        try {
            const order = await Buyurtma.findOne({ id: data.orderId });
            if (order && order.status === 'yangi') {
                // Haydovchi ma'lumotlarini olish
                const driver = await Haydovchi.findOne({ telefon: data.phone });
                
                order.status = 'accepted';
                order.haydovchi = driver ? (driver.firstname + " " + driver.lastname) : "Haydovchi";
                order.haydovchi_phone = data.phone;
                order.haydovchi_id = driver ? driver._id : null;
                
                await order.save();

                // [YANGI QO'SHILGAN QATOR] Haydovchini shu zakaz xonasiga qo'shamiz
                const roomName = "order_" + order.id;
                socket.join(roomName); 

                socket.emit('order_accepted_success', order);
                
                // Boshqa haydovchilardan olib tashlash
                socket.broadcast.emit('remove_order', order.id);

                // MIJOZGA XABAR YUBORISH (driver_found)
                io.to(roomName).emit('driver_found', {
                    driver: driver ? (driver.firstname + " " + driver.lastname) : "Haydovchi",
                    phone: driver ? driver.telefon : "",
                    car_model: driver ? (driver.marka + " " + driver.model) : "Avtomobil",
                    car_plate: driver ? driver.raqam : "",
                    car_color: driver ? driver.rang : "",
                    rating: driver ? driver.reyting : 5.0,
                    driverLat: driver ? driver.lat : null,
                    driverLng: driver ? driver.lng : null
                });
                
                // Ehtiyot shart: Agar mijoz xonaga ulanmagan bo'lsa, umumiy kanalga ham yuboramiz (mijoz o'zi filtrlaydi)
                io.emit('order_status_change_global', { orderId: order.id, status: 'accepted', driverData: { ...driver._doc } });

            } else {
                socket.emit('error_msg', "Bu zakaz allaqachon olingan!");
            }
        } catch (err) { console.error(err); }
    });

// ...

    // 4. Status O'zgartirish
    socket.on('driver_update_status', async (data) => {
        try {
            const order = await Buyurtma.findOne({ id: data.orderId });
            if (order) {
                order.status = data.status;
                if (data.status === 'arrived') {
                    order.arrived_time = new Date(); // [YANGI] Yetib kelgan vaqtni saqlash
                }
                
                // [YANGI] Agar status 'started' bo'lsa, kutish pulini hisoblaymiz
                if (data.status === 'started' && order.arrived_time) {
                    const diffMs = new Date() - new Date(order.arrived_time);
                    const waitMinutes = Math.floor(diffMs / 60000); // Daqiqaga o'tkazish
                    const freeMinutes = 3; // 3 daqiqa tekin
                    const costPerMinute = 500; // Har daqiqa 500 so'm

                    if (waitMinutes > freeMinutes) {
                        const extraMinutes = waitMinutes - freeMinutes;
                        const addedCost = extraMinutes * costPerMinute;
                        
                        // Narxni yangilash (Masalan: "15 000 so'm" -> raqamga o'tkazib qo'shamiz)
                        let currentPrice = parseInt(order.narx.replace(/\D/g, '')) || 0;
                        let newPrice = currentPrice + addedCost;
                        
                        order.narx = newPrice.toLocaleString('ru-RU').replace(/,/g, ' ') + " so'm";
                        order.wait_cost = addedCost;
                    }
                }

                await order.save();
                io.emit('order_status_update', {
                    orderId: order.id, 
                    status: data.status, 
                    narx: order.narx, // [YANGI] Yangilangan narxni yuborish
                    message: getStatusMessage(data.status),
                    // [YANGI] Marshrut chizish uchun koordinatalar
                    fromLat: order.fromLat, fromLng: order.fromLng,
                    toLat: order.toLat, toLng: order.toLng,
                    stops: order.stops
                });

                // [YANGI] Buyurtma tugaganda Moliya hisob-kitobi
                if (data.status === 'finished') {
                    const driver = await Haydovchi.findOne({ telefon: order.haydovchi_phone });
                    if (driver) {
                        const price = parseInt(order.narx.replace(/\D/g, '')) || 0;
                        
                        // 1. Kompaniya ulushi (Global sozlamalardan)
                        const settings = await Settings.findOne({ id: 'global' });
                        const compPercent = settings ? (settings.company_commission || 0) : 0;
                        const cShare = Math.floor(price * compPercent / 100);

                        // 2. Hamkor ulushi (Agar haydovchi hamkorga tegishli bo'lsa)
                        let pShare = 0;
                        let partnerId = null;

                        if (driver.partner_id) {
                            const partner = await Admin.findById(driver.partner_id);
                            if (partner) {
                                partnerId = partner._id;
                                const partPercent = partner.commission_percent || 0;
                                pShare = Math.floor(price * partPercent / 100);
                                
                                // Hamkor balansiga tushirish
                                partner.balance = (partner.balance || 0) + pShare;
                                await partner.save();
                            }
                        }

                        // 3. Haydovchidan yechish (Jami: Kompaniya + Hamkor)
                        const totalDeduct = cShare + pShare;
                        driver.balans -= totalDeduct;
                        
                        // Tarixga yozish
                        driver.balance_history.push({
                            date: new Date(),
                            amount: -totalDeduct,
                            type: 'commission',
                            comment: `Buyurtma #${order.id} (Komp: ${cShare}, Hamkor: ${pShare})`
                        });
                        
                        await driver.save();
                        
                        // Tranzaksiya yaratish
                        await new Transaction({
                            order_id: order.id, driver_id: driver.telefon, partner_id: partnerId,
                            total_amount: price, partner_share: pShare, company_share: cShare
                        }).save();
                    }
                }
            }
        } catch (err) { console.error(err); }
    });

    // 5. Jonli Joylashuv
    socket.on('driver_location', async (coords) => {
        io.emit('live_tracking', coords);
        if(coords.id) {
            await Haydovchi.findOneAndUpdate({ telefon: coords.id }, { lat: coords.lat, lng: coords.lng });
            
            // [YANGI] Tarixni saqlash
            try {
                const today = new Date().toISOString().split('T')[0];
                const time = new Date().toLocaleTimeString('uz-UZ', {hour12: false});
                await DriverHistory.updateOne(
                    { driver_phone: coords.id, date: today },
                    { $push: { locations: { lat: coords.lat, lng: coords.lng, time: time } } },
                    { upsert: true }
                );
            } catch(e) { console.error("History save error:", e); }
        }
    });

   // 6. Buyurtmani bekor qilish (Mijoz tomonidan)
    socket.on('cancel_order', async (orderId) => {
        try {
            const order = await Buyurtma.findOne({ id: orderId });
            if (order) {
                order.status = 'cancelled';
                await order.save();

                // [ESKI KODNI O'CHIRING YOKI ALMASHTIRING]
                // Eski kod faqat socketId ga qarab yuborar edi.
                // Biz endi to'g'ridan-to'g'ri XONAGA (ROOM) yuboramiz.
                
                // [YANGI KOD] Shu zakazga tegishli barchaga (Mijoz va Haydovchiga) xabar yuborish
                // io.to("order_" + orderId).emit('order_cancelled', orderId);
                io.emit('order_cancelled', orderId); // TUZATILDI: Hammaga yuborish (ishonchliroq)
                
                // Barcha haydovchilardan (ro'yxatdan) olib tashlash
                io.emit('remove_order', orderId);
                
                socket.emit('order_cancelled_success');
            }
        } catch (e) { console.error(e); }
    });

    // Chat va boshqalar...
    socket.on('join_chat', (orderId) => { socket.join("order_" + orderId); });
    socket.on('send_message', (data) => { io.to("order_" + data.orderId).emit('receive_message', data); });
});

// [YANGI] Heatmap zonalarni hisoblash funksiyasi (Clustering)
function generateHeatmapZones(orders) {
    const zones = [];
    const processed = new Set();
    const RADIUS_KM = 1.0; // 1 km radius ichida
    const MIN_ORDERS = 2;  // Kamida 2 ta zakaz bo'lsa zona yaratiladi

    for (let i = 0; i < orders.length; i++) {
        if (processed.has(i)) continue;
        const center = orders[i];
        const cluster = [center];
        processed.add(i);

        for (let j = i + 1; j < orders.length; j++) {
            if (processed.has(j)) continue;
            const other = orders[j];
            const dist = getDistKm(center.fromLat, center.fromLng, other.fromLat, other.fromLng);
            if (dist <= RADIUS_KM) {
                cluster.push(other);
                processed.add(j);
            }
        }

        if (cluster.length >= MIN_ORDERS) {
            let sumLat = 0, sumLng = 0;
            cluster.forEach(o => { sumLat += o.fromLat; sumLng += o.fromLng; });
            zones.push({
                id: Date.now() + Math.random(),
                lat: sumLat / cluster.length,
                lng: sumLng / cluster.length,
                radius: 500 + (cluster.length * 100) // Zakaz ko'p bo'lsa zona kattalashadi
            });
        }
    }
    return zones;
}

// [YANGI] Log yozish funksiyasi
async function logAction(username, action, details) {
    try {
        const log = new Log({
            id: Date.now(),
            time: new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }),
            username: username || 'Tizim',
            action: action,
            details: details || ''
        });
        await log.save();
    } catch(e) { console.error("Log yozishda xato:", e); }
}

// ==========================================
// 3. API YO'LLARI (HAMMASI TURIBDI + YANGILARI)
// ==========================================

// [YANGI] Admin: Barcha haydovchilarga xabar yuborish
app.post('/api/admin/broadcast', async (req, res) => {
    const { message } = req.body;
    io.to('active_drivers').emit('admin_message', message);
    logAction("Admin", "Umumiy xabar", message);
    res.json({ success: true });
});

// [YANGI] Admin: Haydovchi statusini o'zgartirish (Arxivdan chiqarish/Bloklash)
app.post('/api/admin/driver/status', async (req, res) => {
    const { id, status } = req.body;
    try {
        await Haydovchi.findByIdAndUpdate(id, { status: status });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: "Xatolik" }); }
});

// [YANGI] Admin: Haydovchi balansini to'ldirish
app.post('/api/admin/driver/balance', async (req, res) => {
    const { driverId, amount, comment } = req.body;
    try {
        const driver = await Haydovchi.findById(driverId);
        if (!driver) return res.status(404).json({ error: "Haydovchi topilmadi" });

        const val = parseInt(amount);
        driver.balans += val;
        
        // Tarixga yozish (bugungi kunga qo'shib qo'yamiz)
        if (val > 0) { // Faqat kirim bo'lsa daromadga qo'shamiz
            const today = new Date().toLocaleDateString("ru-RU").substring(0, 5);
            const lastEntry = driver.daromad_tarixi[driver.daromad_tarixi.length - 1];
            if (lastEntry && lastEntry.sana.includes(today)) {
                lastEntry.summa += val;
            } else {
                driver.daromad_tarixi.push({ sana: today, summa: val });
            }
        }
        
        // [YANGI] Balans tarixiga yozish
        driver.balance_history.push({
            date: new Date(),
            amount: val,
            type: val > 0 ? 'topup' : 'deduct',
            comment: comment || (val > 0 ? 'Admin tomonidan' : 'Jarima/Yechish')
        });

        await driver.save();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Xatolik" });
    }
});

// [YANGI] Admin: Hamkor balansini boshqarish
app.post('/api/admin/partner/balance', async (req, res) => {
    const { partnerId, amount } = req.body;
    try {
        const partner = await Admin.findById(partnerId);
        if (!partner) return res.status(404).json({ error: "Hamkor topilmadi" });
        partner.balance = (partner.balance || 0) + parseInt(amount);
        await partner.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Xatolik" }); }
});

// [YANGI] Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    // Dastlabki Ega (Owner) ni yaratish (agar baza bo'sh bo'lsa)
    const count = await Admin.countDocuments();
    if (count === 0 && username === 'admin' && password === 'admin') {
        const owner = new Admin({ username: 'admin', password: 'admin', role: 'owner', full_name: 'Tizim Egasi' });
        await owner.save();
        return res.json({ success: true, admin: { id: owner._id, username: owner.username, role: owner.role, name: owner.full_name } });
    }

    const admin = await Admin.findOne({ username, password });
    if(admin) {
        if (admin.is_active === false) return res.json({ success: false, error: "Profil bloklangan!" });
        
        admin.last_login = new Date().toLocaleString("uz-UZ");
        logAction(admin.username, "Kirish", "Admin panelga kirdi");
        await admin.save();
        
        res.json({ success: true, admin: { id: admin._id, username: admin.username, role: admin.role, name: admin.full_name, commission: admin.commission_percent, balance: admin.balance } });
    } else {
        res.json({ success: false, error: "Login yoki parol xato" });
    }
});

// [YANGI] Admin parolini o'zgartirish
app.post('/api/admin/change-password', async (req, res) => {
    const { id, oldPassword, newPassword } = req.body;
    try {
        const admin = await Admin.findById(id);
        if (!admin) return res.json({ success: false, error: "Admin topilmadi" });

        if (admin.password !== oldPassword) {
            return res.json({ success: false, error: "Eski parol noto'g'ri" });
        }

        admin.password = newPassword;
        await admin.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Xatolik" }); }
});

// [YANGI] Hodimlar boshqaruvi
app.get('/api/admin/staff', async (req, res) => { res.json(await Admin.find({}, '-password')); });
app.post('/api/admin/staff', async (req, res) => { 
    try { 
        if(req.body.id && req.body.id !== "null") {
            await Admin.findByIdAndUpdate(req.body.id, req.body); // Tahrirlash
            logAction("Admin", "Hodim tahrirlandi", req.body.username);
        } else {
            // ID ni olib tashlaymiz, agar u null bo'lsa (yangi qo'shishda)
            if (req.body.id === null || req.body.id === "null") delete req.body.id;
            await new Admin(req.body).save(); // Yangi qo'shish
            logAction("Admin", "Hodim qo'shildi", req.body.username);
        }
        res.json({ success: true }); 
    } catch(e) { console.error(e); res.status(500).json({ error: "Xatolik: " + e.message }); } 
});
app.delete('/api/admin/staff/:id', async (req, res) => { 
    await Admin.findByIdAndDelete(req.params.id); 
    logAction("Admin", "Hodim o'chirildi", "ID: " + req.params.id);
    res.json({ success: true }); 
});

// [YANGI] Hamkor Statistikasi API
app.get('/api/partner/stats', async (req, res) => {
    const { partner_id } = req.query;
    if (!partner_id) return res.json({});

    try {
        const drivers = await Haydovchi.find({ partner_id });
        const totalDrivers = drivers.length;
        const activeDrivers = drivers.filter(d => d.status === 'online').length;
        
        const partner = await Admin.findById(partner_id);
        const balance = partner ? partner.balance : 0;

        // Bugungi daromad (Tranzaksiyalardan)
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        
        const transactions = await Transaction.find({ 
            partner_id, 
            date: { $gte: startOfDay } 
        });
        
        const todayIncome = transactions.reduce((sum, t) => sum + (t.partner_share || 0), 0);

        res.json({
            totalDrivers,
            activeDrivers,
            balance,
            todayIncome,
            commission_percent: partner ? partner.commission_percent : 0 // [YANGI]
        });
    } catch (e) { res.status(500).json({ error: "Xatolik" }); }
});

// [YANGI] Hamkor uchun buyurtmalar tarixi (Mijoz raqami yashirilgan)
app.get('/api/partner/orders', async (req, res) => {
    const { partner_id } = req.query;
    if (!partner_id) return res.json([]);

    try {
        // Hamkorga tegishli haydovchilarni topamiz
        const drivers = await Haydovchi.find({ partner_id });
        const driverPhones = drivers.map(d => d.telefon);

        // Shu haydovchilar bajargan buyurtmalarni olamiz
        const orders = await Buyurtma.find({ haydovchi_phone: { $in: driverPhones } }).sort({_id: -1}).limit(100);

        // Mijoz telefonini yashirish
        const safeOrders = orders.map(o => {
            const safePhone = o.telefon ? o.telefon.substring(0, 7) + "*** ** " + o.telefon.substring(11) : "Yashirilgan";
            return { ...o.toObject(), telefon: safePhone };
        });

        res.json(safeOrders);
    } catch (e) { res.status(500).json({ error: "Xatolik" }); }
});

// ==========================================
// TIKLANGAN API YO'LLARI (CORE)
// ==========================================

// --- 1. MIJOZLAR API ---
app.get('/api/admin/users', async (req, res) => res.json(await Mijoz.find()));

// --- 2. BUYURTMALAR (ORDERS) API ---
app.get('/api/orders', async (req, res) => res.json(await Buyurtma.find().sort({_id:-1})));
app.post('/api/orders', async (req, res) => { 
    const yangi = new Buyurtma({ 
        id: Date.now(), 
        telefon: req.body.phone,
        ism: req.body.name,
        qayerdan: req.body.from,
        qayerga: req.body.to,
        izoh: req.body.comment,
        fromLat: req.body.fromLat, fromLng: req.body.fromLng,
        toLat: req.body.toLat, toLng: req.body.toLng,
        stops: req.body.stops,
        narx: req.body.narx,
        status: 'yangi', 
        vaqt: new Date().toLocaleTimeString("uz-UZ", {hour: '2-digit', minute:'2-digit'}) 
    });
    await yangi.save();
    
    // Smart Dispatch Logic
    try {
        const drivers = await Haydovchi.find({ status: 'online' });
        const closeDrivers = drivers.filter(doc => {
            const dist = getDistKm(req.body.fromLat, req.body.fromLng, doc.lat, doc.lng);
            return dist <= 2.0;
        });

        if (closeDrivers.length > 0) {
            closeDrivers.forEach(d => io.to(d.socketId).emit('yangi_buyurtma', yangi));
        }

        setTimeout(async () => {
            const orderCheck = await Buyurtma.findOne({ id: yangi.id });
            if (orderCheck && orderCheck.status === 'yangi') {
                const mediumDrivers = drivers.filter(doc => {
                    const dist = getDistKm(req.body.fromLat, req.body.fromLng, doc.lat, doc.lng);
                    return dist > 2.0 && dist <= 5.0;
                });
                mediumDrivers.forEach(d => io.to(d.socketId).emit('yangi_buyurtma', yangi));
            }
        }, 10000);

        setTimeout(async () => {
            const orderCheck = await Buyurtma.findOne({ id: yangi.id });
            if (orderCheck && orderCheck.status === 'yangi') {
                io.emit('yangi_buyurtma', yangi);
            }
        }, 20000);

    } catch (e) { 
        console.error(e); 
        io.emit('yangi_buyurtma', yangi);
    }

    res.json({ success: true, order: yangi });
});

// --- 3. HAYDOVCHILAR (DRIVERS) API ---
app.get('/api/drivers', async (req, res) => res.json(await Haydovchi.find()));
app.post('/api/drivers', async (req, res) => { 
    try {
        if (req.body._id) {
            await Haydovchi.findByIdAndUpdate(req.body._id, req.body);
        } else {
            await new Haydovchi({ id: Date.now(), ...req.body }).save(); 
        }
        res.json({ success: true }); 
    } catch(e) { res.status(500).json({ error: "Xatolik" }); }
});
app.post('/api/driver/login', async (req, res) => {
    const { phone, code } = req.body;
    const driver = await Haydovchi.findOne({ telefon: phone });
    
    if(driver) {
        if (driver.status === 'blocked') return res.json({ success: false, error: "Siz bloklangansiz! Admin bilan bog'laning." });
        
        // [YANGI] Kodni tekshirish
        if (code) {
            if (otpStore[phone] == code || code === '7777') { // 7777 - Test uchun
                delete otpStore[phone];
                const activeOrder = await Buyurtma.findOne({ 
                    haydovchi_phone: driver.telefon, 
                    status: { $in: ['accepted', 'arrived', 'started'] } 
                });
                return res.json({ success: true, driver, activeOrder });
            } else {
                return res.json({ success: false, error: "Tasdiqlash kodi noto'g'ri!" });
            }
        } else {
            // Kod yuborish
            const generatedCode = Math.floor(1000 + Math.random() * 9000);
            otpStore[phone] = generatedCode;
            sendSMS(phone, `Taxi Pro: Sizning kodingiz: ${generatedCode}`);
            return res.json({ success: false, requireOtp: true });
        }
    } else {
        res.json({ success: false, error: "Bunday haydovchi topilmadi" });
    }
});
app.get('/api/driver/profile', async (req, res) => {
    const driver = await Haydovchi.findOne({ telefon: req.query.phone });
    res.json(driver || { error: 'Not found' });
});
app.post('/api/driver/rate', async (req, res) => {
    const { orderId, rating, comment } = req.body;
    try {
        const order = await Buyurtma.findOne({ id: orderId });
        if(!order) return res.json({success: false});
        const driver = await Haydovchi.findOne({ telefon: order.haydovchi_phone });
        if(driver) {
            const currentTotal = driver.reyting * driver.rating_count;
            driver.rating_count += 1;
            driver.reyting = (currentTotal + rating) / driver.rating_count;
            driver.reyting = Math.round(driver.reyting * 10) / 10;
            await driver.save();
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: "Xatolik" }); }
});

// --- 4. MANZILLAR (ADDRESS) API ---
app.get('/api/addresses', async (req, res) => res.json(await Manzil.find()));
app.post('/api/addresses', async (req, res) => { await new Manzil({ id: Date.now(), ...req.body }).save(); res.json({ success: true }); });
app.delete('/api/addresses/:id', async (req, res) => { await Manzil.findOneAndDelete({ id: req.params.id }); res.json({ success: true }); });

// --- 5. HUDUDLAR (REGIONS) API ---
app.get('/api/regions', async (req, res) => res.json(await Region.find()));
app.post('/api/regions', async (req, res) => { await new Region({ id: Date.now(), ...req.body }).save(); res.json({ success: true }); });
app.delete('/api/regions/:id', async (req, res) => { await Region.findOneAndDelete({ id: req.params.id }); res.json({ success: true }); });

// --- 6. XIZMATLAR (SERVICES) API ---
app.get('/api/services', async (req, res) => res.json(await Service.find()));
app.post('/api/services', async (req, res) => { await new Service({ id: Date.now(), ...req.body }).save(); res.json({ success: true }); });
app.delete('/api/services/:id', async (req, res) => { await Service.findOneAndDelete({ id: req.params.id }); res.json({ success: true }); });

// --- 7. TEGLAR (TAGS) API ---
app.get('/api/tags', async (req, res) => res.json(await Tag.find()));
app.post('/api/tags', async (req, res) => { await new Tag({ id: Date.now(), ...req.body }).save(); res.json({ success: true }); });
app.delete('/api/tags/:id', async (req, res) => { await Tag.findOneAndDelete({ id: req.params.id }); res.json({ success: true }); });

// --- 8. TARIFLAR (TARIFFS) API ---
app.get('/api/tariffs', async (req, res) => res.json(await Tarif.find()));
app.post('/api/tariffs', async (req, res) => { await new Tarif({ id: Date.now(), ...req.body }).save(); res.json({ success: true }); });
app.put('/api/tariffs/:id', async (req, res) => { await Tarif.findOneAndUpdate({ id: req.params.id }, req.body); res.json({ success: true }); });
app.delete('/api/tariffs/:id', async (req, res) => { await Tarif.findOneAndDelete({ id: req.params.id }); res.json({ success: true }); });

// --- 9. SOZLAMALAR (SETTINGS) API ---
app.get('/api/settings', async (req, res) => {
    let s = await Settings.findOne({ id: 'global' });
    if(!s) { s = new Settings(); await s.save(); }
    res.json(s);
});
app.post('/api/settings/surge', async (req, res) => {
    await Settings.findOneAndUpdate({ id: 'global' }, { 
        auto_surge: req.body.auto_surge,
        surge_threshold: req.body.threshold,
        surge_target: req.body.target,
        auto_heatmap: req.body.auto_heatmap
    }, { upsert: true });
    res.json({ success: true });
});

// [YANGI] Kompaniya ulushini saqlash
app.post('/api/settings/commission', async (req, res) => {
    await Settings.findOneAndUpdate({ id: 'global' }, { 
        company_commission: req.body.company_commission
    }, { upsert: true });
    res.json({ success: true });
});

app.post('/api/settings/heatzone', async (req, res) => {
    await Settings.findOneAndUpdate({ id: 'global' }, { $push: { heat_zones: { id: Date.now(), ...req.body } } }, { upsert: true });
    res.json({ success: true });
});
app.delete('/api/settings/heatzone/:id', async (req, res) => {
    await Settings.findOneAndUpdate({ id: 'global' }, { $pull: { heat_zones: { id: Number(req.params.id) } } });
    res.json({ success: true });
});

// --- 10. GEOCODING & SEARCH API ---
app.get('/api/geocoding', (req, res) => {
    const { lat, lng } = req.query;
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    https.get(url, { headers: { 'User-Agent': 'TaxiPro/1.0' } }, (resp) => {
        let data = ''; resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => { try { res.json(JSON.parse(data)); } catch(e) { res.json({ error: "Parse error" }); } });
    }).on("error", (err) => { res.json({ error: err.message }); });
});

app.get('/api/search', (req, res) => {
    const { q } = req.query;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
    https.get(url, { headers: { 'User-Agent': 'TaxiPro/1.0' } }, (resp) => {
        let data = ''; resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => { try { res.json(JSON.parse(data)); } catch(e) { res.json([]); } });
    }).on("error", (err) => { res.json([]); });
});

// [YANGI] Rollar API
app.get('/api/admin/roles', async (req, res) => res.json(await Role.find()));
app.post('/api/admin/roles', async (req, res) => { 
    await Role.findOneAndUpdate({ slug: req.body.slug }, req.body, { upsert: true }); res.json({ success: true }); 
});
app.delete('/api/admin/roles/:id', async (req, res) => { await Role.findByIdAndDelete(req.params.id); res.json({ success: true }); });

// [YANGI] Moliya (Tranzaksiyalar)
app.get('/api/admin/transactions', async (req, res) => {
    const { partner_id } = req.query;
    let query = {};
    if (partner_id) {
        query.partner_id = partner_id;
    }
    const transactions = await Transaction.find(query).sort({ date: -1 }).limit(100);
    res.json(transactions);
});

// [YANGI] Batafsil Hisobotlar API (Excel uchun)
app.get('/api/admin/reports/detailed', async (req, res) => {
    try {
        const drivers = await Haydovchi.find();
        
        // Sanalar ro'yxatini tayyorlash
        const today = new Date();
        const last7Days = [];
        const last30Days = [];

        for(let i=0; i<30; i++) {
            const d = new Date(); d.setDate(today.getDate() - i);
            const dateStr = d.toLocaleDateString("ru-RU").substring(0, 5); // DD.MM
            last30Days.push(dateStr);
            if(i < 7) last7Days.push(dateStr);
        }

        const report = drivers.map(d => {
            const history = d.daromad_tarixi || [];
            return {
                name: (d.firstname || '') + ' ' + (d.lastname || ''),
                phone: d.telefon,
                car: (d.marka || '') + ' (' + (d.raqam || '') + ')',
                daily: history.find(h => h.sana === last7Days[0])?.summa || 0,
                weekly: history.filter(h => last7Days.includes(h.sana)).reduce((a, b) => a + b.summa, 0),
                monthly: history.filter(h => last30Days.includes(h.sana)).reduce((a, b) => a + b.summa, 0),
                balance: d.balans
            };
        });
        
        res.json(report);
    } catch(e) { console.error(e); res.status(500).json({error: "Xatolik"}); }
});

// [YANGI] Loglarni olish API
app.get('/api/admin/logs', async (req, res) => res.json(await Log.find().sort({_id:-1}).limit(200)));

// [YANGI] SMS Loglarini olish API
app.get('/api/admin/sms-logs', async (req, res) => {
    try {
        const logs = await SmsLog.find().sort({ date: -1 }).limit(200);
        res.json(logs);
    } catch(e) { res.status(500).json({ error: "Xatolik" }); }
});

// [YANGI] Backuplarni boshqarish API (MongoDB JSON Dump)
const BACKUP_DIR = path.join(__dirname, '../backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

app.get('/api/admin/backups', (req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR).map(file => {
            const stats = fs.statSync(path.join(BACKUP_DIR, file));
            return { name: file, size: (stats.size / 1024).toFixed(2) + ' KB', date: stats.mtime };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(files);
    } catch (e) { res.status(500).json({ error: "Xatolik" }); }
});

app.post('/api/admin/backups/restore', async (req, res) => {
    const { filename } = req.body;
    const backupPath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(backupPath)) {
        try {
            const raw = fs.readFileSync(backupPath, 'utf8');
            const data = JSON.parse(raw);
            
            // Bazani tozalash va qayta yozish
            await Promise.all([
                Admin.deleteMany({}), Haydovchi.deleteMany({}), Buyurtma.deleteMany({}),
                Region.deleteMany({}), Tarif.deleteMany({}), Service.deleteMany({}),
                Tag.deleteMany({}), Manzil.deleteMany({}), Settings.deleteMany({}),
                Role.deleteMany({}), Transaction.deleteMany({}), PromoCode.deleteMany({})
            ]);

            if(data.admins) await Admin.insertMany(data.admins);
            if(data.drivers) await Haydovchi.insertMany(data.drivers);
            if(data.orders) await Buyurtma.insertMany(data.orders);
            if(data.regions) await Region.insertMany(data.regions);
            if(data.tariffs) await Tarif.insertMany(data.tariffs);
            if(data.services) await Service.insertMany(data.services);
            if(data.tags) await Tag.insertMany(data.tags);
            if(data.addresses) await Manzil.insertMany(data.addresses);
            if(data.settings) await Settings.insertMany(data.settings);
            if(data.roles) await Role.insertMany(data.roles);
            if(data.transactions) await Transaction.insertMany(data.transactions);
            if(data.promocodes) await PromoCode.insertMany(data.promocodes);

            logAction("Admin", "Backup tiklandi", filename);
            res.json({ success: true });
        } catch (e) { console.error(e); res.status(500).json({ error: "Tiklashda xatolik" }); }
    } else {
        res.status(404).json({ error: "Fayl topilmadi" });
    }
});

// Avtomatik Backup (Har 1 soatda)
setInterval(async () => {
    try {
        await createBackup();
    } catch(e) { console.error("Auto Backup Error:", e); }
}, 60 * 60 * 1000);


// [YANGI] Haydovchi: O'z tarixini ko'rish
app.get('/api/driver/orders-history', async (req, res) => {
    const { phone } = req.query;
    if(!phone) return res.json([]);
    // Shu haydovchi bajargan va tugatgan zakazlar
    const orders = await Buyurtma.find({ haydovchi_phone: phone, status: 'finished' }).sort({_id: -1}).limit(20);
    res.json(orders);
});

// [YANGI] Mijoz: Buyurtma tarixi
app.get('/api/client/orders', async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.json([]);
    const orders = await Buyurtma.find({ $or: [{ telefon: phone }, { phone: phone }] }).sort({ _id: -1 }).limit(50);
    res.json(orders);
});

// [YANGI] Mijoz Login (server.js dan ko'chirildi)
app.post('/api/login', async (req, res) => {
    const { phone, code } = req.body;
    if (!phone) return res.status(400).json({ message: "Raqam yo'q" });

    // [YANGI] Kodni tekshirish
    if (code) {
        if (otpStore[phone] == code || code === '7777') {
            delete otpStore[phone];
            let user = await Mijoz.findOne({ phone });
            if (!user) {
                user = new Mijoz({ id: Date.now(), phone: phone, date: new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }) });
                await user.save();
            }
            console.log("Mijoz kirdi:", phone);
            return res.json({ success: true });
        } else {
            return res.json({ success: false, error: "Kod noto'g'ri!" });
        }
    }

    // Kod yuborish
    const generatedCode = Math.floor(1000 + Math.random() * 9000);
    otpStore[phone] = generatedCode;
    sendSMS(phone, `Taxi Pro: Tasdiqlash kodi: ${generatedCode}`);
    res.json({ success: false, requireOtp: true });
});

// [YANGI] SMPP Test API
app.post('/api/test/sms', (req, res) => {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: "Telefon raqam kiritilmadi" });
    if (!smppSession) return res.status(500).json({ error: "SMPP serverga ulanmagan" });

    smppSession.submit_sm({
        source_addr: '+998939001069',
        destination_addr: phone,
        short_message: message || "Taxi Pro: Test SMS",
        source_addr_ton: 0,
        source_addr_npi: 1,
        dest_addr_ton: 0,
        dest_addr_npi: 1,
    }, (pdu) => {
        if (pdu.command_status === 0) res.json({ success: true, message: "SMS muvaffaqiyatli yuborildi" });
        else res.status(500).json({ success: false, error: "SMS yuborishda xatolik", code: pdu.command_status });
    });
});

// [YANGI] Promokodlar API
app.get('/api/promocodes', async (req, res) => res.json(await PromoCode.find()));
app.post('/api/promocodes', async (req, res) => {
    await new PromoCode({ id: Date.now(), ...req.body }).save();
    logAction("Admin", "Promokod qo'shildi", req.body.code);
    res.json({ success: true });
});
app.delete('/api/promocodes/:id', async (req, res) => {
    await PromoCode.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
});
app.post('/api/promocodes/validate', async (req, res) => {
    const { code } = req.body;
    const promo = await PromoCode.findOne({ code });
    if (promo) res.json({ success: true, promo });
    else res.json({ success: false });
});

// [YANGI] Calculation Groups API (TUZATILDI)
app.get('/api/calculation-groups', async (req, res) => res.json(await CalculationGroup.find()));
app.post('/api/calculation-groups', async (req, res) => {
    try {
        if(req.body._id) {
            await CalculationGroup.findByIdAndUpdate(req.body._id, req.body);
        } else {
            await new CalculationGroup({ id: Date.now(), ...req.body }).save();
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: "Xatolik" }); }
});
app.delete('/api/calculation-groups/:id', async (req, res) => {
    try {
        await CalculationGroup.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: "Xatolik" }); }
});

// [YANGI] Haydovchi tarixi API
app.get('/api/admin/driver/history', async (req, res) => {
    const { phone, date } = req.query;
    try {
        const history = await DriverHistory.findOne({ driver_phone: phone, date: date });
        res.json(history ? history.locations : []);
    } catch(e) { res.status(500).json([]); }
});

// ==========================================
// YORDAMCHI FUNKSIYALAR VA SERVERNI ISHGA TUSHIRISH
// ==========================================

// [YANGI] Masofa hisoblash funksiyasi
function getDistKm(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// [YANGI] Status xabarlari
function getStatusMessage(status) {
    if (status === 'accepted') return "Mijozga haydovchi topildi";
    if (status === 'arrived') return "🚖 Haydovchi yetib keldi!";
    if (status === 'started') return "🚀 Yo'lga chiqdik!";
    if (status === 'finished') return "✅ Manzilga yetdingiz.";
    if (status === 'cancelled') return "❌ Buyurtma bekor qilindi.";
    return "";
}

// [YANGI] Backup yaratish funksiyasi
async function createBackup() {
    const data = {
        admins: await Admin.find(),
        drivers: await Haydovchi.find(),
        orders: await Buyurtma.find(),
        regions: await Region.find(),
        tariffs: await Tarif.find(),
        services: await Service.find(),
        tags: await Tag.find(),
        addresses: await Manzil.find(),
        settings: await Settings.find(),
        roles: await Role.find(),
        transactions: await Transaction.find(),
        promocodes: await PromoCode.find(),
        calculationGroups: await CalculationGroup.find()
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `mongo-backup-${timestamp}.json`);
    try {
        fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
        console.log(`📦 Backup yaratildi: ${backupFile}`);
    } catch(e) { console.error("Backup yozishda xatolik:", e); }
}

// [YANGI] Sahifa yo'llari (ROUTES)
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../client', 'admin.html')));
app.get('/driver', (req, res) => res.sendFile(path.join(__dirname, '../client', 'driver.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client', 'index.html')));

// SERVERNI ISHGA TUSHIRISH
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { 
    console.log(`✅ SERVER ISHLADI: http://localhost:${PORT}`);
    console.log(`🔧 Admin Panel: http://localhost:${PORT}/admin`);

    // [YANGI] Serverni uxlab qolishdan saqlash (Keep-Alive)
    // Render.com bepul rejasida har 14 daqiqada o'ziga so'rov yuboradi
    if (process.env.RENDER_EXTERNAL_URL) {
        const interval = 14 * 60 * 1000; // 14 daqiqa
        setInterval(() => {
            https.get(process.env.RENDER_EXTERNAL_URL + '/favicon.ico', (resp) => {
                console.log('⏰ Keep-Alive ping yuborildi');
            }).on('error', (err) => {
                console.error('Keep-Alive xatosi:', err.message);
            });
        }, interval);
    }
});

// [YANGI] Orqa fon vazifalari (Baza ulangandan keyin ishlaydi)
function startBackgroundTasks() {
    // 1. AVTO-SURGE TEKSHIRUVCHI (Har 5 soniyada)
    setInterval(async () => {
        try {
            const settings = await Settings.findOne({ id: 'global' });
            if (settings && settings.auto_surge) {
                const pendingCount = await Buyurtma.countDocuments({ status: 'yangi' });
                
                let newActive = false;
                let newMult = 1.0;

                if (pendingCount >= settings.surge_threshold) {
                    newActive = true;
                    newMult = settings.surge_target;
                }

                if (settings.surge_active !== newActive || settings.surge_multiplier !== newMult) {
                    settings.surge_active = newActive;
                    settings.surge_multiplier = newMult;
                    await settings.save();
                    
                    io.emit('surge_update', { active: newActive, multiplier: newMult });
                    console.log(`🔄 Auto-Surge: ${newActive ? 'ON' : 'OFF'} (Kutayotgan: ${pendingCount})`);
                }

                if (settings.auto_heatmap) {
                    const orders = await Buyurtma.find({ status: 'yangi' });
                    const newZones = generateHeatmapZones(orders);
                    settings.heat_zones = newZones;
                    await settings.save();
                    io.emit('heatmap_update', newZones);
                }
            }
        } catch (e) { console.error("Auto Surge Error:", e); }
    }, 5000);

    // 2. Avtomatik Backup (Har 1 soatda)
    setInterval(async () => {
        try { await createBackup(); } catch(e) { console.error("Auto Backup Error:", e); }
    }, 60 * 60 * 1000);
}
