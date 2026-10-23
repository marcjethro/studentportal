from os import getenv
from datetime import timedelta

from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = getenv("DB_URI")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["JWT_SECRET_KEY"] = getenv("JWT_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
app.config["JWT_VERIFY_SUB"] = False

BACKEND_URL = getenv("BACKEND_URL")

CORS(app, resources={r"/*": {"origins": "*"}})

jwt = JWTManager(app)
db = SQLAlchemy(app)

from app import dev
from app.routes.auth import auth_bp
from app.routes.main import main_bp
from app.routes.announcements import announcements_bp
from app.routes.enrollment import enrollment_bp
from app.routes.documents import documents_bp
from app.routes.student import student_bp

app.register_blueprint(main_bp)
app.register_blueprint(announcements_bp, url_prefix="/api")
app.register_blueprint(enrollment_bp, url_prefix="/api")
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(documents_bp, url_prefix="/api/documents")
app.register_blueprint(student_bp, url_prefix="/api/student")

# Ensure the database schema exists on startup.
# create_all() is idempotent: it only creates tables that are missing and
# never drops or alters existing tables, so it is safe to run on every boot.
# Without this, tables are only ever created by the /dev/resetdb endpoint,
# which leaves every DB-backed endpoint failing with "table does not exist"
# until a reset is run.
with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        # Don't prevent the app from booting if the DB is briefly unreachable;
        # the error will surface on the first request instead.
        print(f"Warning: db.create_all() at startup failed: {e}")
