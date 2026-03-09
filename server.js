const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234"; 

// Database file path
const DB_FILE = path.join(__dirname, 'db.json');

// Initialize Database
async function initDB() {
    try {
        if (!await fs.pathExists(DB_FILE)) {
            await fs.writeJson(DB_FILE, { users: [], orders: [] });
            console.log("📂 Database created: db.json");
        }
    } catch (err) {
        console.error("❌ Database Init Error:", err);
    }
}
initDB();

// Helper functions
const getData = async () => await fs.readJson(DB_FILE);
const saveData = async (data) => await fs.writeJson(DB_FILE, data, { spaces: 2 });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/** * API Endpoints */

// 1. User Registration (Matches HTML handleAuth)
app.post('/api/register', async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "Name and Phone required" });

    const data = await getData();
    const phoneClean = phone.trim();
    
    if (data.users.find(u => u.phone === phoneClean)) {
        return res.status(409).json({ error: "Phone number already registered" });
    }

    const newUser = { name: name.trim(), phone: phoneClean };
    data.users.push(newUser);
    await saveData(data);
    
    console.log(`👤 New User Registered: ${name}`);
    res.status(201).json({ message: "Success", user: newUser });
});

// 2. User Login
app.post('/api/login', async (req, res) => {
    const { name, phone } = req.body;
    const data = await getData();
    const user = data.users.find(u => 
        u.phone === phone.trim() && 
        u.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// 3. Place Order (Matches HTML placeOrder)
app.post('/api/orders', async (req, res) => {
    const { customer, phone, itemName, price } = req.body;
    const data = await getData();

    // Verification check
    const validUser = data.users.find(u => u.phone === phone.trim());
    if (!validUser) return res.status(403).json({ error: "Unauthorized: Please register first" });

    const newOrder = { 
        id: Date.now(), 
        customer: validUser.name, 
        phone: validUser.phone, 
        itemName,
        price,
        confirmed: false,
        timestamp: new Date().toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        }) 
    };
    
    data.orders.unshift(newOrder); 
    await saveData(data);
    console.log(`🛒 Order Placed: ${itemName} by ${customer}`);
    res.status(201).json(newOrder);
});

// 4. Get Customer Orders (Matches HTML loadOrders)
app.get('/api/my-orders/:phone', async (req, res) => {
    const data = await getData();
    const myOrders = data.orders.filter(o => o.phone === req.params.phone);
    res.json(myOrders);
});

// 5. Admin Verification & Data Fetch (Matches HTML adminLogin)
app.post('/api/admin/verify', async (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const data = await getData();
        res.json({ 
            success: true, 
            orders: data.orders, 
            userCount: data.users.length 
        });
    } else {
        res.status(401).json({ success: false, message: "Denied" });
    }
});

// 6. Admin Order Confirmation (Matches HTML confirmOrder)
app.patch('/api/orders/:id', async (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });

    const data = await getData();
    const orderId = parseInt(req.params.id);
    const orderIndex = data.orders.findIndex(o => o.id === orderId);
    
    if (orderIndex !== -1) {
        data.orders[orderIndex].confirmed = true;
        await saveData(data);
        console.log(`✅ Order ${orderId} confirmed by Admin`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Order not found" });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`-------------------------------------------`);
    console.log(`⚡ VoltEdge Server: http://localhost:${PORT}`);
    console.log(`📂 Storage: db.json (Auto-Sync)`);
    console.log(`-------------------------------------------`);
});