from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from os import getenv

db_uri = getenv("DB_URI")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = db_uri

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)

with app.app_context():
    db.create_all()

from app import routes
