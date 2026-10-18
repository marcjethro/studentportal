import re
import unicodedata
from datetime import datetime

from flask import Blueprint
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, create_access_token
from werkzeug.security import generate_password_hash

from app import db, BACKEND_URL
from app.models import (
    Enrollment,
    Course,
    StudentInfo,
    EnrollmentType,
    DocumentRequirement,
    EnrollmentDocument,
    User,
    UserRole,
)
from app.utils import role_required, send_email, generate_random_password


enrollment_bp = Blueprint("enrollment", __name__)


def ensure_enrollment_documents(enrollment):
    """Ensures that document tracking records exist for an enrollment based on its enrollment type."""
    if not enrollment.documents:
        requirements = db.session.execute(
            db.select(DocumentRequirement).where(
                DocumentRequirement.enrollment_type_id == enrollment.enrollment_type_id
            )
        ).scalars().all()

        for req in requirements:
            doc = EnrollmentDocument(
                enrollment_id=enrollment.enrollment_id,
                requirement_id=req.requirement_id,
                status="Pending",
            )
            db.session.add(doc)
        db.session.commit()
    return enrollment.documents


@enrollment_bp.route("/requirements", methods=["POST"])
def handle_get_requirements():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    enrollment_type_id = request.json.get("enrollment_type_id", None)
    if not enrollment_type_id:
        return jsonify({"msg": "Missing enrollment_type_id"}), 400

    document_requirements = db.session.execute(
        db.select(DocumentRequirement).where(
            DocumentRequirement.enrollment_type_id == enrollment_type_id
        )
    ).scalars().all()
    return jsonify([requirement.asdict() for requirement in document_requirements]), 200


@enrollment_bp.route("/courses", methods=["GET"])
def handle_get_courses():
    courses = db.session.scalars(db.select(Course)).all()
    return jsonify([course.asdict() for course in courses]), 200


@enrollment_bp.route("/enrollments", methods=["POST"])
def handle_submit_enrollment():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    first_name = request.json.get("first_name", None)
    if not first_name:
        return jsonify({"msg": "Missing first_name"}), 400

    suffix = request.json.get("suffix", None)

    middle_name = request.json.get("middle_name", None)
    if not middle_name:
        return jsonify({"msg": "Missing middle_name"}), 400

    last_name = request.json.get("last_name", None)
    if not last_name:
        return jsonify({"msg": "Missing last_name"}), 400

    birthdate = request.json.get("birthdate", None)
    if not birthdate:
        return jsonify({"msg": "Missing birthdate"}), 400

    try:
        birthdate = datetime.strptime(birthdate, "%m/%d/%y").date()
    except ValueError:
        return jsonify({"msg": "Invalid birthdate format (MM/DD/YY)"}), 400

    phone_number = request.json.get("phone_number", None)
    if not phone_number:
        return jsonify({"msg": "Missing phone_number"}), 400

    email = request.json.get("email", None)
    if not email:
        return jsonify({"msg": "Missing email"}), 400

    home_address = request.json.get("home_address", None)
    if not home_address:
        return jsonify({"msg": "Missing home_address"}), 400

    course_id = request.json.get("course_id", None)
    if not course_id:
        return jsonify({"msg": "Missing course_id"}), 400

    year_level = request.json.get("year_level", None)
    if not year_level:
        return jsonify({"msg": "Missing year_level"}), 400

    semester = request.json.get("semester", None)
    if not semester:
        return jsonify({"msg": "Missing semester"}), 400

    preferred_schedule = request.json.get("preferred_schedule", None)
    if not preferred_schedule:
        return jsonify({"msg": "Missing preferred_schedule"}), 400

    enrollment_type_id = request.json.get("enrollment_type_id", None)
    if not enrollment_type_id:
        return jsonify({"msg": "Missing enrollment_type_id"}), 400

    enrollment_type = db.session.query(EnrollmentType).filter_by(
        enrollment_type_id=enrollment_type_id
    ).first()
    if enrollment_type is None:
        return jsonify({"msg": "Invalid enrollment_type_id"}), 400

    new_student_info = StudentInfo(
        first_name=first_name,
        suffix=suffix,
        middle_name=middle_name,
        last_name=last_name,
        birthdate=birthdate,
        phone_number=phone_number,
        email=email,
        home_address=home_address,
        course_id=course_id,
        year_level=year_level,
        semester=semester,
        preferred_schedule=preferred_schedule,
    )

    db.session.add(new_student_info)
    db.session.commit()

    new_enrollment = Enrollment(
        student_info_id=new_student_info.student_info_id,
        enrollment_type_id=enrollment_type_id,
        status="Pending",
    )

    db.session.add(new_enrollment)
    db.session.commit()

    # Initialize documents tracking for this enrollment
    reqs = db.session.execute(
        db.select(DocumentRequirement).where(
            DocumentRequirement.enrollment_type_id == enrollment_type_id
        )
    ).scalars().all()
    for r in reqs:
        db.session.add(
            EnrollmentDocument(
                enrollment_id=new_enrollment.enrollment_id,
                requirement_id=r.requirement_id,
                status="Pending",
            )
        )
    db.session.commit()

    try:
        send_email(
            "Enrollment Tracking",
            email,
            f"Enrollment Tracking Code: {new_enrollment.enrollment_id}",
        )
        return jsonify(
            {
                "enrollment_id": new_enrollment.enrollment_id,
                "msg": "Enrollment created successfully! enrollment_id sent to email!",
            }
        ), 200
    except Exception as e:
        return jsonify({"msg": "Email failed to send"}), 424


