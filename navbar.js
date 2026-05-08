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
            <div id="buttonDiv"></div>

            <div id="user-profile" class="user-profile">
                <span id="user-name">Yükleniyor...</span>
                <img id="user-avatar" src="" alt="Profil">
                <div class="dropdown">
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
}

// --- DROPDOWN MANTIĞI BURADA ---
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

// Sayfa yüklendiğinde fonksiyonu çalıştır
loadNavbar();
