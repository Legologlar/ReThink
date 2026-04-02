const axios = require('axios');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Token yok" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token geçersiz" });
    }
}

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Google Client
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

// AUTH ENDPOINT
app.post('/auth/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send({ message: "Token eksik" });
    }

    try {
        console.log("Auth başladı");

        // 1. TOKEN DOĞRULAMA (Google)
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });

        const payload = ticket.getPayload();

        // EKSTRA GÜVENLİK
        if (!payload.email_verified) {
            throw new Error("Email doğrulanmamış");
        }
    

        const uid = payload.sub;
        const { name, email, picture } = payload;

        const userRef = db.collection('users').doc(uid);

        // 2. ATOMİK USER OLUŞTURMA / GÜNCELLEME
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);

            if (!doc.exists) {
                // YENİ KULLANICI
                transaction.set(userRef, {
                    name,
                    email,
                    profilePic: picture,
                    points: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastLogin: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // MEVCUT KULLANICI
                transaction.update(userRef, {
                    name,
                    email,
                    profilePic: picture,
                    lastLogin: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            const token = jwt.sign(
            { uid }, 
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
);
        });

        // 3. POINTS OKUMA (response için)
        const updatedDoc = await userRef.get();
        const userData = updatedDoc.data();

        res.status(200).send({
            message: "Giriş başarılı",
            user: {
                uid,
                name: userData.name,
                email: userData.email,
                picture: userData.profilePic,
                points: userData.points || 0
            }
        });

    } catch (error) {
        console.error("AUTH HATA:", error.message);

        res.status(401).send({
            message: "Doğrulama başarısız",
            error: error.message
        });
    }
});

app.get("/user/me", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.uid;

        const userRef = db.collection("users").doc(userId);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = doc.data();

        res.json({
            name: user.name,
            email: user.email,
            picture: user.profilePic,
            points: user.points || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
// KEEP ALIVE
const URL = process.env.APP_URL;

setInterval(async () => {
    try {
        await axios.get(URL + "/ping");
        console.log("Ping OK");
    } catch (error) {
        console.error("Ping hata:", error.message);
    }
}, 14 * 60 * 1000);

// HEALTH CHECK
app.get('/ping', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda aktif.`));
