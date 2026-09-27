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

app.register_blueprint(main_bp)
app.register_blueprint(announcements_bp, url_prefix="/api")
app.register_blueprint(auth_bp, url_prefix="/api/auth")
