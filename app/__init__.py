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
CORS(app, resources={r"/*": {"origins": "*"}})

jwt = JWTManager(app)
db = SQLAlchemy(app)

from app import routes
from app import dev
