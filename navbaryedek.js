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
                    <a href="#" onclick="logout()" style="color: #e74c3c;">Çıkış Yap</a>
                </div>
            </div>
        </div>
    </nav>
    `;

    // Sayfanın en başına navbar'ı yerleştir
    document.body.insertAdjacentHTML('afterbegin', navbarTemplate);

    // Navbar HTML'e yazıldıktan sonra dropdown ve durum kontrollerini çalıştır
    checkLoginStatus();
    setupDropdownLogic();
}

// --- GİRİŞ YAPMA YÖNLENDİRMESİ ---
function login() {
    window.location.href = 'giris.html';
}

// --- OTURUM DURUMU KONTROLÜ ---
function checkLoginStatus() {
    const loginBtn = document.getElementById('btn-login');
    const userProfile = document.getElementById('user-profile');
    
    // Backend oturum açtığında localstorage'a 'rethink_user' objesini yazmalı
    // Örnek: localStorage.setItem('rethink_user', JSON.stringify({ name: 'Ahmet', avatar: 'profil.png' }));
    const savedUser = localStorage.getItem('rethink_user');

    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            
            // Elemanları doldur ve görünürlüğü değiştir
            document.getElementById('user-name').textContent = userData.name;
            document.getElementById('user-avatar').src = userData.avatar;
            
            loginBtn.classList.add('hidden');
            userProfile.classList.remove('hidden');
        } catch (e) {
            console.error("Kullanıcı verisi ayrıştırılamadı:", e);
        }
    } else {
        // Giriş yapılmadıysa varsayılan görünüm
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
}

// --- DROPDOWN MANTIĞI (style.css ".open" sınıfı ile tam uyumlu) ---
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

// Çıkış Yapma Fonksiyonu
function logout() {
    localStorage.removeItem('rethink_user');
    window.location.reload(); // Sayfayı yenileyerek navbar durumunu sıfırla
}

// Sayfa yüklendiğinde fonksiyonu çalıştır
loadNavbar();
