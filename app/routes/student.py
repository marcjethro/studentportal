import re
from datetime import datetime, date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import (
    User,
    StudentInfo,
    Course,
    Enrollment,
    EnrollmentType,
    DocumentRequirement,
    EnrollmentDocument,
    DocumentRequest,
)
from app.routes.enrollment import ensure_enrollment_documents
from app.utils import role_required, send_email


student_bp = Blueprint("student", __name__)

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'


@student_bp.route("/courses", methods=["GET"])
def get_courses():
    courses = db.session.scalars(db.select(Course)).all()

    # Student counts per course (for Master Data management view).
    count_rows = db.session.execute(
        db.select(StudentInfo.course_id, db.func.count(StudentInfo.student_info_id))
        .group_by(StudentInfo.course_id)
    ).all()
    counts = {cid: n for cid, n in count_rows}

    result = []
    for c in courses:
        item = c.asdict()
        item["student_count"] = counts.get(c.course_id, 0)
        result.append(item)
    return jsonify(result), 200


@student_bp.route("/courses", methods=["POST"])
@role_required(["edp", "admin"])
def create_course():
    data = request.get_json() or {}
    course_name = (data.get("course_name") or "").strip()

    if not course_name:
        return jsonify({"msg": "Course name is required"}), 400
    if len(course_name) > 50:
        return jsonify({"msg": "Course name must be 50 characters or fewer"}), 400

    # Prevent duplicates (case-insensitive)
    existing = db.session.scalars(
        db.select(Course).where(db.func.lower(Course.course_name) == course_name.lower())
    ).first()
    if existing:
        return jsonify({"msg": "A course with this name already exists"}), 409

    course = Course(course_name=course_name)
    db.session.add(course)
    db.session.commit()

    return jsonify({"msg": "Course created successfully", "course": course.asdict()}), 201


@student_bp.route("/courses/<int:course_id>", methods=["PUT", "PATCH"])
@role_required(["edp", "admin"])
def update_course(course_id):
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    data = request.get_json() or {}
    course_name = (data.get("course_name") or "").strip()

    if not course_name:
        return jsonify({"msg": "Course name is required"}), 400
    if len(course_name) > 50:
        return jsonify({"msg": "Course name must be 50 characters or fewer"}), 400

    # Prevent duplicates (case-insensitive), excluding this course
    existing = db.session.scalars(
        db.select(Course).where(
            db.func.lower(Course.course_name) == course_name.lower(),
            Course.course_id != course_id,
        )
    ).first()
    if existing:
        return jsonify({"msg": "A course with this name already exists"}), 409

    course.course_name = course_name
    db.session.commit()

    return jsonify({"msg": "Course updated successfully", "course": course.asdict()}), 200


@student_bp.route("/courses/<int:course_id>", methods=["DELETE"])
@role_required(["edp", "admin"])
def delete_course(course_id):
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    # Guard: a course referenced by student records cannot be deleted
    # (StudentInfo.course_id is NOT NULL).
    student_count = db.session.scalar(
        db.select(db.func.count(StudentInfo.student_info_id)).where(
            StudentInfo.course_id == course_id
        )
    )
    if student_count:
        return jsonify({
            "msg": f"Cannot delete: {student_count} student record(s) are assigned to this course.",
            "student_count": student_count,
        }), 409

    db.session.delete(course)
    db.session.commit()

    return jsonify({"msg": "Course deleted successfully", "course_id": course_id}), 200


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


