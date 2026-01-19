const express = require('express');
const app = express();
const http = require('http').createServer(app);
const cors = require('cors');
const path = require('path');
const fs = require('fs');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// --- SOXTA BAZA (Xotirada turadi) ---
let usersDB = [];      // Mijozlar
let driversDB = [];    // Haydovchilar
let ordersDB = [];     // Buyurtmalar
let addressesDB = [];  // Manzillar
let staffDB = [];      // Hodimlar
let rolesDB = [{ _id: '1', slug: 'owner', name: 'Tizim Egasi', permissions: ['orders', 'drivers', 'clients', 'reports', 'settings', 'marketing', 'staff', 'roles', 'finance'] }];
let transactionsDB = []; // Moliya
let logsDB = []; // [YANGI] Loglar
let promoDB = []; // [YANGI] Promokodlar
let calculationGroupsDB = []; // [YANGI] Hisob-kitob guruhlari

const DATA_FILE = path.join(__dirname, 'database.json');

function saveData() {
    const data = {
        users: usersDB,
        drivers: driversDB,
        orders: ordersDB,
        addresses: addressesDB,
        staff: staffDB,
        roles: rolesDB,
        transactions: transactionsDB,
        logs: logsDB,
        promocodes: promoDB,
        calculationGroups: calculationGroupsDB // [YANGI]
    };
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error("Faylga yozishda xatolik:", e); }
}

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const data = JSON.parse(raw);
            usersDB = data.users || [];
            driversDB = data.drivers || [];
            ordersDB = data.orders || [];
            addressesDB = data.addresses || [];
            staffDB = data.staff || [];
            rolesDB = data.roles || rolesDB;
            transactionsDB = data.transactions || [];
            logsDB = data.logs || []; // [YANGI]
            promoDB = data.promocodes || []; // [YANGI]
            calculationGroupsDB = data.calculationGroups || []; // [YANGI]
            console.log("✅ Ma'lumotlar fayldan yuklandi!");
        } catch (e) { console.error("Faylni o'qishda xatolik:", e); }
    }
}
loadData();

// [YANGI] Avtomatik Backup (Har 5 daqiqada)
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

setInterval(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `database-${timestamp}.json`);
    try {
        if (fs.existsSync(DATA_FILE)) {
            fs.copyFileSync(DATA_FILE, backupFile);
            console.log(`📦 Backup yaratildi: ${backupFile}`);
            
            // Eski backuplarni tozalash (oxirgi 50 tasini saqlash)
            const files = fs.readdirSync(BACKUP_DIR).sort();
            if (files.length > 50) {
                fs.unlinkSync(path.join(BACKUP_DIR, files[0]));
            }
        }
    } catch (e) { console.error("Backup xatosi:", e); }
}, 5 * 60 * 1000);

// [YANGI] Log yozish funksiyasi
function logAction(username, action, details) {
    const log = {
        id: Date.now(),
        time: new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }),
        username: username || 'Tizim',
        action: action,
        details: details || ''
    };
    logsDB.unshift(log);
    if (logsDB.length > 1000) logsDB.pop(); // 1000 ta log saqlanadi
    saveData();
}

// --- 1. MIJOZLAR API ---
app.post('/api/login', (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Raqam yo'q" });

    const vaqt = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
    usersDB.push({ id: usersDB.length + 1, phone, date: vaqt });
    console.log("Mijoz kirdi:", phone);
    saveData();
    res.json({ success: true });
});

app.get('/api/admin/users', (req, res) => res.json(usersDB.slice().reverse()));

// --- 2. BUYURTMALAR (ORDERS) API ---
app.get('/api/orders', (req, res) => res.json(ordersDB.slice().reverse()));

app.post('/api/orders', (req, res) => {
    const newOrder = {
        id: ordersDB.length + 1,
        vaqt: new Date().toLocaleTimeString("uz-UZ"),
        telefon: req.body.phone,
        ism: req.body.name,
        qayerdan: req.body.from,
        qayerga: req.body.to,
        status: "yangi",
        izoh: req.body.comment || "",
        narx: req.body.narx
    };
    ordersDB.push(newOrder);
    saveData();
    res.json({ success: true, order: newOrder });
});

// --- 3. HAYDOVCHILAR (DRIVERS) API ---
app.get('/api/drivers', (req, res) => res.json(driversDB.slice().reverse()));

app.post('/api/drivers', (req, res) => {
    const newDriver = {
        id: driversDB.length + 1,
        ...req.body, // Hamma ma'lumotlarni oladi
        status: "Faol"
    };
    driversDB.push(newDriver);
    saveData();
    res.json({ success: true });
});

// --- 4. MANZILLAR (ADDRESS) API ---
app.get('/api/addresses', (req, res) => res.json(addressesDB.slice().reverse()));

app.post('/api/addresses', (req, res) => {
    addressesDB.push({ id: addressesDB.length + 1, ...req.body });
    saveData();
    res.json({ success: true });
});

