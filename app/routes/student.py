import re
from datetime import datetime, date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import User, StudentInfo, Course, Enrollment
from app.utils import role_required


student_bp = Blueprint("student", __name__)

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'


@student_bp.route("/courses", methods=["GET"])
def get_courses():
    courses = db.session.scalars(db.select(Course)).all()
    return jsonify([c.asdict() for c in courses]), 200


@student_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_student_profile():
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Try auto-linking if student_info not attached but email matches
    if not user.student_info:
        matched_info = (
            StudentInfo.query.filter_by(email=user.email)
            .order_by(StudentInfo.student_info_id.desc())
            .first()
        )
        if matched_info:
            matched_info.user_id = user.user_id
            db.session.commit()

    student_info = user.student_info
    enrollments_data = []
    if student_info and student_info.enrollments:
        enrollments_data = [e.asdict() for e in student_info.enrollments]

    return jsonify({
        "user": user.asdict(),
        "profile": student_info.asdict() if student_info else None,
        "enrollments": enrollments_data,
        "has_profile": student_info is not None,
    }), 200


@student_bp.route("/profile", methods=["PUT", "PATCH"])
@jwt_required()
def update_student_profile():
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json() or {}

    student_info = user.student_info

    # If student doesn't have a StudentInfo record yet, create one
    if not student_info:
        matched_info = (
            StudentInfo.query.filter_by(email=user.email)
            .order_by(StudentInfo.student_info_id.desc())
            .first()
        )
        if matched_info:
            student_info = matched_info
            student_info.user_id = user.user_id
        else:
            course_id = data.get("course_id")
            if not course_id:
                first_course = db.session.scalar(db.select(Course))
                course_id = first_course.course_id if first_course else 1

            birthdate_str = data.get("birthdate", "2000-01-01")
            parsed_bdate = date(2000, 1, 1)
            for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y"):
                try:
                    parsed_bdate = datetime.strptime(birthdate_str, fmt).date()
                    break
                except ValueError:
                    continue

            student_info = StudentInfo(
                user_id=user.user_id,
                first_name=data.get("first_name") or user.username,
                middle_name=data.get("middle_name") or "",
                last_name=data.get("last_name") or "Student",
                suffix=data.get("suffix") or "",
                birthdate=parsed_bdate,
                phone_number=data.get("phone_number") or "09000000000",
                email=data.get("email") or user.email,
                home_address=data.get("home_address") or "N/A",
                course_id=course_id,
                year_level=data.get("year_level") or "1st Year",
                semester=data.get("semester") or "1st Semester",
                preferred_schedule=data.get("preferred_schedule") or "Day",
            )
            db.session.add(student_info)
            db.session.flush()

    # Update personal fields
    if "first_name" in data and str(data["first_name"]).strip():
        student_info.first_name = str(data["first_name"]).strip()

    if "middle_name" in data:
        student_info.middle_name = (str(data["middle_name"]) or "").strip()

    if "last_name" in data and str(data["last_name"]).strip():
        student_info.last_name = str(data["last_name"]).strip()

    if "suffix" in data:
        student_info.suffix = (str(data["suffix"]) or "").strip()

    if "birthdate" in data and str(data["birthdate"]).strip():
        bdate_val = str(data["birthdate"]).strip()
        parsed_bdate = None
        for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y"):
            try:
                parsed_bdate = datetime.strptime(bdate_val, fmt).date()
                break
            except ValueError:
                continue
        if parsed_bdate:
            student_info.birthdate = parsed_bdate
        else:
            return jsonify({"msg": "Invalid birthdate format. Use YYYY-MM-DD or MM/DD/YY."}), 400

    if "phone_number" in data and str(data["phone_number"]).strip():
        student_info.phone_number = str(data["phone_number"]).strip()

    if "home_address" in data and str(data["home_address"]).strip():
        student_info.home_address = str(data["home_address"]).strip()

    if "preferred_schedule" in data and str(data["preferred_schedule"]).strip():
        student_info.preferred_schedule = str(data["preferred_schedule"]).strip()

    if "course_id" in data and data["course_id"]:
        try:
            cid = int(data["course_id"])
            if Course.query.get(cid):
                student_info.course_id = cid
        except (ValueError, TypeError):
            pass

    if "year_level" in data and str(data["year_level"]).strip():
        student_info.year_level = str(data["year_level"]).strip()

    if "semester" in data and str(data["semester"]).strip():
        student_info.semester = str(data["semester"]).strip()

    # Handle email updates
    if "email" in data and str(data["email"]).strip():
        new_email = str(data["email"]).strip().lower()
        if not re.match(EMAIL_REGEX, new_email):
            return jsonify({"msg": "Invalid email address format."}), 400

        if new_email != user.email:
            existing_user_email = User.query.filter(User.email == new_email, User.user_id != user.user_id).first()
            if existing_user_email:
                return jsonify({"msg": "Email is already taken by another account."}), 409
            user.email = new_email

        student_info.email = new_email

    db.session.commit()

    return jsonify({
        "msg": "Student profile updated successfully!",
        "profile": student_info.asdict(),
        "user": user.asdict(),
    }), 200


@student_bp.route("/profile/<int:user_id>", methods=["GET"])
@jwt_required()
def get_student_profile_by_user_id(user_id):
    identity = get_jwt_identity()
    role = identity.get("role")
    req_user_id = identity.get("user_id")

    if role not in ["admin", "registrar", "edp"] and req_user_id != user_id:
        return jsonify({"msg": "Permission denied"}), 403

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    student_info = user.student_info
    enrollments_data = []
    if student_info and student_info.enrollments:
        enrollments_data = [e.asdict() for e in student_info.enrollments]

    return jsonify({
        "user": user.asdict(),
        "profile": student_info.asdict() if student_info else None,
        "enrollments": enrollments_data,
        "has_profile": student_info is not None,
    }), 200