@student_bp.route("/enrollment-details", methods=["GET"])
@jwt_required()
def get_student_enrollment_details():
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Auto-link student info if needed
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

    # Make sure all enrollments have document tracking records ensured
    enrollments_list = []
    if student_info and student_info.enrollments:
        for enr in student_info.enrollments:
            ensure_enrollment_documents(enr)
        # Sort enrollments by enrollment_id / created desc
        enrollments_list = [e.asdict() for e in student_info.enrollments]
        enrollments_list.reverse()

    # Determine active / pending enrollment
    active_enrollment = None
    has_pending = False
    if enrollments_list:
        # Check if there is a pending one first
        pending_enr = next((e for e in enrollments_list if e.get("status") == "Pending"), None)
        if pending_enr:
            active_enrollment = pending_enr
            has_pending = True
        else:
            active_enrollment = enrollments_list[0]

    # Get available courses
    courses = db.session.scalars(db.select(Course)).all()
    courses_data = [c.asdict() for c in courses]

    # Get Old/Returnee Student requirements (type id 1)
    old_student_reqs = db.session.scalars(
        db.select(DocumentRequirement).where(DocumentRequirement.enrollment_type_id == 1)
    ).all()
    requirements_data = [r.asdict() for r in old_student_reqs]

    return jsonify({
        "user": user.asdict(),
        "profile": student_info.asdict() if student_info else None,
        "active_enrollment": active_enrollment,
        "enrollments": enrollments_list,
        "has_pending_enrollment": has_pending,
        "can_reenroll": not has_pending,
        "requirements": requirements_data,
        "courses": courses_data,
    }), 200


@student_bp.route("/reenroll", methods=["POST"])
@jwt_required()
def handle_student_reenroll():
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json() or {}

    # Find or auto-link student info
    student_info = user.student_info
    if not student_info:
        matched_info = (
            StudentInfo.query.filter_by(email=user.email)
            .order_by(StudentInfo.student_info_id.desc())
            .first()
        )
        if matched_info:
            matched_info.user_id = user.user_id
            student_info = matched_info
        else:
            return jsonify({
                "msg": "No existing student profile found for this account. Please contact the registrar."
            }), 400

    # Ensure document tracking on existing enrollments
    if student_info.enrollments:
        for enr in student_info.enrollments:
            ensure_enrollment_documents(enr)

    # Check if student already has a pending enrollment
    pending_enr = next((e for e in (student_info.enrollments or []) if e.status == "Pending"), None)
    if pending_enr:
        return jsonify({
            "msg": f"You already have a pending re-enrollment application (Tracking ID: {pending_enr.enrollment_id}). Please submit your physical clearance and study load to the Registrar's Office.",
            "enrollment_id": pending_enr.enrollment_id,
        }), 400

    # Validation
    course_id = data.get("course_id")
    if not course_id:
        return jsonify({"msg": "Please select a course / degree program."}), 400
    try:
        course_id = int(course_id)
    except (ValueError, TypeError):
        return jsonify({"msg": "Invalid course ID."}), 400

    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({"msg": "Selected course does not exist."}), 404

    year_level = str(data.get("year_level") or "").strip()
    if not year_level:
        return jsonify({"msg": "Please select your year level."}), 400

    semester = str(data.get("semester") or "").strip()
    if not semester:
        return jsonify({"msg": "Please select your semester."}), 400

    preferred_schedule = str(data.get("preferred_schedule") or "").strip()
    if not preferred_schedule:
        return jsonify({"msg": "Please select your preferred class schedule."}), 400

    # Optional updates to contact details if supplied
    if data.get("phone_number") and str(data["phone_number"]).strip():
        student_info.phone_number = str(data["phone_number"]).strip()
    if data.get("home_address") and str(data["home_address"]).strip():
        student_info.home_address = str(data["home_address"]).strip()

    # Update student data connected with the account
    student_info.course_id = course_id
    student_info.year_level = year_level
    student_info.semester = semester
    student_info.preferred_schedule = preferred_schedule
    student_info.user_id = user.user_id

    # Create new Enrollment record as Old/Returnee Student (enrollment_type_id = 1)
    new_enrollment = Enrollment(
        student_info_id=student_info.student_info_id,
        enrollment_type_id=1,  # Old/Returnee Student
        status="Pending",
    )
    db.session.add(new_enrollment)
    db.session.flush()

    # Ensure document tracking records are initialized for Old/Returnee Student
    ensure_enrollment_documents(new_enrollment)

    db.session.commit()

    # Send tracking notification email to student
    email_sent = False
    subject = "Cebu Eastern College, Inc. - Re-Enrollment Application Received"
    email_text = f"""Dear {student_info.first_name} {student_info.last_name},

Your re-enrollment application as an Old / Returnee Student at Cebu Eastern College, Inc. has been received!

Tracking ID: {new_enrollment.enrollment_id}
Program: {course.course_name}
Year Level: {student_info.year_level} | Semester: {student_info.semester}
Preferred Schedule: {student_info.preferred_schedule}

Required Physical Clearance Documents:
1. Study Load
2. Complete Clearance Form

Please submit these required physical documents to the Office of the Registrar to verify your re-enrollment.
Note: No new account is needed. You will continue to use your existing Student Portal account ({user.username}).

Warm regards,
Office of the Registrar
Cebu Eastern College, Inc.
"""

    try:
        send_email(subject, student_info.email, email_text)
        email_sent = True
    except Exception as e:
        print(f"Warning: Failed to send re-enrollment confirmation email: {e}")

    return jsonify({
        "msg": "Re-enrollment application successfully submitted as Old/Returnee Student!",
        "enrollment_id": new_enrollment.enrollment_id,
        "enrollment": new_enrollment.asdict(),
        "profile": student_info.asdict(),
        "account_created": False,
        "is_reenrollment": True,
        "email_sent": email_sent,
    }), 201


