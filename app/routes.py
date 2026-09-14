from flask_jwt_extended import get_jwt_identity, jwt_required, create_access_token
from flask import jsonify, request, send_from_directory

from app import app, db
from app.models import User


@app.route('/')
def homepage():
    return send_from_directory("../static", "doc.html")

@app.route("/api/login", methods=["POST"])
def login():
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    username = request.json.get("username", None)
    password = request.json.get("password", None)

    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"msg": "Bad username or password"}), 401

    token = create_access_token(identity=user.user_id)
    return jsonify(token=token), 200

@app.route("/api/getUserDetails", methods=["GET"])
@jwt_required()
def getUserDetails():
    identity = get_jwt_identity()
    user_id = identity
    user = db.session.get(User, user_id)
    return jsonify({
        "username": user.username,
        "email": user.email,
        "role": user.role.role_name
        }), 200

