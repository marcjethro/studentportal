from flask import Blueprint
from flask import jsonify, request, send_from_directory, render_template
from flask_jwt_extended import get_jwt_identity, jwt_required, decode_token

from app import db, BACKEND_URL
from app.models import Announcement
from app.utils import role_required


announcements_bp = Blueprint("announcements", __name__)

@announcements_bp.route("/announcements", methods=["GET"])
@jwt_required()
def handle_get_announcements():
    announcements = db.session.scalars(db.select(Announcement)).all()
    return jsonify([announcement.asdict() for announcement in announcements]), 200

@announcements_bp.route("/announcements", methods=["POST"])
@role_required("admin")
def handle_post_announcements():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    identity = get_jwt_identity()
    user_id = identity["user_id"]

    title = request.json.get("title", None)
    body = request.json.get("body", None)

    if not title:
        return jsonify({"msg": "Missing title"}), 400

    announcement = db.session.query(Announcement).filter_by(title=title).first()
    if announcement:
        return jsonify({"msg": "Announcement with that title already exists!"}), 409

    if not body:
        return jsonify({"msg": "Missing body"}), 400


    new_announcement = Announcement(title=title, body=body, user_id=user_id)
    db.session.add(new_announcement)
    db.session.commit()
    return jsonify({"announcement_id": new_announcement.announcement_id, "msg": "Announcement created successfully"}), 200