# =========================================================
# REGISTRAR STUDENT RECORDS DIRECTORY & MANAGEMENT
# =========================================================

@student_bp.route("/records", methods=["GET"])
@role_required(["registrar", "admin", "edp"])
def get_all_student_records():
    search = request.args.get("search", "").strip().lower()
    course_id = request.args.get("course_id", "").strip()
    year_level = request.args.get("year_level", "").strip()
    semester = request.args.get("semester", "").strip()
    status_filter = request.args.get("status", "").strip().lower()

    query = db.select(StudentInfo)
    all_students = db.session.scalars(query).all()

    student_records = []
    total_enrolled = 0
    total_pending = 0

    for s in all_students:
        # Auto-link user by email if not linked
        if not s.user_id:
            matched_user = User.query.filter_by(email=s.email).first()
            if matched_user:
                s.user_id = matched_user.user_id
                db.session.commit()

        # Gather enrollments
        enrollments = s.enrollments or []
        latest_enrollment = None
        if enrollments:
            # Sort with newest first
            sorted_enrs = sorted(enrollments, key=lambda e: e.enrollment_id, reverse=True)
            # Pick pending first if any, else latest
            pending_e = next((e for e in sorted_enrs if e.status == "Pending"), None)
            latest_enrollment = pending_e if pending_e else sorted_enrs[0]

        enr_status = latest_enrollment.status if latest_enrollment else "Not Enrolled"
        if enr_status.lower() == "enrolled":
            total_enrolled += 1
        elif enr_status.lower() == "pending":
            total_pending += 1

        # Search filter
        full_name = f"{s.first_name} {s.middle_name or ''} {s.last_name} {s.suffix or ''}".strip().lower()
        username = s.user.username.lower() if s.user else ""
        course_name = s.course.course_name.lower() if s.course else ""
        s_email = (s.email or "").lower()
        s_phone = (s.phone_number or "").lower()
        s_id_str = str(s.student_info_id)

        if search:
            if (search not in full_name and
                search not in username and
                search not in course_name and
                search not in s_email and
                search not in s_phone and
                search not in s_id_str and
                (not latest_enrollment or search not in latest_enrollment.enrollment_id.lower())):
                continue

        if course_id:
            try:
                if s.course_id != int(course_id):
                    continue
            except ValueError:
                pass

        if year_level and year_level.lower() != "all":
            if s.year_level.lower() != year_level.lower():
                continue

        if semester and semester.lower() != "all":
            if s.semester.lower() != semester.lower():
                continue

        if status_filter and status_filter != "all":
            if status_filter == "enrolled" and enr_status.lower() != "enrolled":
                continue
            elif status_filter == "pending" and enr_status.lower() != "pending":
                continue
            elif status_filter == "returnee":
                if not latest_enrollment or latest_enrollment.enrollment_type_id != 1:
                    continue
            elif status_filter == "new":
                if not latest_enrollment or latest_enrollment.enrollment_type_id != 2:
                    continue

        # Build latest enrollment info
        latest_enr_data = None
        if latest_enrollment:
            docs = latest_enrollment.documents or []
            submitted_docs = sum(1 for d in docs if d.status == "Submitted")
            latest_enr_data = {
                "enrollment_id": latest_enrollment.enrollment_id,
                "status": latest_enrollment.status,
                "enrollment_type": latest_enrollment.enrollment_type.enrollment_type_name if latest_enrollment.enrollment_type else "Student",
                "enrollment_type_id": latest_enrollment.enrollment_type_id,
                "documents_count": len(docs),
                "submitted_documents_count": submitted_docs,
                "all_documents_submitted": len(docs) > 0 and submitted_docs == len(docs),
            }

        rec = s.asdict()
        rec["username"] = s.user.username if s.user else None
        rec["has_portal_account"] = s.user is not None
        rec["latest_enrollment"] = latest_enr_data
        rec["enrollments_count"] = len(enrollments)
        student_records.append(rec)

    # Available courses for filtering
    courses = db.session.scalars(db.select(Course)).all()

    return jsonify({
        "students": student_records,
        "stats": {
            "total": len(all_students),
            "filtered": len(student_records),
            "enrolled": total_enrolled,
            "pending": total_pending,
            "programs_count": len(courses),
        },
        "courses": [c.asdict() for c in courses]
    }), 200


