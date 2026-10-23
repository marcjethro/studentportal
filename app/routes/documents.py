import secrets
import string
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import (
    DocumentType,
    DocumentRequest,
    DocumentRequestLog,
    User,
    Course,
    StudentInfo,
)
from app.utils import role_required


documents_bp = Blueprint("documents", __name__)


DEFAULT_DOC_TYPES = [
    {
        "name": "Official Transcript of Records (TOR)",
        "code": "TOR",
        "description": "Complete official academic transcript with seal. Used for employment, graduation, board exams, or transfer.",
        "processing_days": 5,
        "fee": 150.0,
        "requires_clearance": True,
    },
    {
        "name": "Certificate of Grades",
        "code": "GRADES",
        "description": "Certified true copy of grades for a specific term or school year. Used for scholarship evaluation, company reimbursement, or grade validation.",
        "processing_days": 2,
        "fee": 50.0,
        "requires_clearance": False,
    },
    {
        "name": "Certificate of Good Moral Character",
        "code": "GOOD_MORAL",
        "description": "Official certification attesting to student's commendable discipline, character, and conduct without disciplinary infractions.",
        "processing_days": 2,
        "fee": 75.0,
        "requires_clearance": False,
    },
    {
        "name": "Certificate of Enrollment / Registration",
        "code": "ENROLLMENT_CERT",
        "description": "Proof of active student status for the current academic semester. Used for visa, passport, child allowance, or SSS/GSIS claims.",
        "processing_days": 1,
        "fee": 50.0,
        "requires_clearance": False,
    },
    {
        "name": "Certificate of Graduation / Completion",
        "code": "GRADUATION_CERT",
        "description": "Official certification confirming student completion of all degree requirements.",
        "processing_days": 3,
        "fee": 100.0,
        "requires_clearance": True,
    },
    {
        "name": "Honorable Dismissal / Transfer Credential",
        "code": "HONORABLE_DISMISSAL",
        "description": "Clearance and document certifying student eligibility to officially transfer to another academic institution.",
        "processing_days": 5,
        "fee": 150.0,
        "requires_clearance": True,
    },
]


def ensure_default_document_types():
    """Seeds default document types if none exist yet."""
    try:
        count = db.session.scalar(db.select(db.func.count(DocumentType.document_type_id)))
        if count == 0:
            for item in DEFAULT_DOC_TYPES:
                doc_type = DocumentType(
                    name=item["name"],
                    code=item["code"],
                    description=item["description"],
                    processing_days=item["processing_days"],
                    fee=item["fee"],
                    requires_clearance=item["requires_clearance"],
                    is_active=True,
                )
                db.session.add(doc_type)
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error ensuring document types: {e}")


def generate_document_request_id():
    """Generates unique tracking code like DOC-20261023-A47E"""
    date_part = datetime.utcnow().strftime("%Y%m%d")
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(chars) for _ in range(4))
    candidate = f"DOC-{date_part}-{suffix}"

    while DocumentRequest.query.filter_by(request_id=candidate).first():
        suffix = "".join(secrets.choice(chars) for _ in range(4))
        candidate = f"DOC-{date_part}-{suffix}"

    return candidate


@documents_bp.route("/types", methods=["GET"])
def get_document_types():
    ensure_default_document_types()
    types = DocumentType.query.filter_by(is_active=True).all()
    return jsonify([t.asdict() for t in types]), 200


