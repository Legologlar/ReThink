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
            // kullanıcı bilgisi
            localStorage.setItem("user_data", JSON.stringify(data.user));
        
            // 🔥 TOKEN BURADA KAYDEDİLİYOR
            localStorage.setItem("token", data.token);
        
            updateUI(data.user);
        }
    })
    .catch(err => console.error("Backend Hatası:", err));
}

function updateUI(user) {

    localStorage.setItem('user_data', JSON.stringify(user));

    const buttonDiv = document.getElementById("buttonDiv");
    if (buttonDiv) buttonDiv.style.display = "none";

    const profile = document.getElementById("user-profile");
    if (profile) {
        profile.classList.remove("hidden");
        profile.style.display = "flex";
    }

    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.innerText = user.name || "Kullanıcı";

    const userImg = user.picture || user.photo || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "User")}`;

    const avatarEl = document.getElementById("user-avatar");
    if (avatarEl) avatarEl.src = userImg;
}

function logout() {
    localStorage.removeItem('user_data');

    const profile = document.getElementById("user-profile");
    if (profile) profile.classList.add("hidden");

    const buttonDiv = document.getElementById("buttonDiv");
    if (buttonDiv) buttonDiv.style.display = "block";

    window.location.href = 'index.html';
}

window.addEventListener("load", () => {

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

    const savedUser = localStorage.getItem('user_data');

    if (savedUser) {
        try {
            updateUI(JSON.parse(savedUser));
        } catch (e) {
            localStorage.removeItem("user_data");
        }
    }

    fetch("https://rethink-lhse.onrender.com/user/me", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => res.json())
    .then(user => {
        if (user) {
            localStorage.setItem("user_data", JSON.stringify(user));
            updateUI(user);
        }
    })
    .catch(err => console.error(err));
});

const profile = document.getElementById("user-profile");

if (profile) {
    profile.addEventListener("click", () => {
        profile.classList.toggle("open");
    });
}

