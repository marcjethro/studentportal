from werkzeug.security import generate_password_hash, check_password_hash

from app import app, db

class UserRole(db.Model):
    role_id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(80), unique=True, nullable=False)

    users = db.relationship("User", back_populates="role")

class User(db.Model):
    user_id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("user_role.role_id"), nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    role = db.relationship("UserRole", back_populates="users", lazy="joined")

    def __init__(self, role_id, username, email, password):
        self.role_id = role_id
        self.username = username
        self.email = email
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
