// auth.js - Kimlik Doğrulama ve Oturum Yönetim Merkezi

const AUTH_CONFIG = {
    // Kendi Node.js backend URL'ini buraya yazmalısın
    BASE_URL: 'https://rethink-lhse.onrender.com' 
};

/**
 * Kullanıcı giriş yaptığında backend'den dönen token ve user verilerini lokal hafızaya kaydeder.
 * Giriş (giris.html) başarılı olduğunda bu fonksiyonu çağırabilirsin.
 */
function saveSession(token, user) {
    localStorage.setItem('rethink_token', token);
    localStorage.setItem('rethink_user', JSON.stringify(user));
}

/**
 * Backend üzerinden mevcut tokenın ve cihazın (Fingerprint) geçerli olup olmadığını denetler.
 * @returns {Promise<Object|null>} Kullanıcı verisi (başarılıysa) veya null (başarısızsa)
 */
async function verifySessionWithBackend() {
    const token = localStorage.getItem('rethink_token');
    
    // Eğer tarayıcıda hiç token yoksa doğrudan null dön, backend'i boşuna yorma
    if (!token) {
        return null;
    }

    try {
        const response = await fetch(`${AUTH_CONFIG.BASE_URL}/auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Tokenı HTTP Authorization başlığı altında "Bearer <token>" düzeninde gönderiyoruz
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Backend 401 veya başka bir hata kodu döndüyse (Cihaz uyuşmazlığı, süresi dolmuş token vb.)
            throw new Error('Oturum geçersiz veya cihaz uyuşmuyor.');
        }

        const data = await response.json();
        
        // Eğer her şey geçerliyse backend'den gelen en güncel veriyi lokale tekrar yazıp güncelle (Örn: Puan değiştiyse)
        if (data.valid && data.user) {
            localStorage.setItem('rethink_user', JSON.stringify(data.user));
            return data.user;
        }

        return null;

    } catch (error) {
        console.error("Oturum doğrulanırken hata oluştu:", error.message);
        // Güvenlik riski oluşmaması için doğrulanmayan her hatada oturumu temizle
        clearLocalSession();
        return null;
    }
}

/**
 * Tarayıcıdaki tüm oturum verilerini kazır.
 */
function clearLocalSession() {
    localStorage.removeItem('rethink_token');
    localStorage.removeItem('rethink_user');
}

/**
 * Çıkış yapma fonksiyonu. 
 * Hem yerel verileri siler hem de sayfayı güvenli bir şekilde ana sayfaya yönlendirir.
 */
function handleLogout() {
    clearLocalSession();
    // Sayfayı yenilemek yerine doğrudan ana sayfaya yönlendiriyoruz ki cache (önbellek) kilitlenmeleri yaşanmasın
    window.location.href = 'index.html'; 
}
