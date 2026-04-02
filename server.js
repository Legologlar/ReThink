const axios = require('axios');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const CLIENT_ID = "893805639538-gu30br0e9vvbgbfvk5g0vv35pe3t1tu9.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

app.post('/auth/google', async (req, res) => {
    const { token } = req.body;

    try {
        console.log("--- Hibrit Doğrulama Başladı ---");

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID, 
        });
        const payload = ticket.getPayload();
        
        if (payload['aud'] !== CLIENT_ID && payload['iss'] !== 'https://securetoken.google.com/rethinkwithrethink') {
            throw new Error('Project ID veya Client ID uyuşmazlığı!');
        }

        const uid = payload['sub'];
        const { name, email, picture } = payload;

        console.log(`Doğrulama Başarılı: ${name}`);

        // Firestore İşlemleri ve Puan Kontrolü
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();
        
        let points = 0; // Varsayılan puan

        if (!doc.exists) {
            // Yeni kullanıcıyı puanıyla birlikte oluştur
            await userRef.set({
                name: name,
                email: email,
                profilePic: picture,
                points: 0, // Element eklendi
                lastLogin: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Mevcut kullanıcının puanını çek
            points = doc.data().points || 0; // Element çekildi
            await userRef.set({
                name: name,
                email: email,
                profilePic: picture,
                lastLogin: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // Yanıta puanı ve resmi ekle
        res.status(200).send({ 
            message: "Giriş Başarılı!", 
            user: { name, email, picture, points: points } 
        });

    } catch (error) {
        console.error("HATA:", error.message);
        res.status(401).send({ message: "Doğrulama başarısız", error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda aktif.`));

const URL = "https://rethink-lhse.onrender.com/ping"; 

setInterval(async () => {
    try {
        const response = await axios.get(URL);
        console.log("Kendi kendine ping atıldı, durum:", response.status);
    } catch (error) {
        console.error("Self-ping hatası:", error.message);
    }
}, 14 * 60 * 1000);

app.get('/ping', (req, res) => res.send('Yaşıyorum!'));
