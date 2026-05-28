const axios = require('axios');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken'); // JWT işlemleri için eklendi
const crypto = require('crypto');     // Cihaz fingerprint hash'i için eklendi
const bcrypt = require('bcrypt');     // 🔒 EKSİK OLAN KÜTÜPHANE EKLENDİ: Şifre hash/karşılaştırma için

const app = express();
app.use(cors());
app.use(express.json());

// JWT için Güvenli Gizli Anahtar (Environment değişkeninden okunur)
const JWT_SECRET = process.env.JWT_SECRET;

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

// --- YARDIMCI FONKSİYON: Cihaz Kimliği (Fingerprint) Üretici ---
function generateDeviceFingerprint(req) {
    const userAgent = req.headers['user-agent'] || 'unknown-device';
    // User-Agent verisini SHA-256 ile kısa ve benzersiz bir hash'e dönüştürüyoruz
    return crypto.createHash('sha256').update(userAgent).digest('hex');
}

// =================================================================
// 🌟 GÜNCELLENDİ endpoint: Klasik E-posta ve Şifre ile Giriş (giris.html için)
// =================================================================
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "E-posta ve şifre gereklidir." });
    }

    try {
        // Firestore'da bu e-postaya ait kullanıcıyı ara
        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();

        if (usersSnapshot.empty) {
            return res.status(401).json({ message: "E-posta veya şifre hatalı." });
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        const uid = userDoc.id;

        // 🔒 GÜVENLİK GÜNCELLEMESİ: giris.html'den gelen düz şifreyi, db'deki 10 kere hash'lenmiş şifreyle karşılaştırır
        let isPasswordValid = false;

        if (userData.password) {
            // Eğer veritabanındaki şifre bcrypt ile hash'lenmişse (örneğin $2b$ ile başlıyorsa)
            if (userData.password.startsWith('$2b$') || userData.password.startsWith('$2a$')) {
                isPasswordValid = await bcrypt.compare(password, userData.password);
            } else {
                // FALLBACK: Eğer veritabanında hala eski, hash'lenmemiş düz şifre kalmışsa testlerin aksamaması için düz kontrol yap
                isPasswordValid = (userData.password === password);
            }
        }

        if (!isPasswordValid) {
            return res.status(401).json({ message: "E-posta veya şifre hatalı." });
        }

        // Son giriş tarihini güncelle
        await db.collection('users').doc(uid).update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });

        // Cihaz Fingerprint ve 2 Haftalık JWT Üretimi (Google Auth ile aynı standartta)
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

