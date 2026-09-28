from datetime import datetime

from flask import Blueprint
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, create_access_token

from app import db, BACKEND_URL
from app.models import Enrollment, Course, StudentInfo, EnrollmentType, DocumentRequirement
from app.utils import role_required, send_email


enrollment_bp = Blueprint("enrollment", __name__)

@enrollment_bp.route("/requirements", methods=["POST"])
def handle_get_requirements():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    enrollment_type_id = request.json.get("enrollment_type_id", None)
    if not enrollment_type_id:
        return jsonify({"msg": "Missing enrollment_type_id"}), 400

    document_requirements = db.session.execute(db.select(DocumentRequirement).where(DocumentRequirement.enrollment_type_id == enrollment_type_id)).scalars().all()
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

    enrollment_type = db.session.query(EnrollmentType).filter_by(enrollment_type_id=enrollment_type_id).first()
    if enrollment_type is None:
        return jsonify({"msg": "Invalid enrollment_type_id"}), 400

    new_student_info = StudentInfo(first_name=first_name, suffix=suffix, middle_name=middle_name, last_name=last_name, birthdate=birthdate, phone_number=phone_number, email=email, home_address=home_address, course_id=course_id, year_level=year_level, semester=semester, preferred_schedule=preferred_schedule)

    db.session.add(new_student_info)
    db.session.commit()

    new_enrollment = Enrollment(student_info_id=new_student_info.student_info_id, enrollment_type_id=enrollment_type_id, status="Pending")

    db.session.add(new_enrollment)
    db.session.commit()

    try:
        send_email("Enrollment Tracking", email, f"Enrollment Tracking Code: {new_enrollment.enrollment_id}")
        return jsonify({"enrollment_id": new_enrollment.enrollment_id, "msg": "Enrollment created successfully! enrollment_id sent to email!"}), 200
    except Exception as e:
        return jsonify({"msg": "Email failed to send"}), 424

@enrollment_bp.route("/enrollments", methods=["GET"])
@role_required(["edp", "accounting", "registrar"])
def handle_get_enrollments():
    enrollments = db.session.scalars(db.select(Enrollment)).all()
    return jsonify([enrollment.asdict() for enrollment in enrollments]), 200

@enrollment_bp.route("/enrollments/<string:enrollment_id>", methods=["GET"])
def handle_get_enrollment_status(enrollment_id):
    enrollment = Enrollment.query.get_or_404(enrollment_id)

    return jsonify(enrollment.asdict()), 200

