function handleCredentialResponse(response) {
    console.log("Token alındı, doğrulanıyor...");

    fetch('https://rethink-lhse.onrender.com/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
    })
    .then(res => res.json())
    .then(data => {
        if(data.user) {
            updateUI(data.user);
        }
    })
    .catch(err => console.error("Backend Hatası:", err));
}

function updateUI(user) {
    // KONTROL: Konsolda 'picture' alanının dolu olduğundan emin olalım
    console.log("Kaydedilen Kullanıcı Verisi:", user);

    // Tüm objeyi hafızaya atıyoruz (picture dahil)
    localStorage.setItem('user_data', JSON.stringify(user));

    // Ana sayfadaki görseli güncelle
    const buttonDiv = document.getElementById("buttonDiv");
    if(buttonDiv) buttonDiv.style.display = "none";

    const profile = document.getElementById("user-profile");
    if(profile) {
        profile.classList.remove("hidden");
        profile.style.display = "flex";
    }

    document.getElementById("user-name").innerText = user.name || "Kullanıcı";
    
    // Ana sayfadaki küçük avatar
    const userImg = user.picture || user.photo || `https://ui-avatars.com/api/?name=${user.name}`;
    document.getElementById("user-avatar").src = userImg;
}

function logout() {
    localStorage.removeItem('user_data'); // Hafızayı sil
    window.location.href = 'index.html'; // Ana sayfaya dön
}

window.onload = function () {
    google.accounts.id.initialize({
        client_id: "893805639538-gu30br0e9vvbgbfvk5g0vv35pe3t1tu9.apps.googleusercontent.com",
        callback: handleCredentialResponse
    });

    google.accounts.id.renderButton(
        document.getElementById("buttonDiv"),
        { 
            theme: "filled_blue", 
            size: "large", 
            shape: "pill",
            text: "continue_with"
        } 
    );
}

// Sayfa her yüklendiğinde hafızada kullanıcı var mı kontrol et
window.addEventListener('load', function() {
    const savedUser = localStorage.getItem('user_data');
    if (savedUser) {
        updateUI(JSON.parse(savedUser));
    }
});