@student_bp.route("/records/<int:student_info_id>", methods=["GET"])
@role_required(["registrar", "admin", "edp"])
def get_student_record_by_id(student_info_id):
    student = db.session.get(StudentInfo, student_info_id)
    if not student:
        return jsonify({"msg": "Student record not found"}), 404

    # Auto-link if needed
    if not student.user_id:
        matched_user = User.query.filter_by(email=student.email).first()
        if matched_user:
            student.user_id = matched_user.user_id
            db.session.commit()

    # Ensure document tracking for all enrollments
    enrollments_data = []
    if student.enrollments:
        for enr in student.enrollments:
            ensure_enrollment_documents(enr)
            enrollments_data.append(enr.asdict())
        enrollments_data.reverse()

    # Document requests if portal user exists
    doc_requests_data = []
    if student.user_id:
        requests = DocumentRequest.query.filter_by(student_user_id=student.user_id).order_by(DocumentRequest.created_at.desc()).all()
        doc_requests_data = [r.asdict() for r in requests]

    res = student.asdict()
    res["user"] = student.user.asdict() if student.user else None
    res["enrollments"] = enrollments_data
    res["document_requests"] = doc_requests_data

    return jsonify(res), 200


@student_bp.route("/records/<int:student_info_id>", methods=["PUT", "PATCH"])
@role_required(["registrar", "admin"])
def update_student_record(student_info_id):
    student = db.session.get(StudentInfo, student_info_id)
    if not student:
        return jsonify({"msg": "Student record not found"}), 404

    data = request.get_json() or {}

    # Academic fields
    if "course_id" in data and data["course_id"]:
        try:
            cid = int(data["course_id"])
            if Course.query.get(cid):
                student.course_id = cid
        except (ValueError, TypeError):
            pass

    if "year_level" in data and str(data["year_level"]).strip():
        student.year_level = str(data["year_level"]).strip()

    if "semester" in data and str(data["semester"]).strip():
        student.semester = str(data["semester"]).strip()

    if "preferred_schedule" in data and str(data["preferred_schedule"]).strip():
        student.preferred_schedule = str(data["preferred_schedule"]).strip()

    # Personal fields
    if "first_name" in data and str(data["first_name"]).strip():
        student.first_name = str(data["first_name"]).strip()

    if "middle_name" in data:
        student.middle_name = (str(data["middle_name"]) or "").strip()

    if "last_name" in data and str(data["last_name"]).strip():
        student.last_name = str(data["last_name"]).strip()

    if "suffix" in data:
        student.suffix = (str(data["suffix"]) or "").strip()

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
            student.birthdate = parsed_bdate

    if "phone_number" in data and str(data["phone_number"]).strip():
        student.phone_number = str(data["phone_number"]).strip()

    if "home_address" in data and str(data["home_address"]).strip():
        student.home_address = str(data["home_address"]).strip()

    # Email
    if "email" in data and str(data["email"]).strip():
        new_email = str(data["email"]).strip().lower()
        if not re.match(EMAIL_REGEX, new_email):
            return jsonify({"msg": "Invalid email address format."}), 400

        # If email changed, ensure no conflict on user
        if student.user and student.user.email != new_email:
            existing_user_email = User.query.filter(User.email == new_email, User.user_id != student.user_id).first()
            if existing_user_email:
                return jsonify({"msg": "Email is already taken by another account."}), 409
            student.user.email = new_email

        student.email = new_email

    db.session.commit()

    return jsonify({
        "msg": "Student record updated successfully!",
        "student": student.asdict()
    }), 200