@documents_bp.route("/requests", methods=["GET"])
@jwt_required()
def get_requests():
    ensure_default_document_types()
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    role = identity.get("role")

    query = DocumentRequest.query

    # Students can only view their own requests
    if role == "student":
        query = query.filter_by(student_user_id=user_id)

    # Optional status filter
    status = request.args.get("status")
    if status and status != "All":
        query = query.filter(DocumentRequest.status == status)

    # Optional search query
    search = request.args.get("search", "").strip()
    if search:
        search_filter = (
            DocumentRequest.request_id.ilike(f"%{search}%")
            | DocumentRequest.student_name.ilike(f"%{search}%")
            | DocumentRequest.student_number.ilike(f"%{search}%")
            | DocumentRequest.purpose.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    requests = query.order_by(DocumentRequest.created_at.desc()).all()
    return jsonify([r.asdict() for r in requests]), 200


@documents_bp.route("/requests", methods=["POST"])
@jwt_required()
def create_request():
    ensure_default_document_types()
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json() or {}

    document_type_id = data.get("document_type_id")
    if not document_type_id:
        return jsonify({"msg": "Missing document_type_id"}), 400

    doc_type = db.session.get(DocumentType, document_type_id)
    if not doc_type:
        return jsonify({"msg": "Invalid document_type_id"}), 400

    student_name = (data.get("student_name") or user.username or "").strip()
    if not student_name:
        return jsonify({"msg": "Student name is required"}), 400

    purpose = (data.get("purpose") or "").strip()
    if not purpose:
        return jsonify({"msg": "Purpose of request is required"}), 400

    try:
        copies = int(data.get("copies", 1))
        if copies < 1 or copies > 10:
            copies = 1
    except (ValueError, TypeError):
        copies = 1

    student_number = data.get("student_number") or ""
    course_name = data.get("course_name") or ""
    year_level = data.get("year_level") or ""
    contact_number = data.get("contact_number") or ""
    email = data.get("email") or user.email or ""
    special_instructions = data.get("special_instructions") or ""

    request_id = generate_document_request_id()

    new_request = DocumentRequest(
        request_id=request_id,
        student_user_id=user_id,
        student_name=student_name,
        student_number=student_number,
        course_name=course_name,
        year_level=year_level,
        contact_number=contact_number,
        email=email,
        document_type_id=document_type_id,
        copies=copies,
        purpose=purpose,
        special_instructions=special_instructions,
        status="Pending",
    )

    log_entry = DocumentRequestLog(
        request_id=request_id,
        action="SUBMITTED",
        status="Pending",
        actor_user_id=user_id,
        actor_name=user.username,
        actor_role=user.role.role_name,
        notes=f"Document request submitted for {doc_type.name} ({copies} copy/copies). Purpose: {purpose}",
    )

    db.session.add(new_request)
    db.session.add(log_entry)
    db.session.commit()

    return jsonify({
        "msg": "Document request submitted successfully",
        "request": new_request.asdict(),
    }), 201


@documents_bp.route("/requests/<request_id>", methods=["GET"])
@jwt_required()
def get_request_by_id(request_id):
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    role = identity.get("role")

    doc_request = DocumentRequest.query.filter_by(request_id=request_id).first()
    if not doc_request:
        return jsonify({"msg": "Document request not found"}), 404

    # Authorization: students can only see their own
    if role == "student" and doc_request.student_user_id != user_id:
        return jsonify({"msg": "Forbidden: You cannot view this request"}), 403

    return jsonify(doc_request.asdict(include_logs=True)), 200


@documents_bp.route("/requests/<request_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_request(request_id):
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    role = identity.get("role")
    user = db.session.get(User, user_id)

    doc_request = DocumentRequest.query.filter_by(request_id=request_id).first()
    if not doc_request:
        return jsonify({"msg": "Document request not found"}), 404

    if role == "student" and doc_request.student_user_id != user_id:
        return jsonify({"msg": "Forbidden"}), 403

    if doc_request.status != "Pending":
        return jsonify({"msg": "Only pending requests can be cancelled"}), 400

    doc_request.status = "Cancelled"

    log_entry = DocumentRequestLog(
        request_id=request_id,
        action="CANCELLED",
        status="Cancelled",
        actor_user_id=user_id,
        actor_name=user.username if user else "Student",
        actor_role=role,
        notes="Request cancelled by student.",
    )
    db.session.add(log_entry)
    db.session.commit()

    return jsonify({"msg": "Request cancelled successfully", "request": doc_request.asdict()}), 200


@documents_bp.route("/requests/<request_id>/registrar-review", methods=["POST"])
@role_required(["registrar", "admin"])
def registrar_review(request_id):
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    user = db.session.get(User, user_id)

    doc_request = DocumentRequest.query.filter_by(request_id=request_id).first()
    if not doc_request:
        return jsonify({"msg": "Document request not found"}), 404

    data = request.get_json() or {}
    action = (data.get("action") or "").lower()
    remarks = (data.get("remarks") or "").strip()
    rejection_reason = (data.get("rejection_reason") or "").strip()

    if action == "approve":
        doc_request.status = "Approved"
        doc_request.registrar_user_id = user_id
        doc_request.registrar_reviewed_at = datetime.utcnow()
        doc_request.registrar_remarks = remarks or "Scholastic records verified and request approved. Forwarded to EDP for printing."
        doc_request.rejection_reason = None

        log_entry = DocumentRequestLog(
            request_id=request_id,
            action="APPROVED",
            status="Approved",
            actor_user_id=user_id,
            actor_name=user.username if user else "Registrar",
            actor_role="registrar",
            notes=doc_request.registrar_remarks,
        )
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            "msg": "Request approved and forwarded to EDP for document printing and release",
            "request": doc_request.asdict(),
        }), 200

    elif action == "reject":
        if not rejection_reason and not remarks:
            return jsonify({"msg": "Rejection reason is required"}), 400

        reason = rejection_reason or remarks
        doc_request.status = "Rejected"
        doc_request.registrar_user_id = user_id
        doc_request.registrar_reviewed_at = datetime.utcnow()
        doc_request.rejection_reason = reason

        log_entry = DocumentRequestLog(
            request_id=request_id,
            action="REJECTED",
            status="Rejected",
            actor_user_id=user_id,
            actor_name=user.username if user else "Registrar",
            actor_role="registrar",
            notes=f"Request rejected. Reason: {reason}",
        )
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            "msg": "Request has been rejected",
            "request": doc_request.asdict(),
        }), 200

    else:
        return jsonify({"msg": "Invalid action. Must be 'approve' or 'reject'"}), 400


