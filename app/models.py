from werkzeug.security import generate_password_hash, check_password_hash

from app import app, db

class Announcement(db.Model):
    announcement_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    body = db.Column(db.Text, nullable=False)
    
    user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), nullable=False)
    author = db.relationship("User", back_populates="announcements", lazy="joined")

    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def asdict(self):
        res = dict()
        res["announcement_id"] = self.announcement_id
        res["title"] = self.title
        res["body"] = self.body
        res["created_at"] = self.created_at
        res["author"] = self.author.username
        return res

class UserRole(db.Model):
    role_id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(80), unique=True, nullable=False)

    users = db.relationship("User", back_populates="role")

    def asdict(self):
        res = dict()
        res["role_id"] = self.role_id
        res["name"] = self.role_name
        return res

class User(db.Model):
    user_id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("user_role.role_id"), nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(254), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    role = db.relationship("UserRole", back_populates="users", lazy="joined")
    announcements = db.relationship('Announcement', back_populates='author')

    def __init__(self, role_id, username, email, password):
        self.role_id = role_id
        self.username = username
        self.email = email
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def asdict(self):
        res = dict()
        res["user_id"] = self.user_id
        res["role"] = self.role.role_name
        res["username"] = self.username
        res["email"] = self.email
        return res
