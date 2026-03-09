const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// Initialize Database
async function initDB() {
    if (!await fs.pathExists(DB_FILE)) {
        await fs.writeJson(DB_FILE, { users: [], orders: [] });
    }
}
initDB();

const getData = async () => await fs.readJson(DB_FILE);
const saveData = async (data) => await fs.writeJson(DB_FILE, data, { spaces: 2 });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// REGISTER: Saves user to db.json
app.post('/api/register', async (req, res) => {
    const { name, phone } = req.body;
    const data = await getData();
    const cleanPhone = phone.trim();
    
    if (data.users.find(u => u.phone === cleanPhone)) {
        return res.status(409).json({ error: "Phone already exists" });
    }

    const newUser = { name: name.trim(), phone: cleanPhone };
    data.users.push(newUser);
    await saveData(data);
    res.status(201).json({ user: newUser });
});

// LOGIN: Checks db.json
app.post('/api/login', async (req, res) => {
    const { phone } = req.body;
    const data = await getData();
    const user = data.users.find(u => u.phone === phone.trim());
    
    if (user) res.json({ success: true, user });
    else res.status(401).json({ error: "User not found. Please register." });
});

// ORDERS: Validates user against db.json
app.post('/api/orders', async (req, res) => {
    const { phone, itemName, price } = req.body;
    const data = await getData();
    const user = data.users.find(u => u.phone === phone.trim());

    if (!user) return res.status(403).json({ error: "Unauthorized: Please register first" });

    const newOrder = { 
        id: Date.now(), customer: user.name, phone: user.phone, 
        itemName, price, confirmed: false, 
        timestamp: new Date().toLocaleString('en-GB') 
    };
    data.orders.unshift(newOrder);
    await saveData(data);
    res.status(201).json(newOrder);
});

app.get('/api/my-orders/:phone', async (req, res) => {
    const data = await getData();
    res.json(data.orders.filter(o => o.phone === req.params.phone));
});

app.post('/api/admin/verify', async (req, res) => {
    if (req.body.password === "1234") {
        const data = await getData();
        res.json({ success: true, orders: data.orders });
    } else res.status(401).json({ success: false });
});

app.patch('/api/orders/:id', async (req, res) => {
    const data = await getData();
    const order = data.orders.find(o => o.id === parseInt(req.params.id));
    if (order) { order.confirmed = true; await saveData(data); res.json({ success: true }); }
    else res.status(404).send();
});

app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
