from os import getenv
from datetime import timedelta

from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from flask_mail import Mail, Message

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = getenv("DB_URI")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["JWT_SECRET_KEY"] = getenv("JWT_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
app.config["JWT_VERIFY_SUB"] = False

app.config['MAIL_SERVER'] = 'smtp.gmail.com'          # Change to your provider's SMTP server
app.config['MAIL_PORT'] = 587                         # Port 587 for TLS, or 465 for SSL
app.config['MAIL_USE_TLS'] = True                     # Set to True if using port 587
app.config['MAIL_USE_SSL'] = False                    # Set to True if using port 465
app.config['MAIL_USERNAME'] = 'bsit3sec2@gmail.com'   # Your email address
app.config['MAIL_PASSWORD'] = getenv("MAIL_KEY")
app.config['MAIL_DEFAULT_SENDER'] = 'bsit3sec2@gmail.com'

BACKEND_URL = getenv("BACKEND_URL")

mail = Mail(app)

CORS(app, resources={r"/*": {"origins": "*"}})

jwt = JWTManager(app)
db = SQLAlchemy(app)

from app import routes
from app import dev
