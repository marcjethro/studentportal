from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from os import getenv

db_uri = getenv("DB_URI")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["SQLALCHEMY_DATABASE_URI"] = db_uri

db = SQLAlchemy(app)

from app import routes
