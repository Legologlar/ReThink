function loadNavbar() {
    // Sitenin giriş durumu kontrolü (Backend entegrasyonuna kadar localStorage ile simüle edilir)
    const isLoggedIn = localStorage.getItem('rethink_logged_in') === 'true';
    const userName = localStorage.getItem('rethink_user_name') || "Normal Kullanıcı";
    const userAvatar = localStorage.getItem('rethink_user_avatar') || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop";

    const navbarTemplate = `
    <nav class="navbar">
        <div class="logo">Re<span>Think</span></div>
        
        <ul class="nav-links-container">
            <li><a href="index.html">Ana Sayfa</a></li>
            <li><a href="rehber.html">Geri Dönüşüm Rehberi</a></li>
            <li><a href="harita.html">Harita</a></li>
        </ul>
        
        <div class="auth-section">
            <!-- Google Giriş Yerine Eklenen Standart Giriş Yap Butonu -->
            <button id="btn-login" class="btn-login" onclick="login()" style="display: ${isLoggedIn ? 'none' : 'block'};">
                Giriş Yap
            </button>

            <!-- Giriş Yapan Kullanıcının Profili (Giriş yapılmadıysa gizlenir) -->
            <div id="user-profile" class="user-profile" style="display: ${isLoggedIn ? 'flex' : 'none'};">
                <span id="user-name">${userName}</span>
                <img id="user-avatar" src="${userAvatar}" alt="Profil" style="cursor: pointer;">
                
                <!-- JS'deki id ile eşleşmesi için id="nav-dropdown" eklendi -->
                <div id="nav-dropdown" class="dropdown">
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

    // --- DROPDOWN VE GİRİŞ ETKİLEŞİM MANTIĞI ---
    // Elemanlar DOM'a eklendikten sonra seçici işlemleri güvenle çalıştırılır
    const avatar = document.getElementById('user-avatar');
    const dropdown = document.getElementById('nav-dropdown');

    if (avatar && dropdown) {
        avatar.addEventListener('click', function(e) {
            e.stopPropagation(); // Tıklamanın dışarı taşmasını engelle
            dropdown.classList.toggle('active'); // 'active' class'ını aç/kapat
        });

        // Sayfada başka bir yere tıklandığında menüyü kapat
        document.addEventListener('click', function() {
            dropdown.classList.remove('active');
        });
    }
}

// Simüle edilmiş Giriş Yapma fonksiyonu (Backend tarafını bağlarken burayı düzenleyebilirsin)
function login() {
    localStorage.setItem('rethink_logged_in', 'true');
    localStorage.setItem('rethink_user_name', 'Normal Kullanıcı');
    // Sayfayı yenileyerek yeni durumu yansıtıyoruz
    location.reload();
}

// Çıkış yapma fonksiyonu
function logout(e) {
    if (e) e.preventDefault();
    localStorage.removeItem('rethink_logged_in');
    localStorage.removeItem('rethink_user_name');
    location.reload();
}

// Sayfa yüklendiğinde fonksiyonu çalıştır
document.addEventListener('DOMContentLoaded', loadNavbar);
