// navbar.js

function loadNavbar() {
    const navbarTemplate = `
    <nav class="navbar">
        <div class="logo">Re<span>Think</span></div>
        
        <ul class="nav-links-container">
            <li><a href="index.html">Ana Sayfa</a></li>
            <li><a href="rehber.html">Geri Dönüşüm Rehberi</a></li>
            <li><a href="harita.html">Harita</a></li>
        </ul>
        
        <div class="auth-section">
            <button id="btn-login" class="btn-login" onclick="login()">Giriş Yap</button>

            <div id="user-profile" class="user-profile hidden">
                <span id="user-name">Yükleniyor...</span>
                <img id="user-avatar" src="" alt="Profil">
                <div class="dropdown" id="nav-dropdown">
                    <a href="hesap-ayarlari">Hesap Ayarları</a>
                    <a href="dashboard">Dashboard (İstatistikler)</a>
                    <hr style="border: 0; border-top: 1px solid rgba(0,0,0,0.05); margin: 8px 0;">
                    <a href="#" onclick="logout(event)" style="color: #e74c3c;">Çıkış Yap</a>
                </div>
            </div>
        </div>
    </nav>
    `;

    // Sayfanın en başına navbar'ı yerleştir
    document.body.insertAdjacentHTML('afterbegin', navbarTemplate);

    // Navbar HTML'e yazıldıktan sonra asenkron durum kontrolünü ve dropdown mantığını çalıştır
    checkLoginStatus();
    setupDropdownLogic();
}

// --- GİRİŞ YAPMA YÖNLENDİRMESİ ---
function login() {
    window.location.href = 'giris.html';
}

// --- OTURUM DURUMU KONTROLÜ (Görsel yapı korunarak Asenkron yapıldı) ---
async function checkLoginStatus() {
    const loginBtn = document.getElementById('btn-login');
    const userProfile = document.getElementById('user-profile');
    
    if (!loginBtn || !userProfile) return;

    // auth.js içindeki güvenli, JWT ve cihaz fingerprint kontrolü yapan fonksiyonu bekliyoruz
    const userData = await verifySessionWithBackend();

    if (userData) {
        try {
            // Elemanları backend'den gelen en güncel verilerle dolduruyoruz
            document.getElementById('user-name').textContent = userData.name;
            // Backend orijinal nesnesinde 'picture' döndüğü için burayı picture yaptık
            document.getElementById('user-avatar').src = userData.picture || 'assets/default-avatar.png';
            
            // Senin orijinal CSS gizleme/gösterme sınıfların
            loginBtn.classList.add('hidden');
            userProfile.classList.remove('hidden');
        } catch (e) {
            console.error("Arayüz elementleri doldurulamadı:", e);
        }
    } else {
        // Giriş yapılmadıysa veya token geçersiz/cihaz farklıysa varsayılan görünüm
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
}

// --- DROPDOWN MANTIĞI (Senin orijinal CSS '.open' sınıfı mantığın birebir korundu) ---
function setupDropdownLogic() {
    const profileArea = document.getElementById('user-profile');

    if (profileArea) {
        profileArea.addEventListener('click', function(e) {
            e.stopPropagation(); // Tıklamanın dışarı taşmasını engelle
            this.classList.toggle('open'); // style.css dosyanızdaki .user-profile.open kuralını tetikler
        });

        // Sayfada başka bir yere tıklandığında menüyü kapat
        document.addEventListener('click', function() {
            profileArea.classList.remove('open');
        });
    }
}

// --- ÇIKIŞ YAPMA FONKSİYONU ---
function logout(event) {
    if (event) event.preventDefault(); // Sayfa linkinin yukarı zıplamasını engeller
    
    // auth.js içinde yazdığımız güvenli çıkış ve yönlendirme fonksiyonunu çağırıyoruz
    handleLogout();
}

// Sayfa yüklendiğinde fonksiyonu çalıştır
loadNavbar();