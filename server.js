const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const app = express();

app.use(cors()); // GitHub Pages'tan gelen isteklere izin ver
app.use(express.json());

// Firebase Admin Ayarları (Environment Variables'dan çekilecek)
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.post('/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        // Token'ı Firebase üzerinden doğrula
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid, name, email, picture } = decodedToken;

        // Kullanıcıyı veritabanında (Firestore) kontrol et veya oluştur
        const userRef = admin.firestore().collection('users').doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            await userRef.set({ name, email, picture, score: 0 });
        }

        res.status(200).send({ message: "Başarılı", user: { name, uid } });
    } catch (error) {
        res.status(401).send({ message: "Geçersiz Token" });
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Server koşturuyor!"));
