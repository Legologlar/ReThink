const axios = require('axios');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken'); 
const crypto = require('crypto');     
const bcrypt = require('bcrypt');     

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

// ─── GEÇİCİ DOĞRULAMA KODLARI İÇİN BELLEK ALANI ───────────────────
// Prodüksiyonda redis veya süreli firestore dökümanı önerilir.
const verificationStore = new Map(); 

function generateDeviceFingerprint(req) {
    const userAgent = req.headers['user-agent'] || 'unknown-device';
    return crypto.createHash('sha256').update(userAgent).digest('hex');
}

// ─── LOGIN ENDPOINT ──────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "E-posta ve şifre gereklidir." });
    }

    try {
        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnapshot.empty) {
            return res.status(401).json({ message: "E-posta veya şifre hatalı." });
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        const uid = userDoc.id;

        // E-posta doğrulama kontrolü (Eğer aktif etmek istersen)
        if (userData.isVerified === false) {
            return res.status(403).json({ message: "Lütfen önce e-posta adresinizi doğrulayın." });
        }

        let isPasswordValid = false;
        if (userData.password) {
            if (userData.password.startsWith('$2b$') || userData.password.startsWith('$2a$')) {
                isPasswordValid = await bcrypt.compare(password, userData.password);
            } else {
                isPasswordValid = (userData.password === password);
            }
        }

        if (!isPasswordValid) {
            return res.status(401).json({ message: "E-posta veya şifre hatalı." });
        }

        await db.collection('users').doc(uid).update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });

        const deviceFingerprint = generateDeviceFingerprint(req);
        const sessionToken = jwt.sign(
            { uid: uid, fingerprint: deviceFingerprint },
            JWT_SECRET,
            { expiresIn: '14d', algorithm: 'HS256' }
        );

        res.status(200).json({
            message: "Giriş başarılı",
            token: sessionToken,
            user: {
                uid,
                name: userData.name,
                email: userData.email,
                picture: userData.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}`,
                points: userData.points || 0
            }
        });
    } catch (error) {
        console.error("KLASİK AUTH HATA:", error.message);
        res.status(500).json({ message: "Sunucu hatası oluştu." });
    }
});

// ─── REGISTER ENDPOINT (Arayüz Adım 1) ───────────────────────────
app.post('/auth/register', async (req, res) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({ message: "Tüm alanların doldurulması zorunludur." });
    }

    try {
        const userCheck = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!userCheck.empty) {
            return res.status(400).json({ message: "Bu e-posta adresi zaten kullanımda." });
        }

        // 6 haneli rastgele kod üretimi
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Şifre hashleme
        const hashedPassword = await bcrypt.hash(password, 10);

        // Kullanıcı verilerini ve kodu geçici belleğe alıyoruz (Onaylanana kadar DB'ye yazmıyoruz veya isVerified: false yapıyoruz)
        // Burada doğrudan belleğe atarak DB kirliliğini önlüyoruz:
        verificationStore.set(email, {
            fullName,
            password: hashedPassword,
            code: verificationCode,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 dakika geçerli
        });

        // 🚨 TEST İÇİN KODU KONSOLA YAZDIRIYORUZ
        console.log(`\n============== DOĞRULAMA KODU ==============\nKullanıcı: ${email}\nKod: ${verificationCode}\n================───────────────────────────\n`);

        res.status(200).json({ message: "Doğrulama kodu gönderildi." });

    } catch (error) {
        console.error("KAYIT HATA:", error.message);
        res.status(500).json({ message: "Sunucu hatası, kayıt başlatılamadı." });
    }
});

// ─── VERIFY CODE ENDPOINT (Arayüz Adım 2) ────────────────────────
app.post('/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ message: "E-posta ve kod alanları zorunludur." });
    }

    const verificationData = verificationStore.get(email);

    if (!verificationData) {
        return res.status(400).json({ message: "Kayıt başvurusu bulunamadı veya süresi doldu." });
    }

    if (verificationData.expiresAt < Date.now()) {
        verificationStore.delete(email);
        return res.status(400).json({ message: "Doğrulama kodunun süresi dolmuş." });
    }

    if (verificationData.code !== code) {
        return res.status(400).json({ message: "Geçersiz doğrulama kodu." });
    }

    try {
        // Kod doğruysa Firestore'a kalıcı kaydı yapıyoruz
        const userRef = db.collection('users').doc();
        const uid = userRef.id;

        const newUser = {
            name: verificationData.fullName,
            email: email,
            password: verificationData.password, 
            profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(verificationData.fullName)}&background=334f2b&color=fff`,
            points: 0,
            isVerified: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        };

        await userRef.set(newUser);
        verificationStore.delete(email); // Belleği temizle

        // JWT Oluşturma
        const deviceFingerprint = generateDeviceFingerprint(req);
        const sessionToken = jwt.sign(
            { uid: uid, fingerprint: deviceFingerprint },
            JWT_SECRET,
            { expiresIn: '14d', algorithm: 'HS256' }
        );

        res.status(201).json({
            message: "Hesap başarıyla aktive edildi.",
            token: sessionToken,
            user: {
                uid,
                name: newUser.name,
                email: newUser.email,
                picture: newUser.profilePic,
                points: newUser.points
            }
        });

    } catch (error) {
        console.error("KOD DOĞRULAMA SISTEM HATASI:", error.message);
        res.status(500).json({ message: "Hesap oluşturulurken sunucu hatası meydana geldi." });
    }
});