@documents_bp.route("/requests/<request_id>/edp-action", methods=["POST"])
@role_required(["edp", "admin"])
def edp_action(request_id):
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    user = db.session.get(User, user_id)

    doc_request = DocumentRequest.query.filter_by(request_id=request_id).first()
    if not doc_request:
        return jsonify({"msg": "Document request not found"}), 404

    data = request.get_json() or {}
    action = (data.get("action") or "").lower()

    if action == "ready":
        pickup_location = (data.get("pickup_location") or "EDP Counter Window 2").strip()
        remarks = (data.get("remarks") or "").strip()

        doc_request.status = "Ready for Pickup"
        doc_request.edp_user_id = user_id
        doc_request.edp_prepared_at = datetime.utcnow()
        doc_request.pickup_location = pickup_location

        log_notes = f"Document printed, sealed, and ready for counter pickup at: {pickup_location}."
        if remarks:
            log_notes += f" Notes: {remarks}"

        log_entry = DocumentRequestLog(
            request_id=request_id,
            action="READY_FOR_PICKUP",
            status="Ready for Pickup",
            actor_user_id=user_id,
            actor_name=user.username if user else "EDP",
            actor_role="edp",
            notes=log_notes,
        )
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            "msg": "Document marked Ready for Pickup",
            "request": doc_request.asdict(),
        }), 200

    elif action == "release":
        released_to = (data.get("released_to") or doc_request.student_name).strip()
        id_presented = (data.get("id_presented") or "").strip()
        release_notes = (data.get("release_notes") or "").strip()

        doc_request.status = "Released"
        doc_request.edp_user_id = user_id
        doc_request.released_at = datetime.utcnow()
        doc_request.released_to = released_to

        full_notes = f"Physical document released to: {released_to}."
        if id_presented:
            full_notes += f" ID Verified: {id_presented}."
        if release_notes:
            full_notes += f" Remarks: {release_notes}."

        doc_request.release_notes = full_notes

        log_entry = DocumentRequestLog(
            request_id=request_id,
            action="RELEASED",
            status="Released",
            actor_user_id=user_id,
            actor_name=user.username if user else "EDP",
            actor_role="edp",
            notes=full_notes,
        )
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            "msg": "Document officially released and marked claimed",
            "request": doc_request.asdict(),
        }), 200

    else:
        return jsonify({"msg": "Invalid action. Must be 'ready' or 'release'"}), 400


@documents_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    ensure_default_document_types()
    identity = get_jwt_identity()
    user_id = identity.get("user_id")
    role = identity.get("role")

    if role == "student":
        reqs = DocumentRequest.query.filter_by(student_user_id=user_id).all()
        return jsonify({
            "total": len(reqs),
            "pending": sum(1 for r in reqs if r.status == "Pending"),
            "approved": sum(1 for r in reqs if r.status == "Approved"),
            "ready_for_pickup": sum(1 for r in reqs if r.status == "Ready for Pickup"),
            "released": sum(1 for r in reqs if r.status == "Released"),
            "rejected": sum(1 for r in reqs if r.status == "Rejected"),
        }), 200

    elif role in ["registrar", "admin"]:
        reqs = DocumentRequest.query.all()
        return jsonify({
            "total": len(reqs),
            "pending_review": sum(1 for r in reqs if r.status == "Pending"),
            "approved_total": sum(1 for r in reqs if r.status in ["Approved", "Ready for Pickup", "Released"]),
            "rejected_total": sum(1 for r in reqs if r.status == "Rejected"),
            "released_total": sum(1 for r in reqs if r.status == "Released"),
        }), 200

    elif role == "edp":
        reqs = DocumentRequest.query.all()
        return jsonify({
            "total": len(reqs),
            "awaiting_preparation": sum(1 for r in reqs if r.status == "Approved"),
            "ready_for_pickup": sum(1 for r in reqs if r.status == "Ready for Pickup"),
            "released_total": sum(1 for r in reqs if r.status == "Released"),
            "pending_registrar": sum(1 for r in reqs if r.status == "Pending"),
        }), 200

    else:
        reqs = DocumentRequest.query.all()
        return jsonify({
            "total": len(reqs),
            "pending": sum(1 for r in reqs if r.status == "Pending"),
            "approved": sum(1 for r in reqs if r.status == "Approved"),
            "ready": sum(1 for r in reqs if r.status == "Ready for Pickup"),
            "released": sum(1 for r in reqs if r.status == "Released"),
        }), 200