@enrollment_bp.route("/enrollments", methods=["GET"])
@role_required(["edp", "accounting", "registrar", "admin"])
def handle_get_enrollments():
    status_filter = request.args.get("status", None)
    query = db.select(Enrollment)
    if status_filter and status_filter.lower() != "all":
        query = query.where(Enrollment.status == status_filter)

    enrollments = db.session.scalars(query).unique().all()
    for enrollment in enrollments:
        ensure_enrollment_documents(enrollment)
    return jsonify([enrollment.asdict() for enrollment in enrollments]), 200


@enrollment_bp.route("/enrollments/<string:enrollment_id>", methods=["GET"])
def handle_get_enrollment_status(enrollment_id):
    enrollment = Enrollment.query.get_or_404(enrollment_id)
    ensure_enrollment_documents(enrollment)
    data = enrollment.asdict()
    requirements = db.session.execute(
        db.select(DocumentRequirement).where(
            DocumentRequirement.enrollment_type_id == enrollment.enrollment_type_id
        )
    ).scalars().all()
    data["requirements"] = [r.requirement_name for r in requirements]
    return jsonify(data), 200


@enrollment_bp.route("/enrollments/<string:enrollment_id>/documents", methods=["GET"])
@role_required(["registrar", "edp", "admin"])
def handle_get_enrollment_documents(enrollment_id):
    enrollment = Enrollment.query.get_or_404(enrollment_id)
    ensure_enrollment_documents(enrollment)
    return jsonify([doc.asdict() for doc in enrollment.documents]), 200


@enrollment_bp.route("/enrollments/<string:enrollment_id>/documents/validate", methods=["POST"])
@role_required(["registrar", "admin"])
def handle_validate_document(enrollment_id):
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    enrollment = Enrollment.query.get_or_404(enrollment_id)
    ensure_enrollment_documents(enrollment)

    validate_all = request.json.get("validate_all", False)
    if validate_all:
        for doc in enrollment.documents:
            doc.status = "Submitted"
            doc.verified_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            "msg": "All documents successfully confirmed as submitted!",
            "enrollment": enrollment.asdict()
        }), 200

    document_id = request.json.get("document_id", None)
    new_status = request.json.get("status", "Submitted")  # "Submitted" or "Pending"
    remarks = request.json.get("remarks", None)

    if not document_id:
        return jsonify({"msg": "Missing document_id"}), 400

    doc = EnrollmentDocument.query.filter_by(
        document_id=document_id, enrollment_id=enrollment_id
    ).first_or_404()
    doc.status = new_status
    doc.verified_at = datetime.utcnow() if new_status == "Submitted" else None
    if remarks is not None:
        doc.remarks = remarks

    db.session.commit()

    return jsonify({
        "msg": f"Document status updated to {new_status}.",
        "document": doc.asdict(),
        "enrollment": enrollment.asdict()
    }), 200


