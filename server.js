const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library'); // Yeni kütüphane

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin Başlatma
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// Senin o meşhur Client ID'n
const CLIENT_ID = "893805639538-gu30br0e9vvbgbfvk5g0vv35pe3t1tu9.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

app.post('/auth/google', async (req, res) => {
    const { token } = req.body;

    try {
        console.log("--- Hibrit Doğrulama Başladı ---");

        // 1. ADIM: Google Kütüphanesi ile Client ID (aud) doğrulaması yapıyoruz
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID, 
        });
        const payload = ticket.getPayload();
        
        // 2. ADIM: Token içindeki Project ID'nin doğru olduğunu kontrol ediyoruz
        if (payload['aud'] !== CLIENT_ID && payload['iss'] !== 'https://securetoken.google.com/rethinkwithrethink') {
            throw new Error('Project ID veya Client ID uyuşmazlığı!');
        }

        const uid = payload['sub']; // Google User ID
        const { name, email, picture } = payload;

        console.log(`Doğrulama Başarılı: ${name}`);

        // 3. ADIM: Firestore Kaydı
        const userRef = db.collection('users').doc(uid);
        await userRef.set({
            name: name,
            email: email,
            profilePic: picture,
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.status(200).send({ message: "Giriş Başarılı!", user: { name, email } });

    } catch (error) {
        console.error("HATA:", error.message);
        res.status(401).send({ message: "Doğrulama başarısız", error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda aktif.`));