@student_bp.route("/records", methods=["POST"])
@role_required(["registrar", "admin"])
def create_student_record():
    data = request.get_json() or {}

    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    middle_name = (data.get("middle_name") or "").strip()
    suffix = (data.get("suffix") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone_number = (data.get("phone_number") or "").strip()
    home_address = (data.get("home_address") or "").strip()
    course_id = data.get("course_id")
    year_level = (data.get("year_level") or "1st Year").strip()
    semester = (data.get("semester") or "1st Semester").strip()
    preferred_schedule = (data.get("preferred_schedule") or "Day (8:00 AM - 12:00 PM)").strip()
    enrollment_type_id = data.get("enrollment_type_id") or 2  # Default to New Student

    if not first_name or not last_name:
        return jsonify({"msg": "First name and Last name are required."}), 400

    if not email or not re.match(EMAIL_REGEX, email):
        return jsonify({"msg": "A valid email address is required."}), 400

    if not course_id:
        return jsonify({"msg": "Course / Degree program is required."}), 400

    try:
        course_id = int(course_id)
        if not Course.query.get(course_id):
            return jsonify({"msg": "Selected course does not exist."}), 404
    except (ValueError, TypeError):
        return jsonify({"msg": "Invalid course ID."}), 400

    # Parse birthdate
    bdate_str = str(data.get("birthdate") or "2000-01-01").strip()
    parsed_bdate = date(2000, 1, 1)
    for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y"):
        try:
            parsed_bdate = datetime.strptime(bdate_str, fmt).date()
            break
        except ValueError:
            continue

    # Check if student with email already exists
    existing_s = StudentInfo.query.filter_by(email=email).first()
    if existing_s:
        return jsonify({"msg": f"A student record with email '{email}' already exists."}), 409

    # Link user if user account with this email exists
    matched_user = User.query.filter_by(email=email).first()
    user_id_val = matched_user.user_id if matched_user else None

    new_student = StudentInfo(
        user_id=user_id_val,
        first_name=first_name,
        middle_name=middle_name,
        last_name=last_name,
        suffix=suffix,
        birthdate=parsed_bdate,
        phone_number=phone_number or "09000000000",
        email=email,
        home_address=home_address or "N/A",
        course_id=course_id,
        year_level=year_level,
        semester=semester,
        preferred_schedule=preferred_schedule,
    )
    db.session.add(new_student)
    db.session.flush()

    # Create initial Enrollment
    try:
        enr_type_id = int(enrollment_type_id)
    except (ValueError, TypeError):
        enr_type_id = 2

    new_enrollment = Enrollment(
        student_info_id=new_student.student_info_id,
        enrollment_type_id=enr_type_id,
        status="Pending",
    )
    db.session.add(new_enrollment)
    db.session.flush()
    ensure_enrollment_documents(new_enrollment)

    db.session.commit()

    return jsonify({
        "msg": "Student record created successfully!",
        "student": new_student.asdict(),
        "enrollment_id": new_enrollment.enrollment_id,
    }), 201
