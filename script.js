// script.js - Giriş ve Profil Yönetim Merkezi

/**
 * Google Giriş Başarılı Olduğunda Tetiklenen Fonksiyon
 * Google'dan gelen şifreli token'ı alır ve Render backend'e gönderir.
 */
function handleCredentialResponse(response) {
    console.log("Google Token alındı, doğrulanıyor...");

    fetch('https://rethink-lhse.onrender.com/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
    })
    .then(res => {
        if (!res.ok) throw new Error("Backend doğrulama hatası");
        return res.json();
    })
    .then(data => {
        if (data.token && data.user) {
            console.log("Giriş başarılı! Oturum kaydediliyor...");
            
            // ÇAKIŞMA ÇÖZÜMÜ: Eski localStorage yerine yeni auth.js beynini tetikliyoruz
            saveSession(data.token, data.user);

            // Kullanıcıyı ana sayfaya yönlendiriyoruz, navbar orada otomatik yüklenecek
            window.location.href = 'index.html';
        }
    })
    .catch(err => console.error("Backend Hatası:", err));
}

/**
 * Sayfa Yüklendiğinde Google Butonunu Başlatan Mekanizma
 */
window.addEventListener("load", () => {
    // Eğer giris.html sayfasındaysak ve buttonDiv varsa Google butonunu oluştur
    const buttonDiv = document.getElementById("buttonDiv");
    
    if (buttonDiv && typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: "893805639538-gu30br0e9vvbgbfvk5g0vv35pe3t1tu9.apps.googleusercontent.com",
            callback: handleCredentialResponse
        });

        google.accounts.id.renderButton(
            buttonDiv,
            { 
                theme: "outline", 
                size: "large", 
                shape: "pill",
                text: "continue_with",
                width: "440" // Form genişliğiyle tam uyumlu
            } 
        );
    }
});

/**
 * Kullanıcı Puanını Arka Planda Güncel Tutan Fonksiyon
 */
async function refreshUserPoints() {
    // auth.js üzerinden aktif ve doğrulanmış kullanıcı verisini alıyoruz
    // Eğer kullanıcı giriş yapmadıysa fonksiyon burada durur, backend'i boşuna yormaz
    if (typeof getLocalUser !== 'function') return;
    const user = getLocalUser();
    if (!user || !user.uid) return;

    fetch(`https://rethink-lhse.onrender.com/user/${user.uid}`)
        .then(res => {
            if (!res.ok) throw new Error("Puan güncellenemedi");
            return res.json();
        })
        .then(data => {
            if (data && typeof updateLocalUser === 'function') {
                // auth.js içindeki veriyi günceller, böylece navbar anlık yeni puanı gösterir
                updateLocalUser(data);
            }
        })
        .catch(err => console.error("Puan güncellenirken hata:", err));
}

// Puan güncelleme döngüsünü başlat (Sadece giriş yapılmışsa anlamlı çalışır)
setInterval(refreshUserPoints, 5000);
