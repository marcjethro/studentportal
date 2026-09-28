from datetime import datetime

from werkzeug.security import generate_password_hash, check_password_hash

from app import app, db
from app.utils import generate_random_id

class Course(db.Model):
    course_id = db.Column(db.Integer, primary_key=True)
    course_name = db.Column(db.String(50), nullable=False)
    students = db.relationship("StudentInfo", back_populates="course")

    def asdict(self):
        res = dict()
        res["course_id"] = self.course_id
        res["course_name"] = self.course_name
        return res

class Enrollment(db.Model):
    enrollment_id = db.Column(db.String(8), primary_key=True, default=generate_random_id)

    student_info_id = db.Column(db.Integer, db.ForeignKey('student_info.student_info_id'), nullable=False)
    student_info = db.relationship("StudentInfo", back_populates="enrollments", lazy="joined")

    enrollment_type_id = db.Column(db.Integer, db.ForeignKey('enrollment_type.enrollment_type_id'), nullable=False)
    enrollment_type = db.relationship("EnrollmentType", back_populates="enrollments", lazy="joined")

    status = db.Column(db.String(20), nullable=False)

    def asdict(self):
        res = dict()
        res["enrollment_id"] = self.enrollment_id
        res["enrollment_type"] = self.enrollment_type.enrollment_type_name
        res["student_info"] = self.student_info.asdict()
        res["status"] = self.status
        return res


class StudentInfo(db.Model):
    student_info_id = db.Column(db.Integer, primary_key=True)

    # --- Personal Information ---
    first_name = db.Column(db.String(50), nullable=False)
    middle_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=False)
    suffix = db.Column(db.String(10), nullable=True)

    birthdate = db.Column(db.Date, nullable=False)        
    
    phone_number = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    home_address = db.Column(db.Text, nullable=False)

    # --- Academic & Enrollment Details ---
    course_id = db.Column(db.Integer, db.ForeignKey('course.course_id'), nullable=False)
    course = db.relationship("Course", back_populates="students", lazy="joined")

    year_level = db.Column(db.String(20), nullable=False)
    semester = db.Column(db.String(20), nullable=False)
    preferred_schedule = db.Column(db.String(50), nullable=False)

    enrollments = db.relationship("Enrollment", back_populates="student_info")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def asdict(self):
        res = dict()
        res["student_info_id"] = self.student_info_id
        res["first_name"] = self.first_name
        res["middle_name"] = self.middle_name
        res["last_name"] = self.last_name
        res["suffix"] = self.suffix
        res["birthdate"] = self.birthdate
        res["phone_number"] = self.phone_number
        res["email"] = self.email
        res["home_address"] = self.home_address
        res["course"] = self.course.course_name
        res["year"] = self.year_level
        res["semester"] = self.semester
        res["preferred_schedule"] = self.preferred_schedule
        return res

class EnrollmentType(db.Model):
    enrollment_type_id = db.Column(db.Integer, primary_key=True)
    enrollment_type_name = db.Column(db.String(50))

    enrollments = db.relationship("Enrollment", back_populates="enrollment_type")
    document_requirements = db.relationship("DocumentRequirement", back_populates="enrollment_type")

class DocumentRequirement(db.Model):
    requirement_id = db.Column(db.Integer, primary_key=True)
    requirement_name = db.Column(db.String(50))
    enrollment_type_id = db.Column(db.Integer, db.ForeignKey('enrollment_type.enrollment_type_id'), nullable=False)
    enrollment_type = db.relationship("EnrollmentType", back_populates="document_requirements", lazy="joined")

    def asdict(self):
        res = dict()
        res["requirement_id"] = self.requirement_id
        res["requirement_name"] = self.requirement_name
        res["enrollment_type"] = self.enrollment_type.enrollment_type_name
        return res

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