// =================================================================
// 🌟 GÜNCELLESTİRİLDİ ENDPOINT: Bcrypt ile 10 Tur Şifreli Kayıt Olma Sistemi (kayit.html için)
// =================================================================
app.post('/auth/register', async (req, res) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({ message: "Tüm alanların doldurulması zorunludur." });
    }

    try {
        // 1. Kontrol: Bu e-posta adresiyle daha önce kayıt olunmuş mu?
        const userCheck = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!userCheck.empty) {
            return res.status(400).json({ message: "Bu e-posta adresi zaten kullanımda." });
        }

        // 2. GÜVENLİK ADIMI: Şifreyi tam 10 salt round kullanarak tek yönlü hash'leme işleminden geçiriyoruz
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Benzersiz bir UID oluşturma (Firestore otomatik ID veya özel ID üretebilir)
        const userRef = db.collection('users').doc(); // Boş bırakınca otomatik benzersiz döküman ID üretir
        const uid = userRef.id;

        const newUser = {
            name: fullName,
            email: email,
            password: hashedPassword, // 🔒 Veritabanına düz metin değil, çözülemez hash gidiyor!
            profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=334f2b&color=fff`, // Default avatar
            points: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        };

        // Veriyi Firestore'a yazıyoruz
        await userRef.set(newUser);

        // 4. Otomatik Oturum Açma: Kayıt biter bitmez kullanıcıya anında JWT token üretiyoruz
        const deviceFingerprint = generateDeviceFingerprint(req);
        const sessionToken = jwt.sign(
            { uid: uid, fingerprint: deviceFingerprint },
            JWT_SECRET,
            { expiresIn: '14d', algorithm: 'HS256' }
        );

        res.status(201).json({
            message: "Kullanıcı başarıyla oluşturuldu.",
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
        console.error("KAYIT HATA:", error.message);
        res.status(500).json({ message: "Sunucu hatası, kayıt yapılamadı." });
    }
});

// GOOGLE AUTH ENDPOINT
app.post('/auth/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send({ message: "Token eksik" });
    }

    try {
        console.log("Auth başladı");

        // Google token doğrulama
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

        // Kullanıcı oluştur / güncelle
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);

            if (!doc.exists) {
                // İlk kez kayıt oluyorsa tüm bilgileri (Google'dan gelen isim dahil) kaydet
                transaction.set(userRef, {
                    name,
                    email,
                    profilePic: picture,
                    points: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastLogin: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // 🌟 DÜZELTME: Kullanıcı zaten varsa, Google'dan gelen 'name' parametresini güncelleme!
                // Böylece kullanıcının panelden değiştirdiği isim korunmuş olur.
                transaction.update(userRef, {
                    email,
                    profilePic: picture, // Profil resmi değiştiyse güncellenebilir
                    lastLogin: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        // Güncel user verisini çek
        const updatedDoc = await userRef.get();
        const userData = updatedDoc.data();

        // --- STRATEJİ A: Cihaz Fingerprint ve 2 Haftalık JWT Üretimi ---
        const deviceFingerprint = generateDeviceFingerprint(req);

        // JWT içerisine uid ve cihaz parmak izini mühürlüyoruz
        const sessionToken = jwt.sign(
            { uid: uid, fingerprint: deviceFingerprint },
            JWT_SECRET,
            { expiresIn: '14d', algorithm: 'HS256' } // 2 hafta geçerli ve algoritma zorunlu (None önlemi)
        );

        // Başarılı girişte üretilen özel sessionToken'ı ön yüze teslim ediyoruz
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

        res.status(401).send({
            message: "Doğrulama başarısız",
            error: error.message
        });
    }
});

// --- NAVBAR VE SAYFALAR İÇİN TOKEN VE CİHAZ DOĞRULAMA ALANI ---
app.post('/auth/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // 'Bearer TOKEN' yapısından ayıklama

    if (!token) {
        return res.status(401).json({ message: "Oturum tokenı bulunamadı" });
    }

    try {
        // 1. Kontrol: İmza ve Algoritma Kontrolü (None algoritması engellenmiştir)
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

        // 2. Kontrol: İstekteki güncel User-Agent ile token içindeki cihazın kıyaslanması
        const currentFingerprint = generateDeviceFingerprint(req);
        
        if (decoded.fingerprint !== currentFingerprint) {
            console.log("Cihaz uyuşmazlığı engellendi!");
            return res.status(401).json({ message: "Bu oturum başka bir cihaza ait, erişim reddedildi." });
        }

        // Cihaz ve imza geçerliyse kullanıcının Firestore'daki en güncel verilerini çekiyoruz
        const userRef = db.collection("users").doc(decoded.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Kullanıcı veritabanında bulunamadı" });
        }

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
        console.error("Token Doğrulama Hatası:", err.message);
        return res.status(401).json({ message: "Geçersiz veya süresi dolmuş token" });
    }
});

// =================================================================
// 🌟 YENİ ENDPOINT: Profil Ayarlarını Firestore'da Güncelleyen Alan
// =================================================================
app.post('/user/update', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Oturum açmanız gerekiyor." });
    }

    try {
        // Güvenlik: İstek atan kişinin JWT token'ını doğrula ve uid'sini al
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentFingerprint = generateDeviceFingerprint(req);

        if (decoded.fingerprint !== currentFingerprint) {
            return res.status(401).json({ message: "Güvenlik ihlali: Geçersiz cihaz." });
        }

        const { name } = req.body;
        if (!name || name.trim() === "") {
            return res.status(400).json({ message: "Ad Soyad alanı boş bırakılamaz." });
        }

        // Firestore'daki dökümanı güncelle
        const userRef = db.collection("users").doc(decoded.uid);
        await userRef.update({
            name: name,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Güncel veriyi çekip ön yüze dön
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
        console.error("Profil Güncelleme Hatası:", err.message);
        return res.status(401).json({ message: "Oturum geçersiz, lütfen tekrar giriş yapın." });
    }
});

app.get("/user/:uid", async (req, res) => {
    try {
        const userRef = db.collection("users").doc(req.params.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "User not found" });
        }

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

        const snapshot = await db
            .collection("users")
            .orderBy("points", "desc")
            .limit(limit)
            .get();

        const users = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                uid: doc.id, // 🌟 İŞTE KRİTİK NOKTA: Kullanıcının benzersiz Firestore ID'sini listeye ekliyoruz
                name: data.name,
                picture: data.profilePic,
                points: data.points || 0
            });
        });

        res.json(users);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Leaderboard error" });
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
