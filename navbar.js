// Sitenin üst kısmında yer alan navbar şablonunu yükleyen fonksiyon
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
            <!-- Yenilenen 'Giriş Yap' Butonu (Tıklayınca doğrudan giris.html sayfasına yönlendirir) -->
            <button id="btn-login" onclick="window.location.href='giris.html'" class="btn-login" style="cursor: pointer; display: none;">
                Giriş Yap
            </button>

            <!-- Profil Bölümü (Sadece kullanıcı giriş yaptığında gerçek bilgileriyle görüntülenecektir) -->
            <div id="user-profile" class="user-profile" style="display: none;">
                <span id="user-name">Yükleniyor...</span>
                <img id="user-avatar" src="" alt="Profil" style="cursor: pointer;">
                
                <!-- Dropdown Menü -->
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

    // Kullanıcının oturum açıp açmadığını ve gerçek kullanıcı verilerini denetle
    const isLoggedIn = localStorage.getItem('rethink_logged_in') === 'true';
    const userData = JSON.parse(localStorage.getItem('rethink_user')); // Backend'in kaydettiği kullanıcı nesnesi

    const loginBtn = document.getElementById('btn-login');
    const userProfile = document.getElementById('user-profile');
    const userName = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');

    if (isLoggedIn && userData) {
        // Kullanıcı giriş yaptıysa: Giriş butonunu gizle, Profil panelini göster ve bilgileri doğrudan yaz
        if (loginBtn) loginBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        
        // Backend'den gelen gerçek kullanıcı adı ve profil resmini doğrudan yerleştiriyoruz
        if (userName) userName.textContent = userData.name || "Kullanıcı";
        if (userAvatar) userAvatar.src = userData.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop";
    } else {
        // Kullanıcı giriş yapmadıysa veya veri yoksa: Profil panelini gizle, Giriş butonunu göster
        if (loginBtn) loginBtn.style.display = 'block';
        if (userProfile) userProfile.style.display = 'none';
    }

    // Elemanlar DOM'a yazıldıktan sonra dropdown tetikleyicilerini kur
    setupDropdownLogic();
}

// Dropdown menüyü kontrol eden tıklama mantığı
function setupDropdownLogic() {
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

// Çıkış yapma fonksiyonu
function logout(e) {
    if (e) e.preventDefault();
    localStorage.removeItem('rethink_logged_in');
    localStorage.removeItem('rethink_user'); // Kullanıcı bilgilerini de temizle
    location.reload(); // Oturumu temizleyip sayfayı yeniler
}

// Sayfa yüklendiğinde navbar'ı başlat
document.addEventListener('DOMContentLoaded', loadNavbar);