// ─── RESEND CODE ENDPOINT ────────────────────────────────────────
app.post('/auth/resend-code', (req, res) => {
    const { email } = req.body;
    const verificationData = verificationStore.get(email);

    if (!verificationData) {
        return res.status(400).json({ message: "Aktif bir kayıt oturumu bulunamadı yeniden kayıt olun." });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    verificationData.code = newCode;
    verificationData.expiresAt = Date.now() + 10 * 60 * 1000;
    verificationStore.set(email, verificationData);

    console.log(`\n============== YENİ DOĞRULAMA KODU ==============\nKullanıcı: ${email}\nYeni Kod: ${newCode}\n================───────────────────────────────\n`);

    res.status(200).json({ message: "Yeni doğrulama kodu gönderildi." });
});

// GOOGLE AUTH ENDPOINT
app.post('/auth/google', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).send({ message: "Token eksik" });

    try {
        console.log("Auth başladı");
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload.email_verified) {
            throw new Error("Email doğrulanmamış");
        }

        const uid = payload.sub;
        const { name, email, picture } = payload;
        const userRef = db.collection('users').doc(uid);

        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists) {
                transaction.set(userRef, {
                    name,
                    email,
                    profilePic: picture,
                    points: 0,
                    isVerified: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastLogin: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                transaction.update(userRef, {
                    email,
                    profilePic: picture, 
                    lastLogin: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        const updatedDoc = await userRef.get();
        const userData = updatedDoc.data();
        const deviceFingerprint = generateDeviceFingerprint(req);
        const sessionToken = jwt.sign(
            { uid: uid, fingerprint: deviceFingerprint },
            JWT_SECRET,
            { expiresIn: '14d', algorithm: 'HS256' }
        );

        res.status(200).send({
            message: "Giriş başarılı",
            token: sessionToken,
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
        res.status(401).send({ message: "Doğrulama başarısız", error: error.message });
    }
});

// TOKEN VERIFY
app.post('/auth/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Oturum tokenı bulunamadı" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentFingerprint = generateDeviceFingerprint(req);
        
        if (decoded.fingerprint !== currentFingerprint) {
            return res.status(401).json({ message: "Bu oturum başka bir cihaza ait, erişim reddedildi." });
        }

        const userRef = db.collection("users").doc(decoded.uid);
        const doc = await userRef.get();

        if (!doc.exists) return res.status(404).json({ message: "Kullanıcı veritabanında bulunamadı" });

        const user = doc.data();
        res.json({
            valid: true,
            user: {
                uid: decoded.uid,
                name: user.name,
                email: user.email,
                picture: user.profilePic,
                points: user.points || 0
            }
        });
    } catch (err) {
        return res.status(401).json({ message: "Geçersiz veya süresi dolmuş token" });
    }
});

// USER UPDATE
app.post('/user/update', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Oturum açmanız gerekiyor." });

    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentFingerprint = generateDeviceFingerprint(req);

        if (decoded.fingerprint !== currentFingerprint) {
            return res.status(401).json({ message: "Güvenlik ihlali: Geçersiz cihaz." });
        }

        const { name } = req.body;
        if (!name || name.trim() === "") {
            return res.status(400).json({ message: "Ad Soyad alanı boş bırakılamaz." });
        }

        const userRef = db.collection("users").doc(decoded.uid);
        await userRef.update({
            name: name,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const updatedDoc = await userRef.get();
        const user = updatedDoc.data();

        res.json({
            message: "Profil başarıyla güncellendi.",
            user: {
                uid: decoded.uid,
                name: user.name,
                email: user.email,
                picture: user.profilePic,
                points: user.points || 0
            }
        });
    } catch (err) {
        return res.status(401).json({ message: "Oturum geçersiz, lütfen tekrar giriş yapın." });
    }
});

app.get("/user/:uid", async (req, res) => {
    try {
        const userRef = db.collection("users").doc(req.params.uid);
        const doc = await userRef.get();
        if (!doc.exists) return res.status(404).json({ message: "User not found" });
        const user = doc.data();
        res.json({
            uid: req.params.uid,
            name: user.name,
            email: user.email,
            picture: user.profilePic,
            points: user.points || 0
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/leaderboard", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const snapshot = await db.collection("users").orderBy("points", "desc").limit(limit).get();
        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                uid: doc.id,
                name: data.name,
                picture: data.profilePic,
                points: data.points || 0
            });
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Leaderboard error" });
    }
});

const URL = process.env.APP_URL;
setInterval(async () => {
    try {
        if(URL) await axios.get(URL + "/ping");
    } catch (error) {
        console.error("Ping hata:", error.message);
    }
}, 14 * 60 * 1000);

app.get('/ping', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda aktif.`));
