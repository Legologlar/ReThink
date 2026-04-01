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
    // KONSOL KONTROLÜ: Tarayıcıda F12'ye basıp "Gelen Veri:" satırına bak. 
    // Orada 'picture' diye bir alan var mı kontrol et.
    console.log("Gelen Veri:", user);

    const buttonDiv = document.getElementById("buttonDiv");
    if(buttonDiv) buttonDiv.style.display = "none";

    const profile = document.getElementById("user-profile");
    profile.classList.remove("hidden");
    profile.style.display = "flex";

    // İsmi yerleştir
    document.getElementById("user-name").innerText = user.name || "Kullanıcı";
    
    const avatarImg = document.getElementById("user-avatar");

    // RESİM ALGILAMA MANTIĞI
    // Google bazen 'picture' bazen 'photo' olarak gönderir. Hepsini kontrol ediyoruz.
    const googleResmi = user.picture || user.photo || user.avatar;

    if (googleResmi) {
        avatarImg.src = googleResmi;
        
        // Eğer resim yüklenirken hata verirse (algılayamazsa) yedek devreye girsin
        avatarImg.onerror = function() {
            this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2ecc71&color=fff`;
        };
    } else {
        // Eğer Google'dan hiç resim gelmediyse direkt yedek oluştur
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=2ecc71&color=fff`;
    }
}

function logout() {
    window.location.reload();
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
