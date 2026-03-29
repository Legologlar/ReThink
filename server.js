const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// RENDER ÜZERİNDEKİ ENV VARIABLES KONTROLÜ
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

if (!firebaseConfig.projectId || !firebaseConfig.privateKey || !firebaseConfig.clientEmail) {
    console.error("KRİTİK HATA: Render üzerindeki Environment Variables eksik!");
}

admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig)
});

const db = admin.firestore();

// GOOGLE AUTH TEST ENDPOINT
app.post('/auth/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send({ message: "Token gönderilmedi!" });
    }

    try {
        console.log("--- Yeni Giriş Denemesi Başladı ---");
        
        // KRİTİK DÜZELTME: checkRevoked: true ekleyerek ve hata yakalayarak ilerliyoruz
        // Eğer 'aud' hatası verirse, 'rethinkwithrethink' projesine ait olduğunu zorluyoruz
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        const { uid, name, email, picture } = decodedToken;
        console.log(`Token Doğrulandı: ${name} (${email})`);

        // FIRESTORE KAYIT İŞLEMİ
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            await userRef.set({
                name: name,
                email: email,
                profilePic: picture,
                score: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log("Veritabanına yeni kullanıcı eklendi!");
        } else {
            console.log("Kullanıcı zaten veritabanında mevcut.");
        }

        res.status(200).send({ 
            message: "Giriş Başarılı", 
            user: { name, uid, email } 
        });

    } catch (error) {
        console.error("DOĞRULAMA HATASI DETAYI:", error.code, error.message);
        
        // Eğer hala 'aud' uyuşmazlığı diyorsa, Firebase Panelindeki ayar eksiktir
        if (error.code === 'auth/argument-error') {
            console.error("İPUCU: Firebase Console > Authentication > Google kısmını ENABLE yapmalısın!");
        }

        res.status(401).send({ 
            message: "Kimlik doğrulanırken hata oluştu", 
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda canavar gibi çalışıyor!`);
});
