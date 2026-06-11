require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.FATSECRET_CLIENT_ID;
const CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET;

let accessToken = '';
let tokenExpiry = 0;

async function getValidToken() {
    const now = Date.now();
    // 5 menit (300000 ms) sebelum kedaluwarsa, minta token baru
    if (accessToken && now < (tokenExpiry - 300000)) {
        return accessToken;
    }

    console.log("Token kedaluwarsa atau belum ada. Mengambil token baru dari FatSecret...");
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post('https://oauth.fatsecret.com/connect/token',
            'grant_type=client_credentials&scope=basic',
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        accessToken = response.data.access_token;
        tokenExpiry = now + (response.data.expires_in * 1000);
        return accessToken;
    } catch (error) {
        console.error("Fatal Error Otentikasi:", error.message);
        throw new Error("Gagal mendapatkan akses dari FatSecret");
    }
}

// Endpoint 1: Pencarian Makanan
app.get('/api/search', async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: "Parameter 'q' wajib diisi. Contoh: /api/search?q=nasi" });
    }

    try {
        const token = await getValidToken();
        const response = await axios.get('https://platform.fatsecret.com/rest/server.api', {
            params: {
                method: 'foods.search',
                search_expression: query,
                region: 'ID',
                language: 'id',
                max_results: req.query.max_results || 20,
                format: 'json'
            },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Gagal meneruskan permintaan ke server FatSecret", details: error.message });
    }
});

// Endpoint 2: Detail Nutrisi Makanan
app.get('/api/detail', async (req, res) => {
    const foodId = req.query.food_id;

    if (!foodId) {
        return res.status(400).json({ error: "Parameter 'food_id' wajib diisi. Contoh: /api/detail?food_id=4284" });
    }

    try {
        const token = await getValidToken();
        const response = await axios.get('https://platform.fatsecret.com/rest/server.api', {
            params: {
                method: 'food.get.v2',
                food_id: foodId,
                format: 'json'
            },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Gagal menarik detail nutrisi dari FatSecret", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Calivo Proxy siap beroperasi di port ${PORT}`);
});