from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta, datetime
import sqlite3
import PyPDF2

# ---------------- APP INIT ----------------
app = Flask(__name__)
CORS(app)

# 🔐 JWT CONFIG
app.config["JWT_SECRET_KEY"] = "secret123"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1)
jwt = JWTManager(app)

# ---------------- DATABASE ----------------
def init_db():
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()

    # USERS TABLE
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        language TEXT
    )
    """)

    # HISTORY TABLE
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        input TEXT,
        output TEXT,
        created_at TEXT
    )
    """)

    conn.commit()
    conn.close()

init_db()

# ---------------- REGISTER ----------------
@app.route('/register', methods=['POST'])
def register():
    data = request.json

    try:
        conn = sqlite3.connect("database.db")
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO users (name,email,password,language) VALUES (?,?,?,?)",
            (
                data.get('name'),
                data.get('email'),
                data.get('password'),
                data.get('language', 'English')
            )
        )

        conn.commit()
        conn.close()

        return jsonify({"msg": "Registered Successfully"}), 200

    except:
        return jsonify({"error": "User already exists"}), 400


# ---------------- LOGIN ----------------
@app.route('/login', methods=['POST'])
def login():
    data = request.json

    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE email=? AND password=?",
        (data.get('email'), data.get('password'))
    )

    user = cursor.fetchone()
    conn.close()

    if user:
        token = create_access_token(identity=data.get('email'))
        return jsonify(access_token=token)

    return jsonify({"msg": "Invalid credentials"}), 401


# ---------------- GENERATE (ONLY ONE) ----------------
@app.route('/generate', methods=['POST'])
@jwt_required()
def generate():
    user = get_jwt_identity()
    data = request.json

    text = data.get('text', '')
    language = data.get('language', 'English')

    if not text:
        return jsonify({"error": "No input"}), 400

    sentences = [s.strip() for s in text.split('.') if s.strip()]

    explanation = " ".join(sentences[:2])
    notes = sentences[:5]

    keywords = list(set([w for w in text.split() if len(w) > 5]))[:5]

    mcqs = [{
        "question": f"What is {k}?",
        "options": [
            f"Definition of {k}",
            "Incorrect option",
            "Irrelevant option",
            "None of the above"
        ]
    } for k in keywords]

    flashcards = [
        {"term": k, "definition": f"Meaning of {k}"}
        for k in keywords
    ]

    # 🌍 LANGUAGE SUPPORT (BASIC)
    if language == "Hindi":
        explanation = "यह एक सरल व्याख्या है: " + explanation
        notes = ["• " + n for n in notes]

    # SAVE HISTORY
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO history (user_email,input,output,created_at) VALUES (?,?,?,?)",
        (user, text, explanation, datetime.now().strftime("%Y-%m-%d"))
    )

    conn.commit()
    conn.close()

    return jsonify({
        "explanation": explanation,
        "notes": notes,
        "mcqs": mcqs,
        "flashcards": flashcards
    })


# ---------------- PDF SUMMARIZER ----------------
@app.route('/summarize-pdf', methods=['POST'])
@jwt_required()
def summarize_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400

    file = request.files['file']
    reader = PyPDF2.PdfReader(file)

    text = ""
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            text += extracted

    sentences = [s.strip() for s in text.split('.') if s.strip()]

    return jsonify({
        "explanation": " ".join(sentences[:3]),
        "notes": sentences[:5],
        "mcqs": [],
        "flashcards": []
    })


# ---------------- HISTORY ----------------
@app.route('/history', methods=['GET'])
@jwt_required()
def history():
    user = get_jwt_identity()

    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()

    cursor.execute(
        "SELECT input,output,created_at FROM history WHERE user_email=?",
        (user,)
    )

    data = cursor.fetchall()
    conn.close()

    return jsonify(data)


# ---------------- ANALYTICS ----------------
@app.route('/analytics', methods=['GET'])
@jwt_required()
def analytics():
    user = get_jwt_identity()

    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()

    cursor.execute("""
        SELECT created_at, COUNT(*)
        FROM history
        WHERE user_email=?
        GROUP BY created_at
        ORDER BY created_at
    """, (user,))

    data = cursor.fetchall()
    conn.close()

    dates = [row[0] for row in data]
    counts = [row[1] for row in data]

    return jsonify({
        "dates": dates,
        "usage": counts
    })


# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True)
