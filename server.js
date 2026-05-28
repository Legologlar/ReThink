const axios = require('axios');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken'); 
const crypto = require('crypto');     
const bcrypt = require('bcrypt');     
const nodemailer = require('nodemailer'); // 1. EKSİK OLAN MODÜL EKLENDİ

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

// ─── NODEMAILER YAPILANDIRMASI ──────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,         // 587 yerine SSL portu olan 465 kullanın
    secure: true,      // port 465 olduğu için burası kesinlikle true olmalı
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000, // 10 saniye sonra beklemeyi bırak (kilitlenmeyi önler)
    greetingTimeout: 10000
});
// Geçici doğrulama kodları için bellek alanı
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

// ─── REGISTER ENDPOINT (E-POSTA GÖNDERİMİ ENTEGRE EDİLDİ) ─────────
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

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Gerçek e-posta gönderme fonksiyonu çağrılıyor
        const mailOptions = {
            from: `"ReThink" <${process.env.EMAIL_USER}>`, 
            to: email,
            subject: 'ReThink Hesap Doğrulama Kodu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e2e1; border-radius: 12px;">
                    <h2 style="color: #334f2b; text-align: center;">ReThink'e Hoş Geldiniz!</h2>
                    <p>Merhaba ${fullName},</p>
                    <p>Hesabınızı aktive etmek ve doğrulama işlemini tamamlamak için aşağıdaki 6 haneli onay kodunu kullanabilirsiniz:</p>
                    <div style="background-color: #f0eded; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #334f2b; border-radius: 8px; margin: 20px 0;">
                        ${verificationCode}
                    </div>
                    <p style="font-size: 12px; color: #73796f;">Bu kod 10 dakika boyunca geçerlidir. Eğer bu başvuruyu siz yapmadıysanız lütfen bu e-postayı dikkate almayınız.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        verificationStore.set(email, {
            fullName,
            password: hashedPassword,
            code: verificationCode,
            expiresAt: Date.now() + 10 * 60 * 1000 
        });

        console.log(`\n[E-POSTA GÖNDERİLDİ] Kullanıcı: ${email} | Kod: ${verificationCode}\n`);
        res.status(200).json({ message: "Doğrulama kodu gönderildi." });

    } catch (error) {
        console.error("KAYIT HATA:", error.message);
        res.status(500).json({ message: "Sunucu hatası, doğrulama e-postası gönderilemedi." });
    }
});

// ─── VERIFY CODE ENDPOINT ────────────────────────────────────────
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
        verificationStore.delete(email); 

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

// ─── RESEND CODE ENDPOINT (E-POSTA GÖNDERİMİ ENTEGRE EDİLDİ) ─────────
app.post('/auth/resend-code', async (req, res) => {
    const { email } = req.body;
    const verificationData = verificationStore.get(email);

    if (!verificationData) {
        return res.status(400).json({ message: "Aktif bir kayıt oturumu bulunamadı yeniden kayıt olun." });
    }

    try {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const mailOptions = {
            from: `"ReThink" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Yeni ReThink Hesap Doğrulama Kodu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e2e1; border-radius: 12px;">
                    <h2 style="color: #334f2b; text-align: center;">Yeni Doğrulama Kodunuz</h2>
                    <p>İstediğiniz yeni doğrulama kodu aşağıdadır:</p>
                    <div style="background-color: #f0eded; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #334f2b; border-radius: 8px; margin: 20px 0;">
                        ${newCode}
                    </div>
                    <p style="font-size: 12px; color: #73796f;">Bu kod 10 dakika boyunca geçerlidir.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        verificationData.code = newCode;
        verificationData.expiresAt = Date.now() + 10 * 60 * 1000;
        verificationStore.set(email, verificationData);

        console.log(`\n[YENİ E-POSTA GÖNDERİLDİ] Kullanıcı: ${email} | Yeni Kod: ${newCode}\n`);
        res.status(200).json({ message: "Yeni doğrulama kodu gönderildi." });

    } catch (error) {
        console.error("YENİDEN GÖNDERİM HATA:", error.message);
        res.status(500).json({ message: "Yeni kod e-posta ile gönderilemedi." });
    }
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
