// script.js içeriği bu şekilde olmalı:
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
    document.getElementById("buttonDiv").classList.add("hidden");
    document.getElementById("user-profile").classList.remove("hidden");
    document.getElementById("user-name").innerText = user.name;
    
    const avatarImg = document.getElementById("user-avatar");
    const infoAvatar = document.getElementById("info-avatar");
    const userImg = user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=2ecc71&color=fff`;
    
    avatarImg.src = userImg;
    if(infoAvatar) infoAvatar.src = userImg;

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