// --- 5. ADMIN VA HODIMLAR API (YANGI) ---
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    // Oddiy tekshiruv: admin/admin
    if(username === 'admin' && password === 'admin') {
        res.json({ success: true, admin: { id: 1, username: 'admin', role: 'owner', full_name: 'Admin', balance: 0 } });
    } else {
        // Hodimlarni tekshirish
        const staff = staffDB.find(s => s.username === username && s.password === password);
        if(staff) {
             if (staff.is_active === false) return res.json({ success: false, error: "Bloklangan" });
             logAction(staff.username, "Kirish", "Admin panelga kirdi"); // [YANGI]
             res.json({ success: true, admin: { id: staff.id, username: staff.username, role: staff.role, full_name: staff.full_name, balance: 0 } });
        } else {
            res.json({ success: false, error: "Xato login" });
        }
    }
});

app.get('/api/admin/staff', (req, res) => res.json(staffDB));
app.post('/api/admin/staff', (req, res) => {
    try {
        if(req.body.id) {
            const idx = staffDB.findIndex(s => s.id == req.body.id);
            if(idx >= 0) staffDB[idx] = { ...staffDB[idx], ...req.body };
            logAction("Admin", "Hodim tahrirlandi", req.body.username); // [YANGI]
        } else {
            staffDB.push({ id: Date.now(), ...req.body });
            logAction("Admin", "Hodim qo'shildi", req.body.username); // [YANGI]
        }
        saveData();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Server xatosi" });
    }
});
app.delete('/api/admin/staff/:id', (req, res) => {
    staffDB = staffDB.filter(s => s.id != req.params.id);
    logAction("Admin", "Hodim o'chirildi", "ID: " + req.params.id); // [YANGI]
    saveData();
    res.json({ success: true });
});

// --- 6. ROLLAR VA MOLIYA API (YANGI) ---
app.get('/api/admin/roles', (req, res) => res.json(rolesDB));
app.post('/api/admin/roles', (req, res) => {
    rolesDB.push({ _id: Date.now().toString(), ...req.body });
    logAction("Admin", "Rol qo'shildi", req.body.name); // [YANGI]
    saveData();
    res.json({ success: true });
});
app.delete('/api/admin/roles/:id', (req, res) => {
    rolesDB = rolesDB.filter(r => r._id != req.params.id);
    logAction("Admin", "Rol o'chirildi", "ID: " + req.params.id); // [YANGI]
    saveData();
    res.json({ success: true });
});

app.get('/api/admin/transactions', (req, res) => res.json(transactionsDB));

// [YANGI] Loglarni olish API
app.get('/api/admin/logs', (req, res) => res.json(logsDB));

// [YANGI] Backuplarni boshqarish API
app.get('/api/admin/backups', (req, res) => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
        const files = fs.readdirSync(BACKUP_DIR).map(file => {
            const stats = fs.statSync(path.join(BACKUP_DIR, file));
            return { name: file, size: (stats.size / 1024).toFixed(2) + ' KB', date: stats.mtime };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(files);
    } catch (e) { res.status(500).json({ error: "Xatolik" }); }
});

app.post('/api/admin/backups/restore', (req, res) => {
    const { filename } = req.body;
    const backupPath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(backupPath)) {
        try {
            fs.copyFileSync(backupPath, DATA_FILE);
            loadData(); // Xotiradagi ma'lumotlarni yangilash
            logAction("Admin", "Backup tiklandi", filename);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: "Tiklashda xatolik" }); }
    } else {
        res.status(404).json({ error: "Fayl topilmadi" });
    }
});

// [YANGI] Promokodlar API
app.get('/api/promocodes', (req, res) => res.json(promoDB));
app.post('/api/promocodes', (req, res) => {
    promoDB.push({ id: Date.now(), ...req.body });
    logAction("Admin", "Promokod qo'shildi", req.body.code);
    saveData();
    res.json({ success: true });
});
app.delete('/api/promocodes/:id', (req, res) => {
    promoDB = promoDB.filter(p => p.id != req.params.id);
    saveData();
    res.json({ success: true });
});
app.post('/api/promocodes/validate', (req, res) => {
    const { code } = req.body;
    const promo = promoDB.find(p => p.code === code);
    if (promo) res.json({ success: true, promo });
    else res.json({ success: false });
});

// [YANGI] Calculation Groups API
app.get('/api/calculation-groups', (req, res) => res.json(calculationGroupsDB));
app.post('/api/calculation-groups', (req, res) => {
    if(req.body._id) {
        const idx = calculationGroupsDB.findIndex(g => g._id == req.body._id);
        if(idx >= 0) calculationGroupsDB[idx] = { ...calculationGroupsDB[idx], ...req.body };
    } else {
        calculationGroupsDB.push({ _id: Date.now().toString(), ...req.body });
    }
    saveData();
    res.json({ success: true });
});
app.delete('/api/calculation-groups/:id', (req, res) => {
    calculationGroupsDB = calculationGroupsDB.filter(g => g._id != req.params.id);
    saveData();
    res.json({ success: true });
});

// --- ADMIN PANELGA YO'L ---
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'admin.html'));
});

// ISHGA TUSHIRISH
const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server ishlamoqda: http://localhost:${PORT}`);
});