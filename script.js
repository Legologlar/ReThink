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
    // Giriş verilerini tarayıcı hafızasına (localStorage) kaydediyoruz
    localStorage.setItem('rethink_user', JSON.stringify(user));

    document.getElementById("buttonDiv").classList.add("hidden");
    const profile = document.getElementById("user-profile");
    profile.classList.remove("hidden");
    profile.style.display = "flex";
    
    document.getElementById("user-name").innerText = user.name;
    document.getElementById("user-avatar").src = user.picture;
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
