// ================= LOGIN =================
document.getElementById("loginForm")?.addEventListener("submit", async function(e){
    e.preventDefault();

    const email = this.querySelector("input[type=email]").value;
    const password = this.querySelector("input[type=password]").value;

    try {
        const res = await fetch("http://127.0.0.1:5000/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email, password})
        });

        const data = await res.json();

        if(res.ok){
            localStorage.setItem("token", data.access_token);
            alert("Login Successful");
            window.location.href = "dashboard.html";
        } else {
            alert("Invalid credentials");
        }

    } catch {
        alert("Server not running");
    }
});


// ================= REGISTER =================
document.getElementById("registerForm")?.addEventListener("submit", async function(e){
    e.preventDefault();

    const data = Object.fromEntries(new FormData(this).entries());

    try{
        const res = await fetch("http://127.0.0.1:5000/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        if(res.ok){
            alert("Registered!");
            window.location.href = "login.html";
        } else {
            alert("Registration failed");
        }
    } catch {
        alert("Server error");
    }
});


// ================= DARK MODE =================
function toggleTheme(){
    document.body.classList.toggle("dark");
    localStorage.setItem(
        "theme",
        document.body.classList.contains("dark") ? "dark" : "light"
    );
}


// ================= PAGE LOAD =================
window.addEventListener("load", () => {

    if(localStorage.getItem("theme") === "dark"){
        document.body.classList.add("dark");
    }

    if(document.getElementById("history")){
        loadHistory();
    }

    if(document.getElementById("myChart")){
        loadAnalytics();
    }
});


// ================= GENERATE CONTENT =================
async function generateContent(){

    const input = document.getElementById("userInput").value;
    const language = document.getElementById("languageSelect")?.value || "English";
    const token = localStorage.getItem("token");

    if(!token){
        alert("Login first");
        return;
    }

    if(!input){
        alert("Enter text first");
        return;
    }

    document.getElementById("loader").classList.remove("hidden");

    try{
        const res = await fetch("http://127.0.0.1:5000/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                text: input,
                language: language   // ✅ NEW
            })
        });

        const data = await res.json();

        if(!res.ok){
            alert(data.error || "Backend error");
            return;
        }

        // ✅ OUTPUT
        document.getElementById("simplified").innerText = data.explanation;

        document.getElementById("notesContent").innerHTML =
            (data.notes || []).map(n => `<li>${n}</li>`).join("");

        document.getElementById("mcqs").innerHTML =
            (data.mcqs || []).map((m,i) => `
                <p><b>Q${i+1}. ${m.question}</b></p>
                <p>A. ${m.options[0]}</p>
                <p>B. ${m.options[1]}</p>
                <p>C. ${m.options[2]}</p>
                <p>D. ${m.options[3]}</p>
            `).join("");

        document.getElementById("flashcards").innerHTML =
            (data.flashcards || []).map(f => `
                <div class="flashcard">
                    <b>${f.term}</b><br>${f.definition}
                </div>
            `).join("");

        loadYouTubeVideos(input);

    } catch(err){
        console.error(err);
        alert("Server error");
    }

    document.getElementById("loader").classList.add("hidden");
}
// ================= YOUTUBE VIDEOS =================
function loadYouTubeVideos(topic){

    const videoDiv = document.getElementById("videos");
    if(!videoDiv) return;

    const t = topic.toLowerCase();

    let videos = [];

    if(t.includes("operating system") || t.includes("os")){
        videos = [
            { title: "Operating System Full Course", id: "26QPDBe-NB8" },
            { title: "OS Explained Simply", id: "vBURTt97EkA" }
        ];
    }
    else if(t.includes("dbms")){
        videos = [
            { title: "DBMS Full Course", id: "dl00fOOYLOM" },
            { title: "DBMS Explained", id: "HXV3zeQKqGY" }
        ];
    }
    else{
        videos = [
            { title: "Programming Basics", id: "rfscVS0vtbw" },
            { title: "Computer Science Intro", id: "zOjov-2OZ0E" }
        ];
    }

    videoDiv.innerHTML = videos.map(v => `
        <div style="margin-bottom:20px; padding:15px; border-radius:12px; 
                    box-shadow:0 4px 10px rgba(0,0,0,0.1); background:#fff;">
            
            <img src="https://img.youtube.com/vi/${v.id}/0.jpg"
                 style="width:100%; border-radius:10px; cursor:pointer;"
                 onclick="window.open('https://www.youtube.com/watch?v=${v.id}', '_blank')">

            <h4>${v.title}</h4>

            <button onclick="window.open('https://www.youtube.com/watch?v=${v.id}', '_blank')">
                ▶ Watch on YouTube
            </button>
        </div>
    `).join("");
}


// ================= HISTORY (PREMIUM UI) =================
async function loadHistory(){

    const token = localStorage.getItem("token");
    if(!token) return;

    try{
        const res = await fetch("http://127.0.0.1:5000/history", {
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await res.json();

        document.getElementById("history").innerHTML =
            data.map(item => `
                <div style="
                    padding:15px;
                    border-radius:12px;
                    margin-bottom:15px;
                    background: linear-gradient(135deg,#e3f2fd,#ffffff);
                    box-shadow:0 4px 10px rgba(0,0,0,0.1);
                ">
                    <p><b>📅 Date:</b> ${item[2]}</p>
                    <p><b>📥 Input:</b> ${item[0]}</p>
                    <p><b>📤 Output:</b> ${item[1]}</p>
                </div>
            `).join("");

    } catch(err){
        console.error("History error:", err);
    }
}


// ================= ANALYTICS =================
async function loadAnalytics(){

    const token = localStorage.getItem("token");
    if(!token) return;

    try{
        const res = await fetch("http://127.0.0.1:5000/analytics", {
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await res.json();

        const ctx = document.getElementById('myChart');
        if(!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Daily Usage',
                    data: data.usage,
                    fill: true
                }]
            }
        });

    } catch(err){
        console.error("Analytics error:", err);
    }
}


// ================= FILE UPLOAD =================
document.getElementById("fileInput")?.addEventListener("change", function(e){
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById("userInput").value = e.target.result;
    };
    reader.readAsText(file);
});
