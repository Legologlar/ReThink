function handleCredentialResponse(response) {
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
    // Google butonunu tamamen yok et
    const buttonDiv = document.getElementById("buttonDiv");
    if(buttonDiv) {
        buttonDiv.style.display = "none";
        buttonDiv.classList.add("hidden");
    }

    // Profil alanını aç
    const profile = document.getElementById("user-profile");
    profile.classList.remove("hidden");
    profile.style.display = "flex";

    // İsim ve Resim bilgilerini doldur
    document.getElementById("user-name").innerText = user.name.split(' ')[0];
    const userImg = user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=2ecc71&color=fff`;
    
    document.getElementById("user-avatar").src = userImg;
    document.getElementById("info-avatar").src = userImg;
    document.getElementById("info-name").innerText = user.name;
    document.getElementById("info-email").innerText = user.email;
}

function navigateTo(endpoint) {
    const hero = document.querySelector('.hero');
    const accountView = document.getElementById('account-view');

    if (endpoint === 'account') {
        hero.style.display = 'none';
        accountView.style.display = 'flex';
    } else {
        accountView.style.display = 'none';
        hero.style.display = 'flex';
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
        { theme: "filled_blue", size: "large", shape: "pill", text: "continue_with" }
    );
}
