from datetime import datetime, date

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
    documents = db.relationship("EnrollmentDocument", back_populates="enrollment", cascade="all, delete-orphan", lazy="select")

    def asdict(self):
        res = dict()
        res["enrollment_id"] = self.enrollment_id
        res["enrollment_type"] = self.enrollment_type.enrollment_type_name
        res["enrollment_type_id"] = self.enrollment_type_id
        res["student_info"] = self.student_info.asdict()
        res["status"] = self.status
        docs = [d.asdict() for d in (self.documents or [])]
        res["documents"] = docs
        res["total_documents"] = len(docs)
        res["submitted_documents"] = sum(1 for d in docs if d["status"] == "Submitted")
        res["all_documents_submitted"] = len(docs) > 0 and res["submitted_documents"] == len(docs)
        return res


class EnrollmentDocument(db.Model):
    document_id = db.Column(db.Integer, primary_key=True)
    enrollment_id = db.Column(db.String(8), db.ForeignKey('enrollment.enrollment_id'), nullable=False)
    requirement_id = db.Column(db.Integer, db.ForeignKey('document_requirement.requirement_id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="Pending")  # "Pending", "Submitted", "Invalid"
    remarks = db.Column(db.String(255), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)

    enrollment = db.relationship("Enrollment", back_populates="documents")
    requirement = db.relationship("DocumentRequirement", lazy="joined")

    def asdict(self):
        return {
            "document_id": self.document_id,
            "enrollment_id": self.enrollment_id,
            "requirement_id": self.requirement_id,
            "requirement_name": self.requirement.requirement_name if self.requirement else "Document Requirement",
            "status": self.status,
            "remarks": self.remarks,
            "verified_at": self.verified_at.strftime("%Y-%m-%d %H:%M:%S") if self.verified_at else None
        }


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
        res["birthdate"] = self.birthdate.strftime("%m/%d/%y") if isinstance(self.birthdate, (datetime, date)) else str(self.birthdate) if self.birthdate else None
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


class DocumentType(db.Model):
    __tablename__ = "document_type"
    document_type_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(30), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    processing_days = db.Column(db.Integer, default=3)
    fee = db.Column(db.Float, default=0.0)
    requires_clearance = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)

    requests = db.relationship("DocumentRequest", back_populates="document_type")

    def asdict(self):
        return {
            "document_type_id": self.document_type_id,
            "name": self.name,
            "code": self.code,
            "description": self.description or "",
            "processing_days": self.processing_days,
            "fee": float(self.fee) if self.fee is not None else 0.0,
            "requires_clearance": bool(self.requires_clearance),
            "is_active": bool(self.is_active)
        }


class DocumentRequest(db.Model):
    __tablename__ = "document_request"
    request_id = db.Column(db.String(20), primary_key=True)
    student_user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), nullable=False)

    student_name = db.Column(db.String(120), nullable=False)
    student_number = db.Column(db.String(50), nullable=True)
    course_name = db.Column(db.String(120), nullable=True)
    year_level = db.Column(db.String(30), nullable=True)
    contact_number = db.Column(db.String(30), nullable=True)
    email = db.Column(db.String(120), nullable=True)

    document_type_id = db.Column(db.Integer, db.ForeignKey('document_type.document_type_id'), nullable=False)
    copies = db.Column(db.Integer, default=1, nullable=False)
    purpose = db.Column(db.String(200), nullable=False)
    special_instructions = db.Column(db.Text, nullable=True)

    # Statuses: 'Pending', 'Approved', 'Rejected', 'Ready for Pickup', 'Released', 'Cancelled'
    status = db.Column(db.String(30), default="Pending", nullable=False)

    # Registrar Review
    registrar_user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), nullable=True)
    registrar_reviewed_at = db.Column(db.DateTime, nullable=True)
    registrar_remarks = db.Column(db.Text, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)

    # EDP Release
    edp_user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), nullable=True)
    edp_prepared_at = db.Column(db.DateTime, nullable=True)
    pickup_location = db.Column(db.String(120), nullable=True)
    released_at = db.Column(db.DateTime, nullable=True)
    released_to = db.Column(db.String(120), nullable=True)
    release_notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    student_user = db.relationship("User", foreign_keys=[student_user_id], backref="document_requests", lazy="joined")
    registrar_user = db.relationship("User", foreign_keys=[registrar_user_id], lazy="joined")
    edp_user = db.relationship("User", foreign_keys=[edp_user_id], lazy="joined")
    document_type = db.relationship("DocumentType", back_populates="requests", lazy="joined")
    logs = db.relationship("DocumentRequestLog", back_populates="request", cascade="all, delete-orphan", order_by="DocumentRequestLog.created_at.asc()", lazy="select")

    def asdict(self, include_logs=True):
        res = {
            "request_id": self.request_id,
            "student_user_id": self.student_user_id,
            "student_username": self.student_user.username if self.student_user else None,
            "student_name": self.student_name,
            "student_number": self.student_number or "",
            "course_name": self.course_name or "",
            "year_level": self.year_level or "",
            "contact_number": self.contact_number or "",
            "email": self.email or (self.student_user.email if self.student_user else ""),
            "document_type_id": self.document_type_id,
            "document_name": self.document_type.name if self.document_type else "Document",
            "document_code": self.document_type.code if self.document_type else "",
            "processing_days": self.document_type.processing_days if self.document_type else 3,
            "fee": float(self.document_type.fee) if self.document_type and self.document_type.fee else 0.0,
            "copies": self.copies,
            "purpose": self.purpose,
            "special_instructions": self.special_instructions or "",
            "status": self.status,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else None,

            # Registrar
            "registrar_user_id": self.registrar_user_id,
            "registrar_name": self.registrar_user.username if self.registrar_user else None,
            "registrar_reviewed_at": self.registrar_reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if self.registrar_reviewed_at else None,
            "registrar_remarks": self.registrar_remarks or "",
            "rejection_reason": self.rejection_reason or "",

            # EDP
            "edp_user_id": self.edp_user_id,
            "edp_name": self.edp_user.username if self.edp_user else None,
            "edp_prepared_at": self.edp_prepared_at.strftime("%Y-%m-%d %H:%M:%S") if self.edp_prepared_at else None,
            "pickup_location": self.pickup_location or "EDP / Registrar Counter",
            "released_at": self.released_at.strftime("%Y-%m-%d %H:%M:%S") if self.released_at else None,
            "released_to": self.released_to or "",
            "release_notes": self.release_notes or ""
        }
        if include_logs:
            res["logs"] = [log.asdict() for log in (self.logs or [])]
        return res


class DocumentRequestLog(db.Model):
    __tablename__ = "document_request_log"
    log_id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(20), db.ForeignKey('document_request.request_id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(30), nullable=False)
    actor_user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), nullable=True)
    actor_name = db.Column(db.String(100), nullable=True)
    actor_role = db.Column(db.String(30), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    request = db.relationship("DocumentRequest", back_populates="logs")

    def asdict(self):
        return {
            "log_id": self.log_id,
            "request_id": self.request_id,
            "action": self.action,
            "status": self.status,
            "actor_name": self.actor_name or "System",
            "actor_role": self.actor_role or "",
            "notes": self.notes or "",
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None
        }