@enrollment_bp.route("/enrollments/<string:enrollment_id>/enroll", methods=["POST"])
@role_required(["registrar", "admin"])
def handle_enroll_student(enrollment_id):
    enrollment = Enrollment.query.get_or_404(enrollment_id)
    ensure_enrollment_documents(enrollment)

    if enrollment.status == "Enrolled":
        return jsonify({"msg": "Student is already enrolled."}), 400

    # Ensure all required documents are confirmed submitted
    unsubmitted = [d for d in enrollment.documents if d.status != "Submitted"]
    if unsubmitted:
        missing_names = ", ".join([
            d.requirement.requirement_name if d.requirement else "Document"
            for d in unsubmitted
        ])
        return jsonify({
            "msg": f"Cannot enroll: Not all required documents have been submitted to the office. Missing: {missing_names}"
        }), 400

    student_info = enrollment.student_info

    # Generate a unique username for the student: "lastname.firstname" (remove spaces, no middle name)
    def clean_name(name):
        norm = unicodedata.normalize('NFKD', name or '').encode('ascii', 'ignore').decode('utf-8')
        return re.sub(r'[^a-zA-Z0-9]', '', norm).lower()

    last_clean = clean_name(student_info.last_name)
    first_clean = clean_name(student_info.first_name)

    if not last_clean and not first_clean:
        base_username = f"student.{student_info.student_info_id}"
    elif not last_clean:
        base_username = first_clean
    elif not first_clean:
        base_username = last_clean
    else:
        base_username = f"{last_clean}.{first_clean}"

    # Generate a secure random password
    raw_password = generate_random_password(10)

    # Student role id
    student_role = UserRole.query.filter_by(role_name="student").first()
    role_id = student_role.role_id if student_role else 1

    # Check if student already has a user account by email
    existing_user = User.query.filter_by(email=student_info.email).first()

    username = base_username
    counter = 1
    if existing_user:
        conflict = User.query.filter(User.username == username, User.user_id != existing_user.user_id).first()
        while conflict:
            username = f"{base_username}{counter}"
            counter += 1
            conflict = User.query.filter(User.username == username, User.user_id != existing_user.user_id).first()

        existing_user.username = username
        existing_user.password_hash = generate_password_hash(raw_password)
        existing_user.role_id = role_id
    else:
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{counter}"
            counter += 1

        new_user = User(
            role_id=role_id,
            username=username,
            email=student_info.email,
            password=raw_password,
        )
        db.session.add(new_user)

    # Update enrollment status
    enrollment.status = "Enrolled"
    db.session.commit()

    # Send credentials email to student
    email_sent = False
    email_error = None
    subject = "Cebu Eastern College, Inc. - Official Enrollment & Student Portal Account"
    portal_link = f"{BACKEND_URL or ''}/index.html"
    email_text = f"""Dear {student_info.first_name} {student_info.last_name},

Congratulations! Your enrollment application (Tracking ID: {enrollment.enrollment_id}) at Cebu Eastern College, Inc. has been verified, and all required documents have been confirmed. You are now officially ENROLLED!

Course / Program: {student_info.course.course_name}
Year Level: {student_info.year_level} | Semester: {student_info.semester}
Preferred Schedule: {student_info.preferred_schedule}

Here are your Student Portal account credentials:
----------------------------------------------------
Username: {username}
Temporary Password: {raw_password}
Portal Login: {portal_link}
----------------------------------------------------

Please log in and update your password immediately upon your first login.

Warm regards,
Office of the Registrar
Cebu Eastern College, Inc.
"""

    try:
        send_email(subject, student_info.email, email_text)
        email_sent = True
    except Exception as e:
        email_error = str(e)
        print(f"Warning: Failed to send student credentials email: {e}")

    return jsonify({
        "msg": "Student successfully enrolled and student account created!",
        "enrollment_id": enrollment.enrollment_id,
        "username": username,
        "password": raw_password,
        "email_sent": email_sent,
        "email_error": email_error,
        "enrollment": enrollment.asdict(),
    }), 200


